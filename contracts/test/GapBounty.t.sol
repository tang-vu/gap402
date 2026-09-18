// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {GapBounty} from "../src/GapBounty.sol";
import {EvidenceReceiptRegistry} from "../src/EvidenceReceiptRegistry.sol";
import {MockUSDC} from "../src/test/MockUSDC.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

contract GapBountyTest is Test {
    GapBounty gb;
    EvidenceReceiptRegistry reg;
    MockUSDC usdc;

    address requester = makeAddr("requester");
    address verifier = makeAddr("verifier");
    address supplierA = makeAddr("supplierA");
    address supplierB = makeAddr("supplierB");
    address stranger = makeAddr("stranger");

    bytes32 constant SPEC = keccak256("spec");
    uint96 constant AMOUNT = 50_000; // 0.05 USDC
    uint64 deadline;

    function setUp() public {
        usdc = new MockUSDC();
        gb = new GapBounty(IERC20(address(usdc)));
        reg = gb.receiptRegistry();
        deadline = uint64(block.timestamp + 1 hours);
        usdc.mint(requester, 1_000_000);
        vm.prank(requester);
        usdc.approve(address(gb), type(uint256).max);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(requester);
        id = gb.createBounty(SPEC, verifier, AMOUNT, deadline, 16);
    }

    /* ── creation ─────────────────────────────────────────────────── */

    function test_create_escrows_usdc() public {
        uint256 id = _create();
        assertEq(usdc.balanceOf(address(gb)), AMOUNT);
        GapBounty.Bounty memory b = gb.getBounty(id);
        assertEq(b.requester, requester);
        assertEq(b.verifier, verifier);
        assertEq(b.amount, AMOUNT);
        assertEq(uint8(b.state), uint8(GapBounty.State.Open));
        assertEq(b.specHash, SPEC);
    }

    function test_create_reverts_without_allowance() public {
        vm.prank(stranger);
        vm.expectRevert();
        gb.createBounty(SPEC, verifier, AMOUNT, deadline, 16);
    }

    function test_create_reverts_bad_params() public {
        vm.startPrank(requester);
        vm.expectRevert(GapBounty.BadSpecHash.selector);
        gb.createBounty(bytes32(0), verifier, AMOUNT, deadline, 16);
        vm.expectRevert(GapBounty.BadVerifier.selector);
        gb.createBounty(SPEC, address(0), AMOUNT, deadline, 16);
        vm.expectRevert(GapBounty.ZeroAmount.selector);
        gb.createBounty(SPEC, verifier, 0, deadline, 16);
        vm.expectRevert(GapBounty.BadDeadline.selector);
        gb.createBounty(SPEC, verifier, AMOUNT, uint64(block.timestamp), 16);
        vm.expectRevert(GapBounty.BadCommitmentCap.selector);
        gb.createBounty(SPEC, verifier, AMOUNT, deadline, 0);
        vm.stopPrank();
    }

    /* ── commitments ──────────────────────────────────────────────── */

    function test_commitEvidence() public {
        uint256 id = _create();
        bytes32 eh = keccak256("evidence-a");
        vm.prank(supplierA);
        gb.commitEvidence(id, eh);
        assertEq(gb.commitmentOf(id, eh), supplierA);
    }

    function test_commitEvidence_rejects_duplicates() public {
        uint256 id = _create();
        bytes32 eh = keccak256("evidence-a");
        gb.commitEvidence(id, eh);
        vm.expectRevert(GapBounty.DuplicateCommitment.selector);
        gb.commitEvidence(id, eh);
        vm.prank(supplierB);
        vm.expectRevert(GapBounty.DuplicateCommitment.selector);
        gb.commitEvidence(id, eh);
    }

    function test_commitEvidence_rejects_after_deadline() public {
        uint256 id = _create();
        vm.warp(deadline + 1);
        vm.expectRevert(GapBounty.DeadlinePassed.selector);
        gb.commitEvidence(id, keccak256("late"));
    }

    function test_commitEvidence_cap_enforced() public {
        vm.prank(requester);
        uint256 id = gb.createBounty(SPEC, verifier, AMOUNT, deadline, 1);
        gb.commitEvidence(id, keccak256("one"));
        vm.expectRevert(GapBounty.MaxSubmissionsReached.selector);
        gb.commitEvidence(id, keccak256("two"));
    }

    /* ── finalize ─────────────────────────────────────────────────── */

    function _payouts(
        address a,
        uint256 x,
        address b_,
        uint256 y
    )
        internal
        pure
        returns (address[] memory r, uint256[] memory amts)
    {
        if (a < b_) {
            r = new address[](2);
            amts = new uint256[](2);
            r[0] = a;
            amts[0] = x;
            r[1] = b_;
            amts[1] = y;
        } else {
            r = new address[](2);
            amts = new uint256[](2);
            r[0] = b_;
            amts[0] = y;
            r[1] = a;
            amts[1] = x;
        }
    }

    function test_finalize_pays_and_refunds() public {
        uint256 id = _create();
        bytes32 sh = keccak256("settlement");
        bytes32 rh = keccak256("receipt");
        (address[] memory r, uint256[] memory amts) = _payouts(
            supplierA,
            22_500,
            supplierB,
            17_500
        );
        uint256 reqBefore = usdc.balanceOf(requester);
        vm.prank(verifier);
        gb.finalize(id, r, amts, sh, rh);
        assertEq(usdc.balanceOf(supplierA), 22_500);
        assertEq(usdc.balanceOf(supplierB), 17_500);
        assertEq(usdc.balanceOf(requester), reqBefore + 10_000);
        assertEq(usdc.balanceOf(address(gb)), 0);
        GapBounty.Bounty memory b = gb.getBounty(id);
        assertEq(uint8(b.state), uint8(GapBounty.State.Settled));
        assertEq(b.settlementHash, sh);
        assertEq(b.receiptHash, rh);
        assertTrue(reg.isAnchored(rh));
    }

    function test_finalize_only_verifier() public {
        uint256 id = _create();
        (address[] memory r, uint256[] memory amts) = _payouts(
            supplierA,
            1,
            supplierB,
            1
        );
        vm.prank(requester);
        vm.expectRevert(GapBounty.NotVerifier.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
        vm.prank(stranger);
        vm.expectRevert(GapBounty.NotVerifier.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
    }

    function test_finalize_rejects_overflow() public {
        uint256 id = _create();
        address[] memory r = new address[](1);
        uint256[] memory amts = new uint256[](1);
        r[0] = supplierA;
        amts[0] = AMOUNT + 1;
        vm.prank(verifier);
        vm.expectRevert(GapBounty.PayoutOverflow.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
    }

    function test_finalize_rejects_unsorted_recipients() public {
        uint256 id = _create();
        address[] memory r = new address[](2);
        r[0] = address(0xffff);
        r[1] = address(0x1); // out of order
        uint256[] memory amts = new uint256[](2);
        amts[0] = 1;
        amts[1] = 1;
        vm.prank(verifier);
        vm.expectRevert(GapBounty.RecipientsNotCanonical.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
    }

    function test_finalize_rejects_zero_recipient_and_amount() public {
        uint256 id = _create();
        address[] memory r = new address[](1);
        uint256[] memory amts = new uint256[](1);
        r[0] = address(0);
        amts[0] = 1;
        vm.prank(verifier);
        vm.expectRevert(GapBounty.ZeroAddress.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));

        r[0] = supplierA;
        amts[0] = 0;
        vm.prank(verifier);
        vm.expectRevert(GapBounty.ZeroAmount.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
    }

    function test_finalize_cannot_run_twice() public {
        uint256 id = _create();
        address[] memory r = new address[](1);
        uint256[] memory amts = new uint256[](1);
        r[0] = supplierA;
        amts[0] = AMOUNT;
        vm.prank(verifier);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
        vm.prank(verifier);
        vm.expectRevert(GapBounty.NotOpen.selector);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r2"));
    }

    function test_finalize_zero_hash_rejected() public {
        uint256 id = _create();
        address[] memory r = new address[](1);
        uint256[] memory amts = new uint256[](1);
        r[0] = supplierA;
        amts[0] = 1;
        vm.prank(verifier);
        vm.expectRevert(GapBounty.BadHash.selector);
        gb.finalize(id, r, amts, bytes32(0), keccak256("r"));
    }

    /* ── cancel ───────────────────────────────────────────────────── */

    function test_cancel_after_deadline_refunds() public {
        uint256 id = _create();
        vm.warp(deadline + 1);
        uint256 before_ = usdc.balanceOf(requester);
        vm.prank(requester);
        gb.cancel(id);
        assertEq(usdc.balanceOf(requester), before_ + AMOUNT);
        assertEq(usdc.balanceOf(address(gb)), 0);
    }

    function test_cancel_before_deadline_reverts() public {
        uint256 id = _create();
        vm.prank(requester);
        vm.expectRevert(GapBounty.DeadlineNotReached.selector);
        gb.cancel(id);
    }

    function test_cancel_only_requester() public {
        uint256 id = _create();
        vm.warp(deadline + 1);
        vm.prank(stranger);
        vm.expectRevert(GapBounty.NotRequester.selector);
        gb.cancel(id);
    }

    function test_cancel_after_settle_reverts() public {
        uint256 id = _create();
        address[] memory r = new address[](1);
        uint256[] memory amts = new uint256[](1);
        r[0] = supplierA;
        amts[0] = AMOUNT;
        vm.prank(verifier);
        gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
        vm.warp(deadline + 1);
        vm.prank(requester);
        vm.expectRevert(GapBounty.NotOpen.selector);
        gb.cancel(id);
    }

    /* ── fuzz / invariants ────────────────────────────────────────── */

    /// @notice escrow can never be overdrawn: payout sets summing to more
    /// than the escrow revert; valid sets conserve funds exactly.
    function testFuzz_finalize_exact_accounting(
        uint96 amount,
        uint8 nPayouts,
        uint256 seed
    ) public {
        amount = uint96(bound(amount, 1, 1e12));
        nPayouts = uint8(bound(nPayouts, 1, 16));
        usdc.mint(requester, amount);
        vm.prank(requester);
        uint256 id = gb.createBounty(SPEC, verifier, amount, deadline, 64);

        address[] memory r = new address[](nPayouts);
        uint256[] memory amts = new uint256[](nPayouts);
        uint256 total = 0;
        for (uint256 i = 0; i < nPayouts; i++) {
            r[i] = address(uint160(0x1000 + i));
            amts[i] = bound(uint256(keccak256(abi.encode(seed, i))), 1, amount);
            total += amts[i];
        }
        vm.prank(verifier);
        if (total > amount) {
            vm.expectRevert(GapBounty.PayoutOverflow.selector);
            gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
        } else {
            gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
            uint256 balSum = 0;
            for (uint256 i = 0; i < nPayouts; i++) {
                balSum += usdc.balanceOf(r[i]);
            }
            assertEq(usdc.balanceOf(address(gb)), 0);
            assertEq(balSum, total);
        }
    }

    /// @notice commitments can never exceed the cap, regardless of caller.
    function testFuzz_commitment_cap(uint8 cap, uint8 tries) public {
        cap = uint8(bound(cap, 1, 32));
        tries = uint8(bound(tries, cap, 64));
        vm.prank(requester);
        uint256 id = gb.createBounty(SPEC, verifier, AMOUNT, deadline, cap);
        uint256 ok = 0;
        for (uint256 i = 0; i < tries; i++) {
            bytes32 h = keccak256(abi.encode("e", i));
            if (ok >= cap) {
                vm.expectRevert(GapBounty.MaxSubmissionsReached.selector);
                gb.commitEvidence(id, h);
            } else {
                gb.commitEvidence(id, h);
                ok++;
            }
        }
        GapBounty.Bounty memory b = gb.getBounty(id);
        assertEq(b.commitments, cap);
    }

    /// @notice a stranger can never move escrowed funds.
    function testFuzz_no_theft(uint8 action, address attacker) public {
        vm.assume(
            attacker != requester &&
                attacker != verifier &&
                attacker != address(0) &&
                attacker != address(gb) && // gb holds the escrow itself
                attacker != address(usdc)
        );
        uint256 id = _create();
        address[] memory r = new address[](1);
        uint256[] memory amts = new uint256[](1);
        r[0] = attacker;
        amts[0] = AMOUNT;

        vm.startPrank(attacker);
        if (action % 3 == 0) {
            vm.expectRevert(GapBounty.NotVerifier.selector);
            gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
        } else if (action % 3 == 1) {
            vm.warp(deadline + 1);
            vm.expectRevert(GapBounty.NotRequester.selector);
            gb.cancel(id);
        } else {
            gb.commitEvidence(id, keccak256("x"));
            vm.expectRevert(GapBounty.NotVerifier.selector);
            gb.finalize(id, r, amts, keccak256("s"), keccak256("r"));
        }
        vm.stopPrank();
        assertEq(usdc.balanceOf(attacker), 0);
        assertEq(usdc.balanceOf(address(gb)), AMOUNT);
    }

    /* ── registry ─────────────────────────────────────────────────── */

    function test_registry_only_bounty_contract_can_anchor() public {
        vm.prank(stranger);
        vm.expectRevert(EvidenceReceiptRegistry.Unauthorized.selector);
        reg.anchor(keccak256("fake"), bytes32(uint256(0)));
    }

    function test_registry_address_is_bound() public view {
        assertEq(reg.bountyContract(), address(gb));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {EvidenceReceiptRegistry} from "./EvidenceReceiptRegistry.sol";

/// @title GapBounty
/// @notice USDC-escrowed evidence bounties for the gap402 protocol on Arc.
///
/// Lifecycle:
///   createBounty   (requester escrows USDC, pins specHash + verifier)
///   commitEvidence (suppliers pin content hashes while OPEN, before deadline)
///   finalize       (designated verifier posts settlement + receipt hash;
///                   contract pays recipients and refunds the remainder)
///   cancel         (requester reclaims escrow after deadline if unsettled)
///
/// Deliberately minimal: AI evaluation happens offchain; the contract only
/// enforces economic integrity (escrow, deadlines, exact payout accounting)
/// and durable commitments/receipts.
contract GapBounty {
    /* ── errors ─────────────────────────────────────────────────────── */
    error ZeroAddress();
    error ZeroAmount();
    error BadDeadline();
    error DeadlinePassed();
    error BadSpecHash();
    error BadHash();
    error BadCommitmentCap();
    error BadVerifier();
    error BountyMissing();
    error NotOpen();
    error NotRequester();
    error NotVerifier();
    error DeadlineNotReached();
    error MaxSubmissionsReached();
    error DuplicateCommitment();
    error PayoutLengthMismatch();
    error EmptyPayouts();
    error RecipientsNotCanonical();
    error PayoutOverflow();
    error TransferFailed();
    error Reentrancy();

    /* ── types ──────────────────────────────────────────────────────── */
    enum State {
        Open,
        Settled,
        Cancelled
    }

    struct Bounty {
        address requester;
        address verifier;
        uint96 amount; // escrowed USDC (6-decimal units)
        uint64 deadline;
        uint64 createdAt;
        State state;
        bytes32 specHash; // keccak256 of canonical GapRequest spec
        bytes32 settlementHash; // keccak256 of canonical SettlementPlan
        bytes32 receiptHash; // keccak256 of canonical EvidenceReceipt
        uint32 commitments; // evidence commitments count
        uint32 maxCommitments;
    }

    /* ── storage ────────────────────────────────────────────────────── */
    IERC20 public immutable usdc;
    EvidenceReceiptRegistry public immutable receiptRegistry;

    uint256 public nextBountyId;
    mapping(uint256 => Bounty) public bounties;
    /// bountyId => evidenceHash => supplier
    mapping(uint256 => mapping(bytes32 => address)) public commitments;
    /// reentrancy guard
    uint256 private _locked = 1;

    /* ── events ─────────────────────────────────────────────────────── */
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed requester,
        address indexed verifier,
        bytes32 specHash,
        uint96 amount,
        uint64 deadline
    );
    event EvidenceCommitted(
        uint256 indexed bountyId,
        bytes32 indexed evidenceHash,
        address indexed supplier
    );
    event BountySettled(
        uint256 indexed bountyId,
        bytes32 settlementHash,
        bytes32 receiptHash,
        uint256 totalPaid,
        uint256 refund
    );
    event BountyPayout(
        uint256 indexed bountyId,
        address indexed recipient,
        uint256 amount
    );
    event BountyCancelled(uint256 indexed bountyId, uint256 refund);

    /* ── modifiers ──────────────────────────────────────────────────── */
    modifier nonReentrant() {
        if (_locked == 2) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(IERC20 _usdc) {
        if (address(_usdc) == address(0)) revert ZeroAddress();
        usdc = _usdc;
        // The registry is deployed by and bound to this contract — a single
        // deployment yields a complete, immutable pair.
        receiptRegistry = new EvidenceReceiptRegistry(address(this));
    }

    /* ── bounty lifecycle ───────────────────────────────────────────── */

    /// @notice Create and fund a bounty. Caller must have approved `amount`
    /// USDC to this contract first. `specHash` binds the offchain spec.
    function createBounty(
        bytes32 specHash,
        address verifier,
        uint96 amount,
        uint64 deadline,
        uint32 maxCommitments
    ) external nonReentrant returns (uint256 bountyId) {
        if (specHash == bytes32(0)) revert BadSpecHash();
        if (verifier == address(0)) revert BadVerifier();
        if (amount == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert BadDeadline();
        if (maxCommitments == 0) revert BadCommitmentCap();

        bountyId = nextBountyId++;
        bounties[bountyId] = Bounty({
            requester: msg.sender,
            verifier: verifier,
            amount: amount,
            deadline: deadline,
            createdAt: uint64(block.timestamp),
            state: State.Open,
            specHash: specHash,
            settlementHash: bytes32(0),
            receiptHash: bytes32(0),
            commitments: 0,
            maxCommitments: maxCommitments
        });

        // effects complete; interaction last
        if (!usdc.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        emit BountyCreated(
            bountyId,
            msg.sender,
            verifier,
            specHash,
            amount,
            deadline
        );
    }

    /// @notice Pin an evidence content hash for a bounty while it is open.
    /// Suppliers prove submission time and content without trusting the API.
    function commitEvidence(
        uint256 bountyId,
        bytes32 evidenceHash
    ) external nonReentrant {
        Bounty storage b = _getOpen(bountyId);
        if (block.timestamp > b.deadline) revert DeadlinePassed();
        if (evidenceHash == bytes32(0)) revert BadHash();
        if (b.commitments >= b.maxCommitments) {
            revert MaxSubmissionsReached();
        }
        if (commitments[bountyId][evidenceHash] != address(0)) {
            revert DuplicateCommitment();
        }
        commitments[bountyId][evidenceHash] = msg.sender;
        unchecked {
            b.commitments += 1;
        }
        emit EvidenceCommitted(bountyId, evidenceHash, msg.sender);
    }

    /// @notice Settle a bounty: pay the verifier-approved allocation and
    /// refund any remainder to the requester.
    /// @param recipients canonical order required: strictly increasing
    ///        addresses (uniqueness + deterministic ordering, cheap check)
    function finalize(
        uint256 bountyId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 settlementHash,
        bytes32 receiptHash
    ) external nonReentrant {
        Bounty storage b = _getOpen(bountyId);
        if (msg.sender != b.verifier) revert NotVerifier();
        if (recipients.length == 0) revert EmptyPayouts();
        if (recipients.length != amounts.length) {
            revert PayoutLengthMismatch();
        }
        if (settlementHash == bytes32(0) || receiptHash == bytes32(0)) {
            revert BadHash();
        }

        // effects first
        b.state = State.Settled;
        b.settlementHash = settlementHash;
        b.receiptHash = receiptHash;

        uint256 total = 0;
        address prev = address(0);
        for (uint256 i = 0; i < recipients.length; i++) {
            address r = recipients[i];
            uint256 a = amounts[i];
            if (r == address(0)) revert ZeroAddress();
            if (a == 0) revert ZeroAmount();
            if (r <= prev) revert RecipientsNotCanonical();
            prev = r;
            total += a;
        }
        if (total > b.amount) revert PayoutOverflow();
        uint256 refund = uint256(b.amount) - total;

        // interactions
        for (uint256 i = 0; i < recipients.length; i++) {
            if (!usdc.transfer(recipients[i], amounts[i])) {
                revert TransferFailed();
            }
            emit BountyPayout(bountyId, recipients[i], amounts[i]);
        }
        if (refund > 0) {
            if (!usdc.transfer(b.requester, refund)) revert TransferFailed();
        }
        receiptRegistry.anchor(receiptHash, bytes32(bountyId));
        emit BountySettled(
            bountyId,
            settlementHash,
            receiptHash,
            total,
            refund
        );
    }

    /// @notice Reclaim escrow after the deadline if the bounty was never
    /// settled. Only the requester may cancel.
    function cancel(uint256 bountyId) external nonReentrant {
        Bounty storage b = _getOpen(bountyId);
        if (msg.sender != b.requester) revert NotRequester();
        if (block.timestamp <= b.deadline) revert DeadlineNotReached();
        b.state = State.Cancelled;
        uint256 refund = b.amount;
        if (!usdc.transfer(b.requester, refund)) revert TransferFailed();
        emit BountyCancelled(bountyId, refund);
    }

    /* ── views ──────────────────────────────────────────────────────── */

    function getBounty(
        uint256 bountyId
    ) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    function commitmentOf(
        uint256 bountyId,
        bytes32 evidenceHash
    ) external view returns (address) {
        return commitments[bountyId][evidenceHash];
    }

    function _getOpen(
        uint256 bountyId
    ) internal view returns (Bounty storage b) {
        b = bounties[bountyId];
        if (b.requester == address(0)) revert BountyMissing();
        if (b.state != State.Open) revert NotOpen();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IEvidenceReceiptRegistry} from "./interfaces/IEvidenceReceiptRegistry.sol";

/// @title EvidenceReceiptRegistry
/// @notice Durable, minimal anchor for gap402 Evidence Receipt hashes.
/// Only the GapBounty contract anchors receipts — one per settled bounty —
/// so every anchored hash is backed by a real settlement. Anyone can read.
contract EvidenceReceiptRegistry is IEvidenceReceiptRegistry {
    error NotAnchored();
    error AlreadyAnchored();
    error Unauthorized();

    address public immutable bountyContract;

    struct Anchor {
        bytes32 bountyRef; // GapBounty bountyId for the settled bounty
        uint64 anchoredAt;
        bool exists;
    }

    mapping(bytes32 receiptHash => Anchor) public anchors;

    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed bountyRef,
        uint64 anchoredAt
    );

    constructor(address _bountyContract) {
        if (_bountyContract == address(0)) revert Unauthorized();
        bountyContract = _bountyContract;
    }

    /// @inheritdoc IEvidenceReceiptRegistry
    function anchor(bytes32 receiptHash, bytes32 bountyRef) external {
        if (msg.sender != bountyContract) revert Unauthorized();
        if (receiptHash == bytes32(0)) revert NotAnchored();
        if (anchors[receiptHash].exists) revert AlreadyAnchored();
        anchors[receiptHash] = Anchor({
            bountyRef: bountyRef,
            anchoredAt: uint64(block.timestamp),
            exists: true
        });
        emit ReceiptAnchored(receiptHash, bountyRef, uint64(block.timestamp));
    }

    function isAnchored(bytes32 receiptHash) external view returns (bool) {
        return anchors[receiptHash].exists;
    }
}

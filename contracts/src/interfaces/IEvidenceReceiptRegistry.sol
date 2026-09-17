// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IEvidenceReceiptRegistry {
    /// @notice Anchor a receipt hash. Callable only by the GapBounty contract.
    function anchor(bytes32 receiptHash, bytes32 bountyRef) external;
}

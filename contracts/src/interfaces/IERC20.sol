// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

/// @title IERC20
/// @notice Minimal ERC20 / BEP20 surface used by the executor. Vendored inline so the
///         contract carries no external dependency. Return values are read defensively by
///         the SafeTransfer helpers because some BSC tokens do not return a bool.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}

// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

/// @title IPancakeV3SwapRouter
/// @notice Minimal subset of the PancakeSwap V3 SwapRouter interface, vendored inline.
///
/// Verified against the deployed PancakeSwap V3 SwapRouter on BNB Smart Chain mainnet
/// (chain id 56) at 0x1b81D678ffb9C0263b24A97847620C99d213eB14. Confirmed on-chain:
///   exactInputSingle selector 0x414bf389 (the struct that carries `deadline`) is present
///   in the deployed bytecode, and the no-deadline SwapRouter02 variant (0x04e45aaf) is not.
/// Source of the struct layout: pancakeswap/pancake-v3-contracts,
///   projects/v3-periphery/contracts/interfaces/ISwapRouter.sol.
///
/// This is the classic Uniswap-V3-style router interface (params include `deadline`), NOT the
/// SmartRouter / SwapRouter02 no-deadline variant. Any router address passed to the executor
/// must implement this exact interface, which is why routers are allowlisted by the owner.
interface IPancakeV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Single-hop exact-input swap. Uses a fee tier.
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);

    /// @notice Multi-hop exact-input swap along an encoded path.
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

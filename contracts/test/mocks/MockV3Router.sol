// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

import {IPancakeV3SwapRouter} from "../../src/interfaces/IPancakeV3SwapRouter.sol";
import {MockERC20} from "./MockERC20.sol";

/// @title MockV3Router
/// @notice Stand-in for the PancakeSwap V3 SwapRouter in unit tests. Implements the exact
///         vendored interface. It pulls tokenIn from the caller (the executor) and mints tokenOut
///         to the recipient. Knobs let a test simulate a bad fill (deliver less than requested) and
///         partial spend (leave USDT dust behind for the refund path). It deliberately does NOT
///         enforce amountOutMinimum by default, so the executor's own slippage check is what a
///         slippage test exercises.
contract MockV3Router {
    uint256 public amountOutOverride; // if > 0, deliver exactly this
    uint256 public rateNum = 1; // else amountOut = amountIn * rateNum / rateDen
    uint256 public rateDen = 1;
    uint256 public spendNum = 1; // pull amountIn * spendNum / spendDen from the executor
    uint256 public spendDen = 1;
    bool public enforceMin; // optionally mimic a real router that reverts on min

    function setAmountOut(uint256 v) external {
        amountOutOverride = v;
    }

    function setRate(uint256 n, uint256 d) external {
        rateNum = n;
        rateDen = d;
    }

    function setSpend(uint256 n, uint256 d) external {
        spendNum = n;
        spendDen = d;
    }

    function setEnforceMin(bool v) external {
        enforceMin = v;
    }

    function exactInputSingle(IPancakeV3SwapRouter.ExactInputSingleParams calldata p)
        external
        payable
        returns (uint256 amountOut)
    {
        amountOut = _swap(p.tokenIn, p.tokenOut, p.amountIn, p.amountOutMinimum, p.recipient);
    }

    function exactInput(IPancakeV3SwapRouter.ExactInputParams calldata p)
        external
        payable
        returns (uint256 amountOut)
    {
        address tokenIn = address(bytes20(p.path[0:20]));
        address tokenOut = address(bytes20(p.path[p.path.length - 20:p.path.length]));
        amountOut = _swap(tokenIn, tokenOut, p.amountIn, p.amountOutMinimum, p.recipient);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, address recipient)
        internal
        returns (uint256 amountOut)
    {
        uint256 pull = (amountIn * spendNum) / spendDen;
        require(MockERC20(tokenIn).transferFrom(msg.sender, address(this), pull), "pull failed");
        amountOut = amountOutOverride > 0 ? amountOutOverride : (amountIn * rateNum) / rateDen;
        if (enforceMin && amountOut < minOut) revert("Too little received");
        MockERC20(tokenOut).mint(recipient, amountOut);
    }
}

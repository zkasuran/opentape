// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {OpenTapeExecutor} from "../src/OpenTapeExecutor.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @title OpenTapeExecutorForkTest
/// @notice Optional BSC-mainnet fork test. It runs a real USDT -> WBNB swap through the deployed
///         PancakeSwap V3 SwapRouter. Guarded: with no BSC_RPC_URL in the env it skips cleanly, so
///         the default `forge test` gate does not depend on network access.
///
/// Run it with:  BSC_RPC_URL=https://bsc-dataseed.bnbchain.org forge test --match-contract Fork
contract OpenTapeExecutorForkTest is Test {
    // Verified on BSC mainnet (chain id 56).
    address internal constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address internal constant PANCAKE_V3_SWAP_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;
    address internal constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    function test_fork_realSwap_usdtToWbnb() public {
        string memory rpc = vm.envOr("BSC_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            emit log("BSC_RPC_URL not set; skipping fork test");
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 56, "expected BSC mainnet");

        OpenTapeExecutor executor = new OpenTapeExecutor(address(this), USDT, PANCAKE_V3_SWAP_ROUTER);

        address trader = makeAddr("trader");
        uint256 amountIn = 10e18; // 10 USDT (18 decimals on BSC)
        deal(USDT, trader, amountIn);

        vm.startPrank(trader);
        IERC20(USDT).approve(address(executor), amountIn);
        uint256 out = executor.executeRouteSingle(
            PANCAKE_V3_SWAP_ROUTER, WBNB, 500, amountIn, 1, trader, block.timestamp + 300
        );
        vm.stopPrank();

        assertGt(out, 0, "received WBNB");
        assertEq(IERC20(WBNB).balanceOf(trader), out, "trader holds the WBNB");
        assertEq(IERC20(USDT).balanceOf(address(executor)), 0, "no USDT left in executor");
    }
}

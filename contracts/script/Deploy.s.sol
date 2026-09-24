// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {OpenTapeExecutor} from "../src/OpenTapeExecutor.sol";

/// @title Deploy
/// @notice Deploys OpenTapeExecutor to BNB Smart Chain. It does NOT broadcast unless invoked with
///         --broadcast, and it never reads or prints a private key: the key is read at runtime from
///         the PRIVATE_KEY env (falling back to DEPLOYER_PRIVATE_KEY) via vm.envUint and handed
///         straight to the broadcast cheatcode.
///
/// Usage (run by the orchestrator in integration, not here):
///   forge script script/Deploy.s.sol:Deploy --rpc-url "$BSC_RPC_URL" --broadcast
contract Deploy is Script {
    /// @dev Verified PancakeSwap V3 SwapRouter on BSC mainnet (chain id 56).
    ///      Source: developer.pancakeswap.finance/contracts/v3/addresses. Confirmed on-chain.
    address internal constant PANCAKE_V3_SWAP_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;

    function run() external returns (OpenTapeExecutor executor) {
        uint256 deployerKey = _deployerKey();

        // address(0) lets the contract fall back to the house EOA (owner) and BSC USDT.
        address initialOwner = vm.envOr("OWNER", address(0));
        address usdt = vm.envOr("USDT", address(0));
        address router = vm.envOr("ROUTER", PANCAKE_V3_SWAP_ROUTER);

        vm.startBroadcast(deployerKey);
        executor = new OpenTapeExecutor(initialOwner, usdt, router);
        vm.stopBroadcast();

        console2.log("OpenTapeExecutor deployed at:", address(executor));
        console2.log("owner:", executor.owner());
        console2.log("usdt:", address(executor.usdt()));
        console2.log("router allowlisted:", router);
    }

    /// @dev Reads PRIVATE_KEY, then DEPLOYER_PRIVATE_KEY. Reverts if neither is set. The key value
    ///      is never logged.
    function _deployerKey() internal view returns (uint256 key) {
        key = vm.envOr("PRIVATE_KEY", uint256(0));
        if (key == 0) key = vm.envUint("DEPLOYER_PRIVATE_KEY");
    }
}

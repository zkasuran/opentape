// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {OpenTapeExecutor} from "../src/OpenTapeExecutor.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockV3Router} from "./mocks/MockV3Router.sol";

contract OpenTapeExecutorTest is Test {
    // events re-declared so expectEmit can match them
    event RouteExecuted(
        address indexed caller,
        address indexed recipient,
        address indexed router,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 minAmountOut
    );
    event DustRefunded(address indexed to, uint256 amount);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    OpenTapeExecutor internal executor;
    MockERC20 internal usdt;
    MockERC20 internal stock; // e.g. a tokenized-stock token like bAAPL
    MockV3Router internal router;

    address internal user = makeAddr("user");
    address internal recipient = makeAddr("recipient");

    uint256 internal constant START_BAL = 1_000e18;
    uint256 internal constant AMOUNT_IN = 100e18;
    uint256 internal deadline;

    function setUp() public {
        vm.warp(1_000);
        deadline = block.timestamp + 300;

        usdt = new MockERC20("Tether USD", "USDT", 18);
        stock = new MockERC20("bAAPL", "bAAPL", 18);
        router = new MockV3Router();

        // owner = this test contract; input token = mock USDT; allowlist the mock router.
        executor = new OpenTapeExecutor(address(this), address(usdt), address(router));

        usdt.mint(user, START_BAL);
        vm.prank(user);
        usdt.approve(address(executor), type(uint256).max);
    }

    function _path(address a, uint24 fee, address b) internal pure returns (bytes memory) {
        return abi.encodePacked(a, fee, b);
    }

    function test_constructorDefaults() public {
        // address(0) owner + usdt fall back to the house EOA and BSC USDT.
        OpenTapeExecutor e = new OpenTapeExecutor(address(0), address(0), address(0));
        assertEq(e.owner(), 0xDB6c6340342e71A63cD11Ebac2185204b7777777, "owner defaults to house EOA");
        assertEq(address(e.usdt()), 0x55d398326f99059fF775485246999027B3197955, "usdt defaults to BSC USDT");
    }

    function test_executeRouteSingle_happyPath_emitsAndDelivers() public {
        // 1:1 mock rate: 100 USDT -> 100 stock, all spent, none refunded.
        uint256 minOut = 90e18;

        vm.expectEmit(true, true, true, true, address(executor));
        emit RouteExecuted(user, recipient, address(router), address(stock), AMOUNT_IN, AMOUNT_IN, minOut);

        vm.prank(user);
        uint256 amountOut =
            executor.executeRouteSingle(address(router), address(stock), 500, AMOUNT_IN, minOut, recipient, deadline);

        assertEq(amountOut, AMOUNT_IN, "amountOut");
        assertEq(stock.balanceOf(recipient), AMOUNT_IN, "recipient received tokenOut");
        assertEq(usdt.balanceOf(user), START_BAL - AMOUNT_IN, "caller spent exactly amountIn");
        assertEq(usdt.balanceOf(address(executor)), 0, "no USDT stuck in executor");
        assertEq(usdt.allowance(address(executor), address(router)), 0, "approval reset to 0");
    }

    function test_executeRouteSingle_slippageRevert() public {
        // Mock delivers 80 but caller demands >= 90: the executor's own check must revert.
        router.setAmountOut(80e18);
        uint256 minOut = 90e18;

        vm.expectRevert(abi.encodeWithSelector(OpenTapeExecutor.InsufficientOutput.selector, 80e18, minOut));
        vm.prank(user);
        executor.executeRouteSingle(address(router), address(stock), 500, AMOUNT_IN, minOut, recipient, deadline);
    }

    function test_executeRouteSingle_dustRefunded() public {
        // Router spends 90% of the approved USDT: the 10% remainder is refunded to the caller.
        router.setSpend(9, 10);
        uint256 minOut = 90e18;
        uint256 expectedDust = AMOUNT_IN / 10;

        vm.expectEmit(true, false, false, true, address(executor));
        emit DustRefunded(user, expectedDust);

        vm.prank(user);
        executor.executeRouteSingle(address(router), address(stock), 500, AMOUNT_IN, minOut, recipient, deadline);

        assertEq(usdt.balanceOf(user), START_BAL - AMOUNT_IN + expectedDust, "dust returned to caller");
        assertEq(usdt.balanceOf(address(executor)), 0, "no USDT stuck in executor");
    }

    function test_executeRoutePath_happyPath() public {
        bytes memory path = _path(address(usdt), 500, address(stock));
        uint256 minOut = 90e18;

        vm.prank(user);
        uint256 amountOut = executor.executeRoutePath(address(router), path, AMOUNT_IN, minOut, recipient, deadline);

        assertEq(amountOut, AMOUNT_IN, "amountOut");
        assertEq(stock.balanceOf(recipient), AMOUNT_IN, "recipient received final token");
        assertEq(usdt.balanceOf(address(executor)), 0, "no USDT stuck in executor");
    }

    function test_executeRoutePath_rejectsWrongTokenIn() public {
        // Path must begin with USDT; a path starting with the stock is rejected.
        bytes memory path = _path(address(stock), 500, address(usdt));
        vm.expectRevert(OpenTapeExecutor.PathTokenInMismatch.selector);
        vm.prank(user);
        executor.executeRoutePath(address(router), path, AMOUNT_IN, 1, recipient, deadline);
    }

    function test_executeRoutePath_rejectsMalformedPath() public {
        bytes memory path = abi.encodePacked(address(usdt)); // 20 bytes, no hop
        vm.expectRevert(OpenTapeExecutor.InvalidPath.selector);
        vm.prank(user);
        executor.executeRoutePath(address(router), path, AMOUNT_IN, 1, recipient, deadline);
    }

    function test_rejectsUnallowlistedRouter() public {
        MockV3Router rogue = new MockV3Router();
        vm.expectRevert(OpenTapeExecutor.RouterNotAllowed.selector);
        vm.prank(user);
        executor.executeRouteSingle(address(rogue), address(stock), 500, AMOUNT_IN, 1, recipient, deadline);
    }

    function test_rejectsExpiredDeadline() public {
        uint256 past = block.timestamp - 1;
        vm.expectRevert(OpenTapeExecutor.DeadlinePassed.selector);
        vm.prank(user);
        executor.executeRouteSingle(address(router), address(stock), 500, AMOUNT_IN, 1, recipient, past);
    }

    function test_rejectsZeroMinAmountOut() public {
        vm.expectRevert(OpenTapeExecutor.ZeroAmount.selector);
        vm.prank(user);
        executor.executeRouteSingle(address(router), address(stock), 500, AMOUNT_IN, 0, recipient, deadline);
    }

    function test_setRouterAllowed_onlyOwner() public {
        vm.expectRevert(OpenTapeExecutor.NotOwner.selector);
        vm.prank(user);
        executor.setRouterAllowed(address(0x1234), true);
    }

    function test_setRouterAllowed_ownerCanToggle() public {
        address r = address(0x1234);
        executor.setRouterAllowed(r, true);
        assertTrue(executor.allowedRouters(r), "allowlisted");
        executor.setRouterAllowed(r, false);
        assertFalse(executor.allowedRouters(r), "removed");
    }

    function test_transferOwnership() public {
        executor.transferOwnership(user);
        assertEq(executor.owner(), user, "owner updated");
    }

    function test_rescue_ownerRecoversStrayTokens() public {
        stock.mint(address(executor), 5e18); // simulate tokens sent by mistake
        vm.expectEmit(true, true, false, true, address(executor));
        emit Rescued(address(stock), recipient, 5e18);
        executor.rescue(address(stock), recipient, 5e18);
        assertEq(stock.balanceOf(recipient), 5e18, "recovered");
    }

    function test_rescue_onlyOwner() public {
        vm.expectRevert(OpenTapeExecutor.NotOwner.selector);
        vm.prank(user);
        executor.rescue(address(stock), user, 1);
    }
}

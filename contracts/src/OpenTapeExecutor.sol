// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
pragma solidity 0.8.26;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPancakeV3SwapRouter} from "./interfaces/IPancakeV3SwapRouter.sol";

/// @title OpenTapeExecutor
/// @notice Thin "execute best route" contract for OpenTape on BNB Smart Chain. The caller
///         supplies a route chosen off-chain by the best-execution advisor, and the contract
///         pulls USDT from the caller, swaps it for the chosen token on a PancakeSwap V3 router,
///         enforces a minimum output, forwards the output to the recipient and refunds any USDT
///         dust. Spot only. No leverage, no custody between calls, no perps.
/// @dev    Only the caller's own funds are ever at risk: USDT is pulled from msg.sender and the
///         output goes to a recipient the caller names. Routers are allowlisted by the owner so a
///         phished caller cannot be steered into approving an arbitrary contract, and so the
///         vendored interface only ever meets a router that actually implements it.
contract OpenTapeExecutor {
    /// @notice Default admin used when the deployer passes address(0): the house EOA.
    address public constant DEFAULT_OWNER = 0xDB6c6340342e71A63cD11Ebac2185204b7777777;

    /// @notice USDT (Tether USD) on BNB Smart Chain mainnet. Verified on-chain (chain id 56):
    ///         name "Tether USD", symbol "USDT", decimals 18.
    address public constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;

    /// @notice The input token every route spends. Immutable, set at deploy (defaults to BSC USDT).
    IERC20 public immutable usdt;

    /// @notice Admin. Manages the router allowlist and can rescue stray tokens. Holds no user funds.
    address public owner;

    /// @notice Routers the executor is allowed to call and approve.
    mapping(address => bool) public allowedRouters;

    /// @dev Minimal non-reentrancy guard (1 = unlocked, 2 = entered).
    uint256 private _locked = 1;

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
    event RouterAllowed(address indexed router, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error RouterNotAllowed();
    error InsufficientOutput(uint256 received, uint256 minAmountOut);
    error DeadlinePassed();
    error InvalidPath();
    error PathTokenInMismatch();
    error Reentrancy();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    /// @param initialOwner  Admin address. address(0) defaults to the house EOA.
    /// @param usdt_         Input token. address(0) defaults to BSC USDT.
    /// @param initialRouter A PancakeSwap V3 router to allowlist at deploy (0 to skip).
    constructor(address initialOwner, address usdt_, address initialRouter) {
        owner = initialOwner == address(0) ? DEFAULT_OWNER : initialOwner;
        usdt = IERC20(usdt_ == address(0) ? BSC_USDT : usdt_);
        emit OwnershipTransferred(address(0), owner);
        if (initialRouter != address(0)) {
            allowedRouters[initialRouter] = true;
            emit RouterAllowed(initialRouter, true);
        }
    }

    // --- execution ---

    /// @notice Execute a single-hop USDT -> tokenOut swap on a PancakeSwap V3 router.
    /// @param router       Allowlisted PancakeSwap V3 SwapRouter.
    /// @param tokenOut     Token the caller wants to receive.
    /// @param fee          V3 pool fee tier (e.g. 100, 500, 2500, 10000).
    /// @param amountInUsdt USDT to spend, pulled from msg.sender.
    /// @param minAmountOut Minimum acceptable tokenOut. Enforced by the router and re-checked here.
    /// @param recipient    Who receives tokenOut.
    /// @param deadline     Unix time the swap must execute by.
    /// @return amountOut   tokenOut delivered to the recipient.
    function executeRouteSingle(
        address router,
        address tokenOut,
        uint24 fee,
        uint256 amountInUsdt,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        _preflight(router, tokenOut, amountInUsdt, minAmountOut, recipient, deadline);

        uint256 usdtBefore = usdt.balanceOf(address(this));
        _pullAndApprove(router, amountInUsdt);

        uint256 outBefore = IERC20(tokenOut).balanceOf(address(this));
        IPancakeV3SwapRouter(router).exactInputSingle(
            IPancakeV3SwapRouter.ExactInputSingleParams({
                tokenIn: address(usdt),
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountInUsdt,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - outBefore;

        _settle(router, tokenOut, recipient, amountInUsdt, amountOut, minAmountOut, usdtBefore);
    }

    /// @notice Execute a multi-hop swap along an encoded V3 path that MUST start with USDT.
    /// @param router       Allowlisted PancakeSwap V3 SwapRouter.
    /// @param path         V3 path: tokenIn(20) fee(3) token(20) ... tokenOut(20). First token = USDT.
    /// @param amountInUsdt USDT to spend, pulled from msg.sender.
    /// @param minAmountOut Minimum acceptable final token. Enforced by the router and re-checked here.
    /// @param recipient    Who receives the final token.
    /// @param deadline     Unix time the swap must execute by.
    /// @return amountOut   final token delivered to the recipient.
    function executeRoutePath(
        address router,
        bytes calldata path,
        uint256 amountInUsdt,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert DeadlinePassed();
        if (!allowedRouters[router]) revert RouterNotAllowed();
        if (amountInUsdt == 0 || minAmountOut == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        // A V3 path is one token (20) then repeated (fee 3 + token 20) segments.
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert InvalidPath();
        if (address(bytes20(path[0:20])) != address(usdt)) revert PathTokenInMismatch();
        address tokenOut = address(bytes20(path[path.length - 20:path.length]));

        uint256 usdtBefore = usdt.balanceOf(address(this));
        _pullAndApprove(router, amountInUsdt);

        uint256 outBefore = IERC20(tokenOut).balanceOf(address(this));
        IPancakeV3SwapRouter(router).exactInput(
            IPancakeV3SwapRouter.ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountInUsdt,
                amountOutMinimum: minAmountOut
            })
        );
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - outBefore;

        _settle(router, tokenOut, recipient, amountInUsdt, amountOut, minAmountOut, usdtBefore);
    }

    // --- internals ---

    function _preflight(
        address router,
        address tokenOut,
        uint256 amountInUsdt,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) internal view {
        if (block.timestamp > deadline) revert DeadlinePassed();
        if (!allowedRouters[router]) revert RouterNotAllowed();
        if (tokenOut == address(0) || recipient == address(0)) revert ZeroAddress();
        // minAmountOut must be non-zero so slippage protection is never silently disabled.
        if (amountInUsdt == 0 || minAmountOut == 0) revert ZeroAmount();
    }

    function _pullAndApprove(address router, uint256 amountInUsdt) internal {
        _safeTransferFrom(usdt, msg.sender, address(this), amountInUsdt);
        // Allowance was reset to 0 at the end of the previous call, so this set is always 0 -> n,
        // which even reset-requiring tokens accept.
        _safeApprove(usdt, router, amountInUsdt);
    }

    function _settle(
        address router,
        address tokenOut,
        address recipient,
        uint256 amountInUsdt,
        uint256 amountOut,
        uint256 minAmountOut,
        uint256 usdtBefore
    ) internal {
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        _safeTransfer(IERC20(tokenOut), recipient, amountOut);

        // Drop any leftover approval, then refund USDT this call did not spend to the caller.
        _safeApprove(usdt, router, 0);
        uint256 dust = usdt.balanceOf(address(this)) - usdtBefore;
        if (dust > 0) {
            _safeTransfer(usdt, msg.sender, dust);
            emit DustRefunded(msg.sender, dust);
        }
        emit RouteExecuted(msg.sender, recipient, router, tokenOut, amountInUsdt, amountOut, minAmountOut);
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _tokenCall(address(token), abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _tokenCall(address(token), abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }

    function _safeApprove(IERC20 token, address spender, uint256 amount) internal {
        _tokenCall(address(token), abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
    }

    /// @dev Low-level token call that accepts either no return data or a `true` bool, so it works
    ///      with BSC tokens that do not return a bool from transfer/approve.
    function _tokenCall(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }

    // --- admin ---

    /// @notice Add or remove a router from the allowlist.
    function setRouterAllowed(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        allowedRouters[router] = allowed;
        emit RouterAllowed(router, allowed);
    }

    /// @notice Hand admin to a new address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Recover tokens sent to the contract by mistake. It custodies nothing in normal use.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _safeTransfer(IERC20(token), to, amount);
        emit Rescued(token, to, amount);
    }
}

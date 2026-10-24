// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IMeritCoin is IERC20Metadata {
    function mint(address _to, uint256 _amount) external;

    function burn(uint256 _amount) external;
}

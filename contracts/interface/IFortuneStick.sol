// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IFortuneStick {
    function draw(address _to) external returns (uint256 _tokenId);

    function getStickNo(uint256 _tokenId) external view returns (address _tokenMinter, uint256 _stickNo);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FortuneStick is Ownable, ERC721Enumerable {
    using Strings for uint256;
    using Strings for address;

    address public immutable minter;

    string public baseURI;

    // tokenId => mint timestamp
    mapping(uint256 => uint256) public mintTime;

    mapping(uint256 => address) public tokenMinter;

    event SetBaseURI(address _sender, string _old, string _new);

    constructor(address _minter, string memory _baseURI_) Ownable() ERC721("Fortune Stick", "FS") {
        minter = _minter;
        baseURI = _baseURI_;
    }

    // ==================== non-view function ====================

    /**
     * @dev Draws a fortune stick (mint new NFT) for the specified address.
     * @param _to The address to receive the fortune stick.
     * @return _tokenId The ID of the fortune stick token.
     */
    function draw(address _to) external returns (uint256 _tokenId) {
        require(msg.sender == minter, "DrawFortuneStick: You are not minter");

        _tokenId = totalSupply();

        tokenMinter[_tokenId] = _to;
        mintTime[_tokenId] = block.timestamp;

        _safeMint(_to, _tokenId);
    }

    // ==================== view function ====================

    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        _requireMinted(_tokenId);

        (address _tokenMinter, uint256 _stickNo) = getStickNo(_tokenId);

        return
            bytes(_baseURI()).length > 0
                ? string(abi.encodePacked(_baseURI(), "/", _tokenId.toString(), "/", _stickNo.toString(), "_", _tokenMinter.toHexString(), "_", mintTime[_tokenId].toString(), ".json"))
                : "";
    }

    function getStickNo(uint256 _tokenId) public view returns (address _tokenMinter, uint256 _stickNo) {
        _tokenMinter = tokenMinter[_tokenId];
        uint256 _mintTime = mintTime[_tokenId];

        _stickNo = (uint256(keccak256(abi.encodePacked(address(this), _tokenId.toString(), _tokenMinter, _mintTime.toString()))) % 60) + 1;
    }

    // ==================== private function ====================

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    // ==================== owner function ====================

    function setBaseURI(string memory _new) external onlyOwner {
        string memory _old = baseURI;
        baseURI = _new;
        emit SetBaseURI(msg.sender, _old, _new);
    }
}

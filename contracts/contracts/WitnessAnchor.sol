// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract WitnessAnchor {
    event Anchored(bytes32 indexed contentHash, string ipfsCid, uint256 timestamp);
    
    mapping(bytes32 => uint256) public anchors;

    function anchor(bytes32 contentHash, string calldata ipfsCid) external {
        require(anchors[contentHash] == 0, "Already anchored");
        anchors[contentHash] = block.timestamp;
        emit Anchored(contentHash, ipfsCid, block.timestamp);
    }
}

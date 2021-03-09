pragma solidity =0.6.6;

import "../../contracts/Vester.sol";

contract VesterHarness is Vester {
	
	constructor(
		address imx_,
		address recipient_,
		uint vestingAmount_,
		uint vestingBegin_,
		uint vestingEnd_
	) public Vester(imx_, recipient_, vestingAmount_, vestingBegin_, vestingEnd_) {}
	
	
	uint _blockTimestamp;
	function getBlockTimestamp() public virtual override view returns (uint) {
		return _blockTimestamp;
	}
	function setBlockTimestamp(uint blockTimestamp) public {
		_blockTimestamp = blockTimestamp;
	}
	
}
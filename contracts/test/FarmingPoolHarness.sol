pragma solidity =0.6.6;

import "../../contracts/FarmingPool.sol";

contract FarmingPoolHarness is FarmingPool {
	
	constructor(
		address imx_,
		address claimable_,
		address borrowable_,
		address vester_
	) public FarmingPool(imx_, claimable_, borrowable_, vester_) {}
	
	
	uint _blockTimestamp;
	function getBlockTimestamp() public virtual override view returns (uint) {
		return _blockTimestamp;
	}
	function setBlockTimestamp(uint blockTimestamp) public {
		_blockTimestamp = blockTimestamp;
	}
	
}
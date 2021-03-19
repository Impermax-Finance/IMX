pragma solidity =0.6.6;
pragma experimental ABIEncoderV2;

import "./interfaces/IBorrowable.sol";
import "./interfaces/IFarmingPool.sol";

contract ClaimAggregator {

	constructor () public {}
	
	function trackBorrows(address account, address[] memory borrowables) public {
		for (uint i = 0; i < borrowables.length; i++) {
			IBorrowable(borrowables[i]).trackBorrow(account);
		}
	}
	
	function claims(address account, address[] memory farmingPools) public returns (uint amount) {
		for (uint i = 0; i < farmingPools.length; i++) {
			amount += IFarmingPool(farmingPools[i]).claimAccount(account);
		}
	}

}
pragma solidity >=0.5.0;

interface IFarmingPool {
	function imx() external pure returns (address);
	function claimable() external pure returns (address);
	function borrowable() external pure returns (address);
	function vestingBegin() external pure returns (uint);
	function segmentLength() external pure returns (uint);
	function recipients(address) external view returns (uint shares, uint lastShareIndex, uint credit);
	function totalShares() external view returns (uint);
	function shareIndex() external view returns (uint);
	function epochBegin() external view returns (uint);
	function epochAmount() external view returns (uint);
	function lastUpdate() external view returns (uint);
	
	function updateShareIndex() external returns (uint _shareIndex);
	function updateCredit(address account) external returns (uint credit);
	function advance() external;
	function claim() external returns (uint amount);
	function claimAccount(address account) external returns (uint amount);
	function trackBorrow(address borrower, uint borrowBalance, uint borrowIndex) external;
	
	event UpdateShareIndex(uint shareIndex);
	event UpdateCredit(address indexed account, uint lastShareIndex, uint credit);
	event Claim(address indexed account, uint amount);
	event EditRecipient(address indexed account, uint shares, uint totalShares);
	event Advance(uint epochBegin, uint epochAmount);
}
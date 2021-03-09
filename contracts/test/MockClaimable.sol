pragma solidity =0.6.6;

import "../interfaces/IImx.sol";
import "../interfaces/IClaimable.sol";

contract MockClaimable is IClaimable {

	address public immutable imx;
	address public recipient;
	
	constructor(
		address imx_,
		address recipient_
	) public {
		imx = imx_;
		recipient = recipient_;
	}

	function setRecipient(address recipient_) public {
		recipient = recipient_;
	}

	function claim() public override returns (uint amount) {
		amount = IImx(imx).balanceOf(address(this));
		IImx(imx).transfer(recipient, amount);
	}
}
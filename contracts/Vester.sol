pragma solidity =0.6.6;

import "./libraries/SafeMath.sol";
import "./interfaces/IImx.sol";
import "./interfaces/IClaimable.sol";
import "./interfaces/IVester.sol";

contract Vester is IVester, IClaimable {
	using SafeMath for uint;

	uint public constant override segments = 100;

	address public immutable imx;
	address public recipient;

	uint public immutable override vestingAmount;
	uint public immutable override vestingBegin;
	uint public immutable override vestingEnd;

	uint public previousPoint;
	uint public immutable finalPoint;
	
	function vestingCurve(uint x) public virtual pure returns (uint y) {
		uint speed = 1e18;
		for (uint i = 0; i < 100e16; i += 1e16) {
			if (x < i + 1e16) return y + speed * (x - i) / 1e16;
			y += speed;
			speed = speed * 976 / 1000;
		}
	}

	constructor(
		address imx_,
		address recipient_,
		uint vestingAmount_,
		uint vestingBegin_,
		uint vestingEnd_
	) public {
		require(vestingEnd_ > vestingBegin_, "Vester: END_TOO_EARLY");

		imx = imx_;
		recipient = recipient_;

		vestingAmount = vestingAmount_;
		vestingBegin = vestingBegin_;
		vestingEnd = vestingEnd_;

		previousPoint = 0;
		finalPoint = vestingCurve(1e18);
	}
	
	function claim() public virtual override returns (uint amount) {
		require(msg.sender == recipient, "Vester: UNAUTHORIZED");
		uint blockTimestamp = getBlockTimestamp();
		if (blockTimestamp < vestingBegin) return 0;
		if (blockTimestamp > vestingEnd) {
			amount = IImx(imx).balanceOf(address(this));
		} else {
			uint currentPoint = vestingCurve( (blockTimestamp - vestingBegin).mul(1e18).div(vestingEnd - vestingBegin) );
			amount = vestingAmount.mul(currentPoint - previousPoint).div(finalPoint);
			previousPoint = currentPoint;
		}
		if (amount > 0) IImx(imx).transfer(recipient, amount);
	}
	
	function setRecipient(address recipient_) public virtual {
		require(msg.sender == recipient, "Vester: UNAUTHORIZED");
		recipient = recipient_;
	}
	
	function getBlockTimestamp() public virtual view returns (uint) {
		return block.timestamp;
	}
}
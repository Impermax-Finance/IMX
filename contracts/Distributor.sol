pragma solidity =0.6.6;

import "./libraries/SafeMath.sol";
import "./interfaces/IImx.sol";
import "./interfaces/IClaimable.sol";

abstract contract Distributor is IClaimable {
	using SafeMath for uint;

	address public immutable imx;
	address public immutable claimable;

	struct Recipient {
		uint shares;
		uint lastShareIndex;
		uint credit;
	}
	mapping(address => Recipient) public recipients;
	
	uint public totalShares;
	uint public shareIndex;

	constructor (
		address imx_,
		address claimable_
	) public {
		imx = imx_;
		claimable = claimable_;
	}
	
	function updateShareIndex() public virtual nonReentrant returns (uint _shareIndex) {
		if (totalShares == 0) return shareIndex;
		uint amount = IClaimable(claimable).claim();
		if (amount == 0) return shareIndex;
		_shareIndex = amount.mul(2**160).div(totalShares).add(shareIndex);
		shareIndex = _shareIndex;
	}
	
	function updateCredit(address account) public returns (uint credit) {
		uint _shareIndex = updateShareIndex();
		if (_shareIndex == 0) return 0;
		Recipient storage recipient = recipients[account];
		credit = recipient.credit + _shareIndex.sub(recipient.lastShareIndex).mul(recipient.shares) / 2**160;
		recipient.lastShareIndex = _shareIndex;
		recipient.credit = credit;
	}

	function claim() public virtual override returns (uint credit) {
		credit = updateCredit(msg.sender);
		if (credit > 0) {
			recipients[msg.sender].credit = 0;
			IImx(imx).transfer(msg.sender, credit);
		}
	}
	
	function editRecipientInternal(address account, uint shares) internal {
		updateCredit(account);
		Recipient storage recipient = recipients[account];
		uint prevShares = recipient.shares;
		if (prevShares < shares) totalShares = totalShares.add(shares - prevShares);
		else totalShares = totalShares.sub(prevShares - shares);
		recipient.shares = shares;
	}
	
	// Prevents a contract from calling itself, directly or indirectly.
	bool internal _notEntered = true;
	modifier nonReentrant() {
		require(_notEntered, "Distributor: REENTERED");
		_notEntered = false;
		_;
		_notEntered = true;
	}
}
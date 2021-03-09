pragma solidity =0.6.6;

import "./Distributor.sol";

contract OwnedDistributor is Distributor {

	address public admin;

	constructor (
		address imx_,
		address claimable_,
		address admin_
	) public Distributor(imx_, claimable_) {
		admin = admin_;
	}

	function editRecipient(address account, uint shares) public virtual {
		require(msg.sender == admin, "OwnedDistributor: UNAUTHORIZED");
		editRecipientInternal(account, shares);
	}

	function setAdmin(address admin_) public virtual {
		require(msg.sender == admin, "OwnedDistributor: UNAUTHORIZED");
		admin = admin_;
	}
}
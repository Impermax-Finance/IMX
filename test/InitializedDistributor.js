const {
	expectEqual,
	expectEvent,
	expectRevert,
	expectAlmostEqualMantissa,
	bnMantissa,
	BN,
} = require('./Utils/JS');
const {
	address,
	increaseTime,
	encode,
} = require('./Utils/Ethereum');

const Imx = artifacts.require('Imx');
const MockClaimable = artifacts.require('MockClaimable');
const InitializedDistributor = artifacts.require('InitializedDistributor');

const oneMantissa = (new BN(10)).pow(new BN(18));

contract('InitializedDistributor', function (accounts) {
	let root = accounts[0];
	let recipientA = accounts[3];
	let recipientB = accounts[4];
	let recipientC = accounts[5];
	
	let imx;
	let claimable;
	let distributor;
	
	before(async () => {
		imx = await Imx.new(root);
		claimable = await MockClaimable.new(imx.address, address(0));
		distributor = await InitializedDistributor.new(imx.address, claimable.address, [
			encode(['address', 'uint256'], [recipientA, '1000']),
			encode(['address', 'uint256'], [recipientB, '1000']),
			encode(['address', 'uint256'], [recipientC, '2000']),
		]);
		claimable.setRecipient(distributor.address);
	});
				
	it("scenario", async () => {
		await imx.transfer(claimable.address, "4000");
		await distributor.claim({from: recipientA});
		await distributor.claim({from: recipientB});
		await distributor.claim({from: recipientC});
		
		let shareIndex = await distributor.shareIndex();
		expectEqual(shareIndex / 2**160, 1);
		expectEqual(await imx.balanceOf(distributor.address), 0);
		
		expectEqual(await imx.balanceOf(recipientA), 1000);
		expectEqual(await imx.balanceOf(recipientB), 1000);
		expectEqual(await imx.balanceOf(recipientC), 2000);
	});
	
});
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
const OwnedDistributor = artifacts.require('OwnedDistributor');

const oneMantissa = (new BN(10)).pow(new BN(18));

contract('OwnedDistributor', function (accounts) {
	let root = accounts[0];
	let admin = accounts[1];
	let admin2 = accounts[2];
	let recipientA = accounts[3];
	let recipientB = accounts[4];
	let recipientC = accounts[5];
	
	let imx;
	let claimable;
	let distributor;
	
	before(async () => {
		imx = await Imx.new(root);
		claimable = await MockClaimable.new(imx.address, address(0));
	});
	
	describe("admin", () => {
		before(async () => {
			distributor = await OwnedDistributor.new(imx.address, claimable.address, admin);
		});
		
		it("change admin", async () => {
			await expectRevert(distributor.setAdmin(root, {from: root}), "OwnedDistributor: UNAUTHORIZED");
			await distributor.setAdmin(root, {from: admin});
			expect(await distributor.admin()).to.eq(root);
			await distributor.setAdmin(admin, {from: root});
			expect(await distributor.admin()).to.eq(admin);
		});
		
		it("permissions check", async () => {
			await expectRevert(distributor.editRecipient(recipientA, "10", {from:root}), "OwnedDistributor: UNAUTHORIZED");
			await distributor.editRecipient(recipientA, "10", {from:admin});
		});
	});
	
	describe("real case scenario", () => {
		before(async () => {
			distributor = await OwnedDistributor.new(imx.address, claimable.address, admin);
			claimable.setRecipient(distributor.address);
		});	
				
		it("scenario", async () => {
			await distributor.editRecipient(recipientA, "10", {from:admin});
			await imx.transfer(claimable.address, "1000");
			await distributor.editRecipient(recipientB, "15", {from:admin});
			await imx.transfer(claimable.address, "1000");
			await distributor.updateCredit(recipientB);
			await imx.transfer(claimable.address, "1000");
			await distributor.editRecipient(recipientB, "10", {from:admin});
			await imx.transfer(claimable.address, "1000"); 
			await distributor.editRecipient(recipientC, "20", {from:admin});
			await imx.transfer(claimable.address, "1000");
			await distributor.editRecipient(recipientA, "0", {from:admin});
			await imx.transfer(claimable.address, "900");
			await distributor.editRecipient(recipientB, "20", {from:admin});
			await imx.transfer(claimable.address, "1000");
			await distributor.claim({from: recipientA});
			await distributor.claim({from: recipientB});
			await distributor.claim({from: recipientC});
			
			let shareIndex = await distributor.shareIndex();
			expectEqual(shareIndex / 2**160, 310);
			expectEqual(await imx.balanceOf(distributor.address), 0);
			
			expectEqual(await imx.balanceOf(recipientA), 2550);
			expectEqual(await imx.balanceOf(recipientB), 2750);
			expectEqual(await imx.balanceOf(recipientC), 1600);
		});		
	});
	
});
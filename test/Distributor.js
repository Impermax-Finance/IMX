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
const Distributor = artifacts.require('DistributorHarness');

const oneMantissa = (new BN(10)).pow(new BN(18));

contract('Distributor', function (accounts) {
	let root = accounts[0];
	let recipientA = accounts[3];
	let recipientB = accounts[4];
	let recipientC= accounts[5];
	
	let imx;
	let claimable;
	let distributor;
	
	before(async () => {
		imx = await Imx.new(root);
		claimable = await MockClaimable.new(imx.address, address(0));
	});
	
	describe("updateShareIndex", () => {
		before(async () => {
			distributor = await Distributor.new(imx.address, claimable.address);
			claimable.setRecipient(distributor.address);
		});
	
		it("if the amount = 0 nothing happen", async () => {
			const shareIndex = await distributor.updateShareIndex.call();
			await distributor.updateShareIndex();
			expectEqual(shareIndex, 0);
			expectEqual(shareIndex, await distributor.shareIndex());
			expectEqual(await imx.balanceOf(distributor.address), 0);
		});
	
		it("if the totalShares = 0 nothing happen", async () => {
			await imx.transfer(claimable.address, "1000");
			const shareIndex = await distributor.updateShareIndex.call();
			await distributor.updateShareIndex();
			expectEqual(shareIndex, 0);
			expectEqual(shareIndex, await distributor.shareIndex());
			expectEqual(await imx.balanceOf(distributor.address), 0);
		});
		
		it("first shareIndex calculation", async () => {
			await distributor.setRecipientShares(recipientA, "10");
			const shareIndex = await distributor.updateShareIndex.call();
			const receipt = await distributor.updateShareIndex();
			expectEqual(shareIndex / 2**160, 100);
			expectEqual(shareIndex, await distributor.shareIndex());
			expectEqual(await imx.balanceOf(distributor.address), 1000);
			expectEvent(receipt, 'UpdateShareIndex', {
				shareIndex: await distributor.shareIndex(),
			});
		});
		
		it("second shareIndex calculation", async () => {
			await imx.transfer(claimable.address, "1000");
			await distributor.setRecipientShares(recipientA, "10");
			const shareIndex = await distributor.updateShareIndex.call();
			await distributor.updateShareIndex();
			expectEqual(shareIndex / 2**160, 200);
			expectEqual(shareIndex, await distributor.shareIndex());
			expectEqual(await imx.balanceOf(distributor.address), 2000);
		});
	});
	
	describe("updateCredit", () => {
		before(async () => {
			distributor = await Distributor.new(imx.address, claimable.address);
			claimable.setRecipient(distributor.address);
		});
	
		it("if the shareIndex = 0 nothing happen", async () => {
			let amount = await distributor.updateCredit.call(recipientA);
			await distributor.updateCredit(recipientA);
			expectEqual(await distributor.shareIndex(), 0);
			expectEqual(amount, 0);
			
			await imx.transfer(claimable.address, "1000");
			amount = await distributor.updateCredit.call(recipientA);
			await distributor.updateCredit(recipientA);
			expectEqual(await distributor.shareIndex(), 0);
			expectEqual(amount, 0);
			
			const r = await distributor.recipients(recipientA);
			expectEqual(r.lastShareIndex, 0);
			expectEqual(r.credit, 0);
		});
		
		it("if there is only 1 recipient, all tokens will go to him", async () => {
			await distributor.setRecipientShares(recipientA, "10");
			let amount = await distributor.updateCredit.call(recipientA);
			const receipt = await distributor.updateCredit(recipientA);
			const r = await distributor.recipients(recipientA);
			expectEqual(r.lastShareIndex, await distributor.shareIndex());
			expectEqual(r.credit, 1000);
			expectEqual(amount, r.credit);
			expectEvent(receipt, 'UpdateCredit', {
				account: recipientA,
				lastShareIndex: await distributor.shareIndex(),
				credit: '1000',
			});
		});
		
		it("if there are multiple recipients, tokens will be distributed based on shares", async () => {
			await distributor.setRecipientShares(recipientB, "15");
			await imx.transfer(claimable.address, "2000");
			let amount = await distributor.updateCredit.call(recipientA);
			await distributor.updateCredit(recipientA);
			let r = await distributor.recipients(recipientA);
			expectEqual(r.lastShareIndex, await distributor.shareIndex());
			expectEqual(r.credit, 1800);
			expectEqual(amount, r.credit);
			
			await distributor.setRecipientShares(recipientC, "25");
			await imx.transfer(claimable.address, "3000");
			amount = await distributor.updateCredit.call(recipientC);
			await distributor.updateCredit(recipientC);
			r = await distributor.recipients(recipientC);
			expectEqual(r.lastShareIndex, await distributor.shareIndex());
			expectEqual(r.credit, 1500);
			expectEqual(amount, r.credit);
			
			amount = await distributor.updateCredit.call(recipientA);
			await distributor.updateCredit(recipientA);
			r = await distributor.recipients(recipientA);
			expectEqual(r.lastShareIndex, await distributor.shareIndex());
			expectEqual(r.credit, 2400);
			expectEqual(amount, r.credit);
			
			amount = await distributor.updateCredit.call(recipientB);
			await distributor.updateCredit(recipientB);
			r = await distributor.recipients(recipientB);
			expectEqual(r.lastShareIndex, await distributor.shareIndex());
			expectEqual(r.credit, 2100);
			expectEqual(amount, r.credit);
		});
	});
		
	describe("claim", () => {
		before(async () => {
			distributor = await Distributor.new(imx.address, claimable.address);
			claimable.setRecipient(distributor.address);
		});
	
		it("if the totalShares = 0 nothing happen", async () => {
			await imx.transfer(claimable.address, "1000");
			await distributor.claim({from: recipientA});
			const shareIndex = await distributor.shareIndex();
			expectEqual(shareIndex, 0);
		});
		
		it("if there is only 1 recipient, all tokens will go to him", async () => {
			await distributor.setRecipientShares(recipientA, "10");
			const receipt = await distributor.claim({from: recipientA});
			const shareIndex = await distributor.shareIndex();
			const r = await distributor.recipients(recipientA);
			expectEqual(shareIndex / 2**160, 100);
			expectEqual(r.lastShareIndex, shareIndex);
			expectEqual(r.credit, 0);
			expectEqual(await imx.balanceOf(recipientA), 1000);
			expectEvent(receipt, 'Claim', {
				account: recipientA,
				amount: '1000',
			});
		});
		
		it("if there are multiple recipients, tokens will be distributed based on shares", async () => {
			await distributor.setRecipientShares(recipientB, "15");
			await imx.transfer(claimable.address, "2000");
			await distributor.updateCredit(recipientA);
			let shareIndex = await distributor.shareIndex();
			let r = await distributor.recipients(recipientA);
			expectEqual(shareIndex / 2**160, 180);
			expectEqual(r.lastShareIndex, shareIndex);
			expectEqual(r.credit, 800);
			expectEqual(await imx.balanceOf(recipientA), 1000);
			
			await distributor.setRecipientShares(recipientC, "25");
			await imx.transfer(claimable.address, "3000");
			await distributor.claim({from: recipientC});
			shareIndex = await distributor.shareIndex();
			r = await distributor.recipients(recipientC);
			expectEqual(shareIndex / 2**160, 240);
			expectEqual(r.lastShareIndex, shareIndex);
			expectEqual(r.credit, 0);
			expectEqual(await imx.balanceOf(recipientC), 1500);
			
			await distributor.claim({from: recipientA});
			shareIndex = await distributor.shareIndex();
			r = await distributor.recipients(recipientA);
			expectEqual(shareIndex / 2**160, 240);
			expectEqual(r.lastShareIndex, shareIndex);
			expectEqual(r.credit, 0);
			expectEqual(await imx.balanceOf(recipientA), 2400);
			
			await distributor.claim({from: recipientB});
			shareIndex = await distributor.shareIndex();
			r = await distributor.recipients(recipientB);
			expectEqual(shareIndex / 2**160, 240);
			expectEqual(r.lastShareIndex, shareIndex);
			expectEqual(r.credit, 0);
			expectEqual(await imx.balanceOf(recipientB), 2100);
		});
		
		it("claim returns claimed amount", async () => {
			await imx.transfer(claimable.address, "3000");
			expectEqual(await distributor.claim.call({from: recipientC}), 1500);
			await distributor.claim({from: recipientC});
		});
	});

	describe("editRecipient", () => {
		before(async () => {
			distributor = await Distributor.new(imx.address, claimable.address);
			claimable.setRecipient(distributor.address);
			await imx.transfer(address(1), await imx.balanceOf(recipientA), {from:recipientA});
			await imx.transfer(address(1), await imx.balanceOf(recipientB), {from:recipientB});
			await imx.transfer(address(1), await imx.balanceOf(recipientC), {from:recipientC});
		});	
		
		it("increasing a user shares increases totalShare", async () => {
			const receipt = await distributor.editRecipientHarness(recipientA, "10");
			expectEqual(await distributor.totalShares(), 10);
			const {shares} = await distributor.recipients(recipientA);
			expectEqual(shares, 10);
			expectEvent(receipt, 'EditRecipient', {
				account: recipientA,
				shares: '10',
				totalShares: '10',
			});
		});
		
		it("decreasing a user shares decreases totalShare", async () => {
			await distributor.editRecipientHarness(recipientA, "5");
			expectEqual(await distributor.totalShares(), 5);
			const {shares} = await distributor.recipients(recipientA);
			expectEqual(shares, 5);
		});
		
		it("editRecipient updates shareIndex", async () => {
			await imx.transfer(claimable.address, "1000");
			await distributor.editRecipientHarness(recipientB, "5");
			expectEqual(await distributor.totalShares(), 10);
			const shareIndex = await distributor.shareIndex();
			const {shares, lastShareIndex} = await distributor.recipients(recipientB);
			expectEqual(shares, 5);
			expectEqual(shareIndex / 2**160, 200);
			expectEqual(lastShareIndex, shareIndex);
		});
		
		it("editRecipient calls updateCredit before editing shares", async () => {
			await distributor.editRecipientHarness(recipientA, "0");
			expectEqual(await distributor.totalShares(), 5);
			const shareIndex = await distributor.shareIndex();
			const {shares, lastShareIndex, credit} = await distributor.recipients(recipientA);
			expectEqual(shares, 0);
			expectEqual(shareIndex / 2**160, 200);
			expectEqual(lastShareIndex, shareIndex);
			expectEqual(credit, 1000);
		});
	});
});
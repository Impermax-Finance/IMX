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
const VesterStepped = artifacts.require('VesterSteppedHarness');
const VesterOneStep = artifacts.require('VesterOneStep');
const OwnedDistributor = artifacts.require('OwnedDistributor');
const FarmingPool = artifacts.require('FarmingPoolHarness');

const oneMantissa = (new BN(10)).pow(new BN(18));
const SHARES_MULTIPLIER = (new BN(2)).pow(new BN(96));
const SHARE_INDEX_MULTIPLIER = (new BN(2)).pow(new BN(160));
const VESTING_AMOUNT = oneMantissa.mul(new BN(80000000));
const VESTING_BEGIN = new BN(1600000000);
const VESTING_PERIOD = new BN(100 * 14 * 24 * 3600);
const VESTING_END = VESTING_BEGIN.add(VESTING_PERIOD);

const BORROW_INDEX_1 = oneMantissa;
const BORROWED_A_1 = oneMantissa.mul(new BN(10));
const BORROW_INDEX_2 = oneMantissa.mul(new BN(20)).div(new BN(10));
const BORROWED_B_1 = oneMantissa.mul(new BN(30));
const BORROWED_B_2 = oneMantissa.mul(new BN(20));
const BORROW_INDEX_3 = oneMantissa.mul(new BN(30)).div(new BN(10));
const BORROWED_C_1 = oneMantissa.mul(new BN(60));
const BORROWED_B_3 = oneMantissa.mul(new BN(60));

let claimable;
let farmingPool;

async function setTimestamp(timestamp, others = []) {
	await vester.setBlockTimestamp(timestamp);
	await farmingPool.setBlockTimestamp(timestamp);
	for(let x of others) {
		await x.setBlockTimestamp(timestamp);
	}
}

contract('FarmingPool', function (accounts) {
	let root = accounts[0];
	let borrowable = accounts[1];
	let borrowerA = accounts[2];
	let borrowerB = accounts[3];
	let borrowerC = accounts[4];
	let admin = accounts[5];
	let borrowable2 = accounts[6];
	
	let imx;

	describe("advance onestep", () => {
		before(async () => {
			imx = await Imx.new(root);
			vester = await VesterOneStep.new(imx.address, root, VESTING_AMOUNT, VESTING_BEGIN, VESTING_END);
			await imx.transfer(vester.address, VESTING_AMOUNT);
			farmingPool = await FarmingPool.new(imx.address, vester.address, borrowable, vester.address);
			await vester.setRecipient(farmingPool.address);
			await setTimestamp(VESTING_BEGIN.sub(new BN(1)));
			await farmingPool.trackBorrow(borrowerA, oneMantissa, oneMantissa, {from:borrowable});
		});
	
		it("before vestingBegin nothing happen", async () => {
			await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), 0);
			expectEqual(await farmingPool.lastUpdate(), 0);
			expectEqual(await farmingPool.epochAmount(), 0);
			expectEqual(await farmingPool.shareIndex(), 0);
		});
	
		it("after vestingBegin the first time", async () => {
			const updateTime = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(1)).div(new BN(10)));
			await setTimestamp(updateTime);
			await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), VESTING_BEGIN);
			expectEqual(await farmingPool.lastUpdate(), VESTING_BEGIN);
			expectEqual(await farmingPool.epochAmount(), VESTING_AMOUNT);
			expectEqual(await farmingPool.shareIndex(), 0);
		});
	
		it("following advance have no effect", async () => {
			const updateTime1 = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(2)).div(new BN(10)));
			const updateTime2 = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(11)).div(new BN(10)));
			await setTimestamp(updateTime1);
			await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), VESTING_BEGIN);
			expectEqual(await farmingPool.lastUpdate(), VESTING_BEGIN);
			expectEqual(await farmingPool.epochAmount(), VESTING_AMOUNT);
			expectEqual(await farmingPool.shareIndex(), 0);
			await setTimestamp(updateTime2);
			await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), VESTING_BEGIN);
			expectEqual(await farmingPool.lastUpdate(), VESTING_BEGIN);
			expectEqual(await farmingPool.epochAmount(), VESTING_AMOUNT);
			expectEqual(await farmingPool.shareIndex(), 0);
		});
	});

	describe("advance stepped", () => {
		const epochAmount1 = VESTING_AMOUNT.mul(new BN(77076)).div(new BN(1000000));
		const epochAmount2 = VESTING_AMOUNT.mul(new BN(24469)).div(new BN(1000000));
		const epochAmount3 = VESTING_AMOUNT.mul(new BN(47190)).div(new BN(1000000));
		before(async () => {
			imx = await Imx.new(root);
			vester = await VesterStepped.new(imx.address, root, VESTING_AMOUNT, VESTING_BEGIN, VESTING_END);
			await imx.transfer(vester.address, VESTING_AMOUNT);
			farmingPool = await FarmingPool.new(imx.address, vester.address, borrowable, vester.address);
			await vester.setRecipient(farmingPool.address);
			await setTimestamp(VESTING_BEGIN.sub(new BN(1)));
			await farmingPool.trackBorrow(borrowerA, oneMantissa, oneMantissa, {from:borrowable});
		});
	
		it("starting after a few epochs", async () => {
			const updateTime = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(25)).div(new BN(1000)));
			const epochBegin = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(20)).div(new BN(1000)));
			await setTimestamp(updateTime);
			await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), epochBegin);
			expectEqual(await farmingPool.lastUpdate(), epochBegin);
			expectAlmostEqualMantissa(await farmingPool.epochAmount(), epochAmount1);
			expectEqual(await farmingPool.shareIndex(), 0);
		});
	
		it("going to the next epoch", async () => {
			const updateTime = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(37)).div(new BN(1000)));
			const epochBegin = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(30)).div(new BN(1000)));
			await setTimestamp(updateTime);
			const receipt = await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), epochBegin);
			expectEqual(await farmingPool.lastUpdate(), epochBegin);
			expectAlmostEqualMantissa(await farmingPool.epochAmount(), epochAmount2);
			expectAlmostEqualMantissa(await farmingPool.shareIndex(), epochAmount1.mul(SHARE_INDEX_MULTIPLIER).div(SHARES_MULTIPLIER));
			expectEvent(receipt, 'UpdateShareIndex', {
				shareIndex: await farmingPool.shareIndex(),
			});
			expectEvent(receipt, 'Advance', {
				epochBegin: epochBegin,
				epochAmount: await farmingPool.epochAmount(),
			});
		});
	
		it("skipping epochs", async () => {
			const updateTime = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(51)).div(new BN(1000)));
			const epochBegin = VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(50)).div(new BN(1000)));
			await setTimestamp(updateTime);
			await farmingPool.advance();
			expectEqual(await farmingPool.epochBegin(), epochBegin);
			expectEqual(await farmingPool.lastUpdate(), epochBegin);
			expectAlmostEqualMantissa(await farmingPool.epochAmount(), epochAmount3);
			expectAlmostEqualMantissa(await farmingPool.shareIndex(), epochAmount1.add(epochAmount2).mul(SHARE_INDEX_MULTIPLIER).div(SHARES_MULTIPLIER));
			await farmingPool.claim({from:borrowerA});
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerA), epochAmount1.add(epochAmount2).add(epochAmount3.div(new BN(10))));
		});
	});
	
	describe("trackBorrow", () => {
		before(async () => {
			imx = await Imx.new(root);
			vester = await VesterOneStep.new(imx.address, root, VESTING_AMOUNT, VESTING_BEGIN, VESTING_END);
			await imx.transfer(vester.address, VESTING_AMOUNT);
			farmingPool = await FarmingPool.new(imx.address, vester.address, borrowable, vester.address);
			await vester.setRecipient(farmingPool.address);
			await setTimestamp(VESTING_BEGIN.sub(new BN(1)));
		});

		it("permissions check", async () => {
			await expectRevert(farmingPool.trackBorrow(borrowerA, oneMantissa, oneMantissa, {from:root}), "FarmingPool: UNAUTHORIZED");
		});
		
		it("increasing a user shares increases totalShare", async () => {
			await farmingPool.trackBorrow(borrowerA, oneMantissa.mul(new BN(16)), oneMantissa, {from:borrowable});
			expectEqual(await farmingPool.totalShares(), SHARES_MULTIPLIER.mul(new BN(16)));
			const {shares} = await farmingPool.recipients(borrowerA);
			expectEqual(shares, SHARES_MULTIPLIER.mul(new BN(16)));
		});
		
		it("decreasing a user shares decreases totalShare", async () => {
			await farmingPool.trackBorrow(borrowerA, oneMantissa.mul(new BN(16)), oneMantissa.mul(new BN(2)), {from:borrowable});
			expectEqual(await farmingPool.totalShares(), SHARES_MULTIPLIER.mul(new BN(8)));
			const {shares} = await farmingPool.recipients(borrowerA);
			expectEqual(shares, SHARES_MULTIPLIER.mul(new BN(8)));
		});
		
		it("trackBorrow updates shareIndex before updating shares", async () => {
			const INV_TIME = new BN(10);
			const SHARES = SHARES_MULTIPLIER.mul(new BN(8));
			await setTimestamp(VESTING_BEGIN);
			await farmingPool.advance();
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.div(INV_TIME)));
			await farmingPool.trackBorrow(borrowerB, oneMantissa.mul(new BN(32)), oneMantissa.mul(new BN(4)), {from:borrowable});
			expectEqual(await farmingPool.totalShares(), SHARES.mul(new BN(2)));
			const shareIndex = await farmingPool.shareIndex();
			const {shares, lastShareIndex} = await farmingPool.recipients(borrowerB);
			expectEqual(shares, SHARES);
			expectEqual(shareIndex, VESTING_AMOUNT.mul(SHARE_INDEX_MULTIPLIER).div(INV_TIME).div(SHARES));
			expectEqual(lastShareIndex, shareIndex);
		});
		
		it("trackBorrow set to 0 and calls updateCredit before editing shares", async () => {
			const INV_TIME = new BN(5);
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.div(new BN(INV_TIME))));
			await farmingPool.trackBorrow(borrowerA, '0', oneMantissa.mul(new BN(5)), {from:borrowable});
			expectEqual(await farmingPool.totalShares(), SHARES_MULTIPLIER.mul(new BN(8)));
			const {shares, credit} = await farmingPool.recipients(borrowerA);
			expectEqual(shares, 0);
			expectEqual(credit, VESTING_AMOUNT.div(INV_TIME).mul(new BN(3)).div(new BN(4)));
		});
	});
	

	describe("scenario", () => {
		before(async () => {
			imx = await Imx.new(root);
			vester = await VesterStepped.new(imx.address, root, VESTING_AMOUNT, VESTING_BEGIN, VESTING_END);
			await imx.transfer(vester.address, VESTING_AMOUNT);
			distributor = await OwnedDistributor.new(imx.address, vester.address, admin);
			farmingPool = await FarmingPool.new(imx.address, distributor.address, borrowable, vester.address);
			farmingPool2 = await FarmingPool.new(imx.address, distributor.address, borrowable2, vester.address);
			await vester.setRecipient(distributor.address);
			await distributor.editRecipient(farmingPool.address, "100", {from:admin});
		});
	
		it("first epochs with only a farmingPool", async () => {
			await setTimestamp(VESTING_BEGIN.sub(new BN(1)));
			await farmingPool.trackBorrow(borrowerA, oneMantissa, oneMantissa, {from:borrowable});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(5)).div(new BN(1000))));
			await farmingPool.claim({from:borrowerA});
			await farmingPool.trackBorrow(borrowerB, oneMantissa.mul(new BN(2)), oneMantissa, {from:borrowable});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(15)).div(new BN(1000))));
			await farmingPool.claim({from:borrowerA});
			await farmingPool.trackBorrow(borrowerC, oneMantissa.mul(new BN(2)), oneMantissa.mul(new BN(2)), {from:borrowable});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(20)).div(new BN(1000))));
			await farmingPool.claim({from:borrowerB});
			await farmingPool.trackBorrow(borrowerB, 0, oneMantissa, {from:borrowable});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(25)).div(new BN(1000))));
			await farmingPool.trackBorrow(borrowerA, oneMantissa.mul(new BN(4)), oneMantissa.mul(new BN(2)), {from:borrowable});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(30)).div(new BN(1000))));
			await farmingPool.claim({from:borrowerA});
			await farmingPool.claim({from:borrowerC});
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerA), VESTING_AMOUNT.mul(new BN(39662)).div(new BN(1000000)));
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerB), VESTING_AMOUNT.mul(new BN(23757)).div(new BN(1000000)));
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerC), VESTING_AMOUNT.mul(new BN(13657)).div(new BN(1000000)));
		});
	
		it("adding a second farmingPool", async () => {
			await distributor.editRecipient(farmingPool2.address, "100", {from:admin});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(45)).div(new BN(1000))), [farmingPool2]);
			await farmingPool2.trackBorrow(borrowerB, oneMantissa, oneMantissa, {from:borrowable2});
			await farmingPool2.claim({from:borrowerB});
			await farmingPool.claim({from:borrowerA});
			await distributor.editRecipient(farmingPool.address, "0", {from:admin});
			await setTimestamp(VESTING_BEGIN.add(VESTING_PERIOD.mul(new BN(55)).div(new BN(1000))), [farmingPool2]);
			await farmingPool2.claim({from:borrowerB});
			await farmingPool.claim({from:borrowerA});
			await farmingPool.claim({from:borrowerC});
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerA), VESTING_AMOUNT.mul(new BN(63935)).div(new BN(1000000)));
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerB), VESTING_AMOUNT.mul(new BN(47352)).div(new BN(1000000)));
			expectAlmostEqualMantissa(await imx.balanceOf(borrowerC), VESTING_AMOUNT.mul(new BN(25794)).div(new BN(1000000)));
		});
	});
	
});
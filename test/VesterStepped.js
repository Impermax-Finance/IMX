const {
	expectRevert,
	expectAlmostEqualMantissa,
	bnMantissa,
	BN,
} = require('./Utils/JS');

const Imx = artifacts.require('Imx');
const Vester = artifacts.require('VesterSteppedHarness');

const oneMantissa = (new BN(10)).pow(new BN(18));
const VESTING_AMOUNT = oneMantissa.mul(new BN(80000000));
const VESTING_BEGIN = new BN(1600000000);
const VESTING_PERIOD = new BN(1461 * 24 * 3600);
const VESTING_END = VESTING_BEGIN.add(VESTING_PERIOD);

contract('VesterStepped', function (accounts) {
	let root = accounts[0];
	let recipient = accounts[1];
	
	let imx;
	let vester;
	
	before(async () => {
		imx = await Imx.new(root);
		vester = await Vester.new(imx.address, recipient, VESTING_AMOUNT, VESTING_BEGIN, VESTING_END);
		imx.transfer(vester.address, VESTING_AMOUNT);
	});
	
	it('setRecipient', async () => {
		await expectRevert(vester.setRecipient(root, {from: root}), "Vester: UNAUTHORIZED");
		await vester.setRecipient(root, {from: recipient});
		expect(await vester.recipient()).to.eq(root);
		await vester.setRecipient(recipient, {from: root});
		expect(await vester.recipient()).to.eq(recipient);		
	});
	
	it('too early', async () => {
		await expectRevert(
			Vester.new(imx.address, recipient, VESTING_AMOUNT, VESTING_BEGIN, VESTING_BEGIN), 
			'Vester: END_TOO_EARLY'
		);
	});
	
	it('claim unauthorized', async () => {
		await expectRevert(vester.claim.call(), 'Vester: UNAUTHORIZED');
		await vester.setBlockTimestamp(VESTING_BEGIN.sub(new BN(1)));
		expect(await vester.claim.call({from: recipient})*1).to.eq(0);
	});
	
	[
		{T: 0, expectedPercentage: 0.0263187},
		{T: 14 * 24 * 3600, expectedPercentage: 0.0263187},
		{T: 20 * 24 * 3600, expectedPercentage: 0.052006},
		{T: 200 * 24 * 3600, expectedPercentage: 0.316153},
		{T: 500 * 24 * 3600, expectedPercentage: 0.628019},
		{T: 1450 * 24 * 3600, expectedPercentage: 1},
		{T: 1500 * 24 * 3600, expectedPercentage: 1},
	].forEach((testCase) => {
		it(`stepped vesting curve for ${JSON.stringify(testCase)}`, async () => {
			const {T, expectedPercentage} = testCase;
			const blockTimestamp = VESTING_BEGIN.add(new BN(T));
			await vester.setBlockTimestamp(blockTimestamp);
			const x = blockTimestamp.sub(VESTING_BEGIN).mul(oneMantissa).div(VESTING_PERIOD);
			const expectedAmount = VESTING_AMOUNT.mul(bnMantissa(expectedPercentage)).div(oneMantissa);
			await vester.claim({from: recipient});
			expectAlmostEqualMantissa(await imx.balanceOf(recipient), expectedAmount);
		});
	});

});
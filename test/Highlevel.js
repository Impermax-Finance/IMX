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
const Vester = artifacts.require('VesterHarness');
const VesterSale = artifacts.require('VesterSaleHarness');
const VesterStepped = artifacts.require('VesterSteppedHarness');
const OwnedDistributor = artifacts.require('OwnedDistributor');
const InitializedDistributor = artifacts.require('InitializedDistributor');
const FarmingPool = artifacts.require('FarmingPoolHarness');

const MockERC20 = artifacts.require('MockERC20');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Pair = artifacts.require('UniswapV2Pair');
const SimpleUniswapOracle = artifacts.require('SimpleUniswapOracle');
const Factory = artifacts.require('Factory');
const BDeployer = artifacts.require('BDeployer');
const CDeployer = artifacts.require('CDeployer');
const Collateral = artifacts.require('Collateral');
const Borrowable = artifacts.require('Borrowable');

const oneMantissa = (new BN(10)).pow(new BN(18));
const oneMilion = (new BN(10)).pow(new BN(24));

async function setTimestamp(timestamp, contracts = []) {
	for(let x of contracts) {
		await x.setBlockTimestamp(timestamp);
	}
}

function logGas(info, receipt) {
	console.log(info, receipt.receipt.gasUsed);
}

/*  
	TREASURY (40%)
	VesterStepped -> Distributor (owned by governance) -> Farming Pools
	
	PRIVATE SALE (10%)
	VesterSale -> Distributor (mi servirebbe speciale)
	
	CORE CONTRIBUTORS (6%) + charlieS (1%)
	Vester -> Distributor
	
	ADVISORS (2%) + CORE CONTRIBUTORS (6%)
	Vester -> Distributor (owned by me)
	
	IMPERMAX (19%)
	Vester -> Distributor (owned by me)
	
	AIRDROP (15%)
	Contract TODO
	
	LIQUIDITY (1%)	
*/

const VESTING_BEGIN = new BN(1600000000);
const VESTING_PERIOD = new BN(100 * 14 * 24 * 3600);
const VESTING_END = VESTING_BEGIN.add(VESTING_PERIOD);

// TREASURY
const TREASURY_AMOUNT = oneMilion.mul(new BN(40));

// PRIVATE SALE
const PRIVATE_SALE_AMOUNT = oneMilion.mul(new BN(10));

// CORE CONTRIBUTORS + charlieS
const PERMISSIONLESS_AMOUNT = oneMilion.mul(new BN(13));

// ADVISORS + CORE CONTRIBUTORS
const PERMISSIONED_AMOUNT = oneMilion.mul(new BN(2));

// IMPERMAX
const IMPERMAX_AMOUNT = oneMilion.mul(new BN(19));

// AIRDROP TODO
const AIRDROP_AMOUNT = oneMilion.mul(new BN(15));

// LIQUIDITY
const LIQUIDITY_AMOUNT = oneMilion.mul(new BN(1));

contract('Highlevel', function (accounts) {
	let root = accounts[0];
	let governance = accounts[1];
	let admin = accounts[2];
	let bob = accounts[3];
	let alice = accounts[4];
	let charlie = accounts[5];
	let investorA = accounts[6];
	let investorB = accounts[7];
	let investorC = accounts[8];
	let advisorA = accounts[9];
	let advisorB = accounts[10];
	let advisorC = accounts[11];
	let borrowerA = accounts[12];
	let borrowerB = accounts[13];
	let borrowerC = accounts[14];
	let impermaxAdmin = accounts[15];
	
	let uniswapV2Factory;
	let simpleUniswapOracle;
	let impermaxFactory;
	let ETH;
	let UNI;
	let DAI;
	let ETHUNI;
	let ETHDAI;
	let ETHUNIc;
	let ETHUNIb0;
	let ETHUNIb1;
	let ETHUNIf0;
	let ETHUNIf1;
	let ETHDAIc;
	let ETHDAIb0;
	let ETHDAIb1;
	let ETHDAIf0;
	let ETHDAIf1;
	
	let imx;
	let clocks;
	let treasuryVester;
	let treasuryDistributor;
	let privateSaleVester;
	let privateSaleDistributor;
	let permissionlessVester;
	let permissionlessDistributor;
	let permissionedVester;
	let permissionedDistributor;
	let impermaxVester;
	
	let treasury;
	let impermax;
	let farming;
	let farmingPool;
	
	before(async () => {
		uniswapV2Factory = await UniswapV2Factory.new(address(0));
		simpleUniswapOracle = await SimpleUniswapOracle.new();
		const bDeployer = await BDeployer.new();
		const cDeployer = await CDeployer.new();
		impermaxFactory = await Factory.new(admin, address(0), bDeployer.address, cDeployer.address, uniswapV2Factory.address, simpleUniswapOracle.address);
		ETH = await MockERC20.new('Ethereum', 'ETH');
		UNI = await MockERC20.new('Uniswap', 'UNI');
		DAI = await MockERC20.new('DAI', 'DAI');
		// token
		imx = await Imx.new(root);
		treasuryVester = await VesterStepped.new(imx.address, root, TREASURY_AMOUNT, VESTING_BEGIN, VESTING_END);
		privateSaleVester = await VesterSale.new(imx.address, root, PRIVATE_SALE_AMOUNT, VESTING_BEGIN, VESTING_END);
		permissionlessVester = await Vester.new(imx.address, root, PERMISSIONLESS_AMOUNT, VESTING_BEGIN, VESTING_END);
		permissionedVester = await Vester.new(imx.address, root, PERMISSIONED_AMOUNT, VESTING_BEGIN, VESTING_END);
		impermaxVester = await Vester.new(imx.address, impermaxAdmin, IMPERMAX_AMOUNT, VESTING_BEGIN, VESTING_END);
		clocks = [treasuryVester, privateSaleVester, permissionlessVester, permissionedVester, impermaxVester];
		await setTimestamp(VESTING_BEGIN.sub(new BN(1)), clocks);
	});

	it("initialize treasury", async () => {
		await imx.transfer(treasuryVester.address, TREASURY_AMOUNT);
		treasuryDistributor = await OwnedDistributor.new(imx.address, treasuryVester.address, governance);
		await treasuryVester.setRecipient(treasuryDistributor.address, {from:root});
	});

	it("initialize private sale", async () => {
		await imx.transfer(privateSaleVester.address, PRIVATE_SALE_AMOUNT);		
		privateSaleDistributor = await InitializedDistributor.new(imx.address, privateSaleVester.address, [
			encode(['address', 'uint256'], [investorA, '3500']),
			encode(['address', 'uint256'], [investorB, '2500']),
			encode(['address', 'uint256'], [investorC, '4000']),
		]);
		privateSaleVester.setRecipient(privateSaleDistributor.address, {from:root});
	});

	it("initialize core contributors", async () => {
		await imx.transfer(permissionlessVester.address, PERMISSIONLESS_AMOUNT);		
		permissionlessDistributor = await InitializedDistributor.new(imx.address, permissionlessVester.address, [
			encode(['address', 'uint256'], [bob, '8000']),
			encode(['address', 'uint256'], [alice, '4000']),
			encode(['address', 'uint256'], [charlie, '1000']),
		]);
		permissionlessVester.setRecipient(permissionlessDistributor.address, {from:root});
	});

	it("initialize advisors", async () => {
		await imx.transfer(permissionedVester.address, PERMISSIONED_AMOUNT);
		permissionedDistributor = await OwnedDistributor.new(imx.address, permissionedVester.address, admin);
		const setRecipientRec = await permissionedVester.setRecipient(permissionedDistributor.address, {from:root});
		const editRecipientRecA = await permissionedDistributor.editRecipient(advisorA, '5000', {from:admin});
		const editRecipientRecB = await permissionedDistributor.editRecipient(advisorB, '3000', {from:admin});
		await permissionedDistributor.editRecipient(advisorC, '2000', {from:admin});
		logGas("Permissioned Vester set recipient", setRecipientRec);
		logGas("Permissioned Distributor edit first recipient", editRecipientRecA);
		logGas("Permissioned Distributor edit second recipient", editRecipientRecB);
	});

	it("initialize impermax", async () => {
		await imx.transfer(impermaxVester.address, IMPERMAX_AMOUNT);
	});

	it("setup ETHUNI", async () => {
		// Create pair
		const ETHUNIAddress = await uniswapV2Factory.createPair.call(ETH.address, UNI.address);
		await uniswapV2Factory.createPair(ETH.address, UNI.address);
		ETHUNI = await UniswapV2Pair.at(ETHUNIAddress);
		await UNI.mint(ETHUNIAddress, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHUNIAddress, oneMantissa.mul(new BN(1000000)));
		await ETHUNI.mint(root);
		const collateralAddress = await impermaxFactory.createCollateral.call(ETHUNIAddress);
		const borrowable0Address = await impermaxFactory.createBorrowable0.call(ETHUNIAddress);
		const borrowable1Address = await impermaxFactory.createBorrowable1.call(ETHUNIAddress);
		await impermaxFactory.createCollateral(ETHUNIAddress);
		await impermaxFactory.createBorrowable0(ETHUNIAddress);
		await impermaxFactory.createBorrowable1(ETHUNIAddress);
		await impermaxFactory.initializeLendingPool(ETHUNIAddress);
		ETHUNIc = await Collateral.at(collateralAddress);
		ETHUNIb0 = await Borrowable.at(borrowable0Address);
		ETHUNIb1 = await Borrowable.at(borrowable1Address);
		await increaseTime(1900); // wait for oracle to be ready
		// Enable liquidity mining
		ETHUNIfp0 = await FarmingPool.new(imx.address, treasuryDistributor.address, ETHUNIb0.address, treasuryVester.address);
		ETHUNIfp1 = await FarmingPool.new(imx.address, treasuryDistributor.address, ETHUNIb1.address, treasuryVester.address);
		clocks.push(ETHUNIfp0);
		clocks.push(ETHUNIfp1);
		await treasuryDistributor.editRecipient(ETHUNIfp0.address, "350", {from:governance});
		await treasuryDistributor.editRecipient(ETHUNIfp1.address, "350", {from:governance});
		const setBorrowTrackerRec = await ETHUNIb0._setBorrowTracker(ETHUNIfp0.address, {from: admin});
		logGas("Set borrow tracker", setBorrowTrackerRec);
		await ETHUNIb1._setBorrowTracker(ETHUNIfp1.address, {from: admin});
		// Supply liquidity and collateral
		await UNI.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
		await UNI.mint(ETHUNIb1.address, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHUNIb1.address, oneMantissa.mul(new BN(1000000)));
		await ETHUNIb0.mint(root);
		await ETHUNIb1.mint(root);
		await ETHUNI.transfer(ETHUNIc.address, oneMantissa.mul(new BN(100000)));
		await ETHUNIc.mint(borrowerA);
		await ETHUNI.transfer(ETHUNIc.address, oneMantissa.mul(new BN(100000)));
		await ETHUNIc.mint(borrowerB);
		await ETHUNI.transfer(ETHUNIc.address, oneMantissa.mul(new BN(100000)));
		await ETHUNIc.mint(borrowerC);
	});

	it("borrow ETHUNI ", async () => {
		const borrowFirstRec = await ETHUNIb0.borrow(borrowerA, borrowerA, oneMantissa.mul(new BN(2)), '0x', {from:borrowerA});
		const borrowSecondRec = await ETHUNIb0.borrow(borrowerB, borrowerB, oneMantissa.mul(new BN(1)), '0x', {from:borrowerB});
		logGas("Borrow first with tracking", borrowFirstRec);
		logGas("Borrow second with tracking", borrowSecondRec);
		await ETHUNIb1.borrow(borrowerA, borrowerA, oneMantissa.mul(new BN(2)), '0x', {from:borrowerA});
	});

	it("30% 1st epoch", async () => {
		await setTimestamp(VESTING_BEGIN.add(new BN(14 * 24 * 3600 * 3 / 10)), clocks);
		const privateSaleClaimRec = await privateSaleDistributor.claim({from:investorA});
		await permissionlessDistributor.claim({from:bob});
		await permissionedDistributor.claim({from:advisorA});
		const impermaxVesterClaimRec = await impermaxVester.claim({from:impermaxAdmin});
		const farmingPoolClaimFirstRec = await ETHUNIfp0.claim({from:borrowerA});
		const farmingPoolClaimSecondRec = await ETHUNIfp0.claimAccount(borrowerB);
		const advanceRec = await ETHUNIfp1.advance();
		const borrowThirdRec = await ETHUNIb0.borrow(borrowerC, borrowerC, oneMantissa.mul(new BN(1)), '0x', {from:borrowerC});
		await ETHUNIb1.borrow(borrowerB, borrowerB, oneMantissa.mul(new BN(1)), '0x', {from:borrowerB});
		logGas("Private sale claim", privateSaleClaimRec);
		logGas("Impermax vester claim", impermaxVesterClaimRec);
		logGas("Farming pool first claim and advance", farmingPoolClaimFirstRec);
		logGas("Farming pool second claim", farmingPoolClaimSecondRec);
		logGas("Advance", advanceRec);
		logGas("Borrow third with tracking", borrowThirdRec);
		expectAlmostEqualMantissa(await imx.balanceOf(investorA), 
			PRIVATE_SALE_AMOUNT.mul(new BN((0.2 + 0.021055 * 0.3) * 0.35 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(bob), 
			oneMilion.mul(new BN(8 * 0.026319 * 0.3 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(advisorA), 
			PERMISSIONED_AMOUNT.mul(new BN(0.5 * 0.026319 * 0.3 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(impermaxAdmin), 
			IMPERMAX_AMOUNT.mul(new BN(0.026319 * 0.3 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(borrowerA), 
			TREASURY_AMOUNT.mul(new BN(0.026319 / 3 * 0.3 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(borrowerB), 
			TREASURY_AMOUNT.mul(new BN(0.026319 / 2 / 3 * 0.3 * 1e9)).div(new BN(1e9)));
	});

	it("60% 1st epoch", async () => {
		await setTimestamp(VESTING_BEGIN.add(new BN(14 * 24 * 3600 * 6 / 10)), clocks);
		// Repay
		await UNI.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
		await ETHUNIb0.borrow(borrowerC, borrowerC, '0', '0x', {from:borrowerC});
	});

	it("20% 2nd epoch", async () => {
		await setTimestamp(VESTING_BEGIN.add(new BN(14 * 24 * 3600 * 12 / 10)), clocks);
		await ETHUNIfp0.advance();
		await ETHUNIfp1.advance();
		await ETHUNIb1.borrow(borrowerC, borrowerC, oneMantissa.mul(new BN(1)), '0x', {from:borrowerC});
		expectAlmostEqualMantissa(await ETHUNIfp0.claim.call({from:borrowerA}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3)/2 + (0.026319*0.4 + 0.025687*0.2)*2/3) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp0.claim.call({from:borrowerB}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3)/4 + (0.026319*0.4 + 0.025687*0.2)/3) / 2 * 1e9)).div(new BN(1e9)));	
		expectAlmostEqualMantissa(await ETHUNIfp0.claim.call({from:borrowerC}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3)/4) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp1.claim.call({from:borrowerA}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3) + (0.026319*0.7 + 0.025687*0.2)*2/3) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp1.claim.call({from:borrowerB}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.7 + 0.025687*0.2)/3) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp1.claim.call({from:borrowerC}), 0);
	});
	
	it("setup ETHDAI", async () => {
		// Create pair
		const ETHDAIAddress = await uniswapV2Factory.createPair.call(ETH.address, DAI.address);
		await uniswapV2Factory.createPair(ETH.address, DAI.address);
		ETHDAI = await UniswapV2Pair.at(ETHDAIAddress);
		await DAI.mint(ETHDAIAddress, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHDAIAddress, oneMantissa.mul(new BN(1000000)));
		await ETHDAI.mint(root);
		const collateralAddress = await impermaxFactory.createCollateral.call(ETHDAIAddress);
		const borrowable0Address = await impermaxFactory.createBorrowable0.call(ETHDAIAddress);
		const borrowable1Address = await impermaxFactory.createBorrowable1.call(ETHDAIAddress);
		await impermaxFactory.createCollateral(ETHDAIAddress);
		await impermaxFactory.createBorrowable0(ETHDAIAddress);
		await impermaxFactory.createBorrowable1(ETHDAIAddress);
		await impermaxFactory.initializeLendingPool(ETHDAIAddress);
		ETHDAIc = await Collateral.at(collateralAddress);
		ETHDAIb0 = await Borrowable.at(borrowable0Address);
		ETHDAIb1 = await Borrowable.at(borrowable1Address);
		await increaseTime(1900); // wait for oracle to be ready
		// Supply liquidity and collateral
		await DAI.mint(ETHDAIb0.address, oneMantissa.mul(new BN(1000000)));
		await DAI.mint(ETHDAIb1.address, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHDAIb0.address, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHDAIb1.address, oneMantissa.mul(new BN(1000000)));
		await ETHDAIb0.mint(root);
		await ETHDAIb1.mint(root);
		await ETHDAI.transfer(ETHDAIc.address, oneMantissa.mul(new BN(100000)));
		await ETHDAIc.mint(borrowerA);
		await ETHDAI.transfer(ETHDAIc.address, oneMantissa.mul(new BN(100000)));
		await ETHDAIc.mint(borrowerB);
		await ETHDAI.transfer(ETHDAIc.address, oneMantissa.mul(new BN(100000)));
		await ETHDAIc.mint(borrowerC);
	});

	it("borrow ETHDAI", async () => {
		const borrowFirstRec = await ETHDAIb0.borrow(borrowerA, borrowerA, oneMantissa.mul(new BN(2)), '0x', {from:borrowerA});
		const borrowSecondRec = await ETHDAIb0.borrow(borrowerB, borrowerB, oneMantissa.mul(new BN(1)), '0x', {from:borrowerB});
		await ETHDAIb1.borrow(borrowerA, borrowerA, oneMantissa.mul(new BN(2)), '0x', {from:borrowerA});
		logGas("Borrow first without tracking", borrowFirstRec);
		logGas("Borrow second without tracking", borrowSecondRec);
	});

	it("50% 3rd epoch", async () => {
		await setTimestamp(VESTING_BEGIN.add(new BN(14 * 24 * 3600 * 25 / 10)), clocks);
		await ETHUNIfp0.advance();
		await ETHUNIfp1.advance();
	});

	it("add liquidity mining to ETHDAI", async () => {
		// Enable liquidity mining
		ETHDAIfp0 = await FarmingPool.new(imx.address, treasuryDistributor.address, ETHDAIb0.address, treasuryVester.address);
		ETHDAIfp1 = await FarmingPool.new(imx.address, treasuryDistributor.address, ETHDAIb1.address, treasuryVester.address);
		clocks.push(ETHDAIfp0);
		clocks.push(ETHDAIfp1);
		await treasuryDistributor.editRecipient(ETHDAIfp0.address, "150", {from:governance});
		await treasuryDistributor.editRecipient(ETHDAIfp1.address, "150", {from:governance});
		await ETHDAIb0._setBorrowTracker(ETHDAIfp0.address, {from: admin});
		await ETHDAIb1._setBorrowTracker(ETHDAIfp1.address, {from: admin});
		const trackBorrowFirstRec = await ETHDAIb0.trackBorrow(borrowerA);
		const trackBorrowSecondRec = await ETHDAIb0.trackBorrow(borrowerB);
		await ETHDAIb1.trackBorrow(borrowerA);
		logGas("Trackborrow first", trackBorrowFirstRec);
		logGas("Trackborrow second", trackBorrowSecondRec);
	});

	it("50% 4th epoch", async () => {
		await setTimestamp(VESTING_BEGIN.add(new BN(14 * 24 * 3600 * 35 / 10)), clocks);
		await ETHUNIfp0.advance();
		await ETHUNIfp1.advance();
		await ETHDAIfp0.advance();
		await ETHDAIfp1.advance();
		await ETHDAIb0.borrow(borrowerC, borrowerC, oneMantissa.mul(new BN(1)), '0x', {from:borrowerC});
		expectAlmostEqualMantissa(await ETHUNIfp0.claim.call({from:borrowerA}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3)/2 + (0.026319*0.4 + 0.025687 + 0.025071 + 0.024469*0.5*0.7)*2/3) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp0.claim.call({from:borrowerB}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3)/4 + (0.026319*0.4 + 0.025687 + 0.025071 + 0.024469*0.5*0.7)/3) / 2 * 1e9)).div(new BN(1e9))); 
		expectAlmostEqualMantissa(await ETHUNIfp0.claim.call({from:borrowerC}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3)/4) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp1.claim.call({from:borrowerA}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.3) + (0.026319*0.7 + 0.025687*0.2)*2/3 + (0.025687*0.8 + 0.025071 + 0.024469*0.5*0.7)/2) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHUNIfp1.claim.call({from:borrowerB}),
			TREASURY_AMOUNT.mul(new BN(((0.026319*0.7 + 0.025687*0.2)/3 + (0.025687*0.8 + 0.025071 + 0.024469*0.5*0.7)/4) / 2 * 1e9)).div(new BN(1e9))); 0.0344267
		expectAlmostEqualMantissa(await ETHUNIfp1.claim.call({from:borrowerC}), 
			TREASURY_AMOUNT.mul(new BN(((0.025687*0.8 + 0.025071 + 0.024469*0.5*0.7)/4) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHDAIfp0.claim.call({from:borrowerA}),
			TREASURY_AMOUNT.mul(new BN(((0.024469*0.5*0.3)*2/3) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHDAIfp0.claim.call({from:borrowerB}),
			TREASURY_AMOUNT.mul(new BN(((0.024469*0.5*0.3)/3) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHDAIfp0.claim.call({from:borrowerC}), 0);
		expectAlmostEqualMantissa(await ETHDAIfp1.claim.call({from:borrowerA}),
			TREASURY_AMOUNT.mul(new BN(((0.024469*0.5*0.3)*1) / 2 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await ETHDAIfp1.claim.call({from:borrowerB}), 0);
		expectAlmostEqualMantissa(await ETHDAIfp1.claim.call({from:borrowerC}), 0);
	});
	
	it("remove advisor", async () => {
		await permissionedDistributor.editRecipient(advisorC, '0', {from:admin});		
		await permissionedDistributor.editRecipient(admin, '2000', {from:admin});
	});
	
	it("50% 5th epoch", async () => {
		await setTimestamp(VESTING_BEGIN.add(new BN(14 * 24 * 3600 * 45 / 10)), clocks);
		await ETHUNIfp0.advance();
		await ETHUNIfp1.advance();
		await ETHDAIfp0.advance();
		await ETHDAIfp1.advance();
		await ETHUNIfp0.claim({from:borrowerA});
		await ETHUNIfp0.claim({from:borrowerB});
		await ETHUNIfp0.claim({from:borrowerC});
		await ETHUNIfp1.claim({from:borrowerA});
		await ETHUNIfp1.claim({from:borrowerB});
		await ETHUNIfp1.claim({from:borrowerC});
		await ETHDAIfp0.claim({from:borrowerA});
		await ETHDAIfp0.claim({from:borrowerB});
		await ETHDAIfp0.claim({from:borrowerC});
		await ETHDAIfp1.claim({from:borrowerA});
		await ETHDAIfp1.claim({from:borrowerB});
		await ETHDAIfp1.claim({from:borrowerC});
		await privateSaleDistributor.claim({from:investorA});
		await permissionlessDistributor.claim({from:bob});
		await permissionedDistributor.claim({from:advisorA});
		await permissionedDistributor.claim({from:advisorC});
		await impermaxVester.claim({from:impermaxAdmin});
		expectAlmostEqualMantissa(await imx.balanceOf(investorA), 
			PRIVATE_SALE_AMOUNT.mul(new BN((0.2 + 0.113487*0.8) * 0.35 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(bob), 
			oneMilion.mul(new BN(8 * 0.113487 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(advisorA), 
			PERMISSIONED_AMOUNT.mul(new BN(0.5 * 0.113487 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(advisorC), 
			PERMISSIONED_AMOUNT.mul(new BN(0.2 * 0.089311 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(impermaxAdmin), 
			IMPERMAX_AMOUNT.mul(new BN(0.113487 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(borrowerA), 
			TREASURY_AMOUNT.mul(new BN(0.071605 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(borrowerB), 
			TREASURY_AMOUNT.mul(new BN(0.031099 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(borrowerC), 
			TREASURY_AMOUNT.mul(new BN(0.010782 * 1e9)).div(new BN(1e9)));
	});
		
	it("after vestingEnd", async () => {
		await setTimestamp(VESTING_END.add(new BN(1)), clocks);
		const advanceRec = await ETHUNIfp0.advance();
		await ETHUNIfp1.advance();
		await ETHDAIfp0.advance();
		await ETHDAIfp1.advance();
		await setTimestamp(VESTING_END.add(VESTING_PERIOD).add(new BN(1)), clocks);
		const distributorClaimFirstRec = await privateSaleDistributor.claim({from:investorA});
		await privateSaleDistributor.claim({from:investorB});
		await privateSaleDistributor.claim({from:investorC});
		await permissionlessDistributor.claim({from:bob});
		await permissionlessDistributor.claim({from:alice});
		await permissionlessDistributor.claim({from:charlie});
		await permissionedDistributor.claim({from:advisorA});
		await permissionedDistributor.claim({from:advisorB});
		await permissionedDistributor.claim({from:advisorC});
		await permissionedDistributor.claim({from:admin});
		await impermaxVester.claim({from:impermaxAdmin});
		const farmingPoolClaimFirstRec = await ETHUNIfp0.claim({from:borrowerA});
		const farmingPoolClaimSecondRec = await ETHUNIfp0.claim({from:borrowerB});
		await ETHUNIfp0.claim({from:borrowerC});
		await ETHUNIfp1.claim({from:borrowerA});
		await ETHUNIfp1.claim({from:borrowerB});
		await ETHUNIfp1.claim({from:borrowerC});
		await ETHDAIfp0.claim({from:borrowerA});
		await ETHDAIfp0.claim({from:borrowerB});
		await ETHDAIfp0.claim({from:borrowerC});
		await ETHDAIfp1.claim({from:borrowerA});
		await ETHDAIfp1.claim({from:borrowerB});
		await ETHDAIfp1.claim({from:borrowerC});
		logGas("Advance", advanceRec);
		logGas("Farming pool first claim", farmingPoolClaimFirstRec);
		logGas("Farming pool second claim", farmingPoolClaimSecondRec);
		logGas("Distributor first claim", distributorClaimFirstRec);
		expectAlmostEqualMantissa(await imx.balanceOf(investorA), PRIVATE_SALE_AMOUNT.mul(new BN(7)).div(new BN(20)));
		expectAlmostEqualMantissa(await imx.balanceOf(investorB), PRIVATE_SALE_AMOUNT.mul(new BN(5)).div(new BN(20)));
		expectAlmostEqualMantissa(await imx.balanceOf(investorC), PRIVATE_SALE_AMOUNT.mul(new BN(8)).div(new BN(20)));
		expectAlmostEqualMantissa(await imx.balanceOf(bob), oneMilion.mul(new BN(8)));
		expectAlmostEqualMantissa(await imx.balanceOf(alice), oneMilion.mul(new BN(4)));
		expectAlmostEqualMantissa(await imx.balanceOf(charlie), oneMilion.mul(new BN(1)));
		expectAlmostEqualMantissa(await imx.balanceOf(advisorA), PERMISSIONED_AMOUNT.mul(new BN(5)).div(new BN(10)));
		expectAlmostEqualMantissa(await imx.balanceOf(advisorB), PERMISSIONED_AMOUNT.mul(new BN(3)).div(new BN(10)));
		expectAlmostEqualMantissa(await imx.balanceOf(advisorC), PERMISSIONED_AMOUNT.mul(new BN(0.017862 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(admin), PERMISSIONED_AMOUNT.mul(new BN(0.182138 * 1e9)).div(new BN(1e9)));
		expectAlmostEqualMantissa(await imx.balanceOf(impermaxAdmin), IMPERMAX_AMOUNT);
		expectAlmostEqualMantissa(await imx.balanceOf(treasuryVester.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(privateSaleVester.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(permissionlessVester.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(permissionedVester.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(impermaxVester.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(treasuryDistributor.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(privateSaleDistributor.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(permissionlessDistributor.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(permissionedDistributor.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(ETHUNIfp0.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(ETHUNIfp1.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(ETHDAIfp0.address), 0);
		expectAlmostEqualMantissa(await imx.balanceOf(ETHDAIfp1.address), 0);
	});
});
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
const VESTING_AMOUNT = oneMantissa.mul(new BN(80000000));
const VESTING_BEGIN = new BN(1600000000);
const VESTING_PERIOD = new BN(100 * 14 * 24 * 3600);
const VESTING_END = VESTING_BEGIN.add(VESTING_PERIOD);

async function setTimestamp(contracts = []) {
	for(let x of contracts) {
		await x.setBlockTimestamp(timestamp);
	}
}

/*  
	TREASURY (40%)
	VesterStepped -> Distributor (owned by governance) -> Farming Pools
	
	PRIVATE SALE (10%)
	VesterSale -> Distributor (mi servirebbe speciale)
	
	CORE CONTRIBUTORS (6%) + LAWYERS (1%)
	Vester -> Distributor
	
	ADVISORS (2%) + CORE CONTRIBUTORS (6%)
	Vester -> Distributor (owned by me)
	
	IMPERMAX (19%)
	Vester -> Distributor (owned by me)
	
	AIRDROP (15%)
	Contract TODO
	
	LIQUIDITY (1%)	
*/

contract('FarmingPool', function (accounts) {
	let root = accounts[0];
	let governance = accounts[1];
	let borrowerA = accounts[2];
	let borrowable = accounts[3];
	
	let uniswapV2Factory;
	let simpleUniswapOracle;
	let impermaxFactory;
	let ETH;
	let UNI;
	let DAI;
	let ETHUNI;
	let ETHDAI;
	let collateral;
	let borrowableWETH;
	let borrowableUNI;
	
	let imx;
	let vester;
	let distributor;
	let treasury;
	let impermax;
	let farming;
	let farmingPool;
	
	before(async () => {
		uniswapV2Factory = await UniswapV2Factory.new(address(0));
		simpleUniswapOracle = await SimpleUniswapOracle.new();
		const bDeployer = await BDeployer.new();
		const cDeployer = await CDeployer.new();
		impermaxFactory = await Factory.new(address(0), address(0), bDeployer.address, cDeployer.address, uniswapV2Factory.address, simpleUniswapOracle.address);
		ETH = await MockERC20.new('Ethereum', 'ETH');
		UNI = await MockERC20.new('Uniswap', 'UNI');
		DAI = await MockERC20.new('DAI', 'DAI');
		// setup ETHUNI
		const ETHUNIAddress = await uniswapV2Factory.createPair.call(ETH.address, UNI.address);
		await uniswapV2Factory.createPair(ETH.address, UNI.address);
		ETHUNI = await UniswapV2Pair.at(ETHUNIAddress);
		await UNI.mint(ETHUNIAddress, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHUNIAddress, oneMantissa.mul(new BN(1000000)));
		await ETHUNI.mint(borrowerA);
		await impermaxFactory.createCollateral(ETHUNIAddress);
		await impermaxFactory.createBorrowable0(ETHUNIAddress);
		await impermaxFactory.createBorrowable1(ETHUNIAddress);
		await impermaxFactory.initializeLendingPool(ETHUNIAddress);
		// setup ETHDAI
		const ETHDAIAddress = await uniswapV2Factory.createPair.call(ETH.address, DAI.address);
		await uniswapV2Factory.createPair(ETH.address, DAI.address);
		ETHDAI = await UniswapV2Pair.at(ETHDAIAddress);
		await DAI.mint(ETHDAIAddress, oneMantissa.mul(new BN(1000000)));
		await ETH.mint(ETHDAIAddress, oneMantissa.mul(new BN(1000000)));
		await ETHDAI.mint(borrowerA);
		await impermaxFactory.createCollateral(ETHDAIAddress);
		await impermaxFactory.createBorrowable0(ETHDAIAddress);
		await impermaxFactory.createBorrowable1(ETHDAIAddress);
		await impermaxFactory.initializeLendingPool(ETHDAIAddress);
		
		//TODO setuppare pairs ETH-UNI e ETH-DAI
		// skippare tempo per oracle
		// quindi creare tutti i presupposti per distribuzione
		// quindi testare liquidity farming con real case scenario
		
		//await UNI.mint(borrowerA, UNI_LP_AMOUNT); (minto direttamente dove voglio inviare)
		
		
		
		/*imx = await Imx.new(root);
		vester = await Vester.new(imx.address, root, VESTING_AMOUNT, VESTING_BEGIN, VESTING_END);
		await vester.setBlockTimestamp(VESTING_BEGIN.sub(new BN(1)));
		const receipt = await imx.transfer(vester.address, VESTING_AMOUNT);
		console.log(receipt.receipt.gasUsed);
		distributor = await OwnedDistributor.new(imx.address, vester.address, root);
		await vester.setRecipient(distributor.address);
		//treasury = await OwnedDistributor.new(imx.address, distributor.address, governance);
		impermax = await OwnedDistributor.new(imx.address, distributor.address, root);
		//await distributor.editRecipient(treasury.address, "50");
		//farming = await OwnedDistributor.new(imx.address, treasury.address, governance);
		farming = await OwnedDistributor.new(imx.address, distributor.address, governance);
		await distributor.editRecipient(impermax.address, "50");
		await distributor.editRecipient(farming.address, "50");
		await distributor.setAdmin(address(0));
		//await treasury.editRecipient(governance, "30", {from:governance});
		//await treasury.editRecipient(farming.address, "70", {from:governance});
		farmingPool = await FarmingPool.new(imx.address, farming.address, borrowable);
		await farming.editRecipient(farmingPool.address, "100", {from:governance});*/
	});
/*
	it("initialize treasury", async () => {
		await vester.setBlockTimestamp(VESTING_BEGIN.add(new BN(24 * 3600)));
		const receipt1 = await farmingPool.trackBorrow(borrowerA, "1000", oneMantissa, {from:borrowable});
		await vester.setBlockTimestamp(VESTING_BEGIN.add(new BN(7 * 24 * 3600)));
		const receipt2 = await farmingPool.claim({from:borrowerA});
		await vester.setBlockTimestamp(VESTING_BEGIN.add(new BN(10 * 24 * 3600)));
		const receipt3 = await farmingPool.claim({from:borrowerA});
		console.log(await imx.balanceOf(vester.address) / 1e18);
		console.log(await imx.balanceOf(farmingPool.address) / 1e18);
		console.log(await imx.balanceOf(borrowerA) / 1e18);
		console.log(receipt1.receipt.gasUsed);
		console.log(receipt2.receipt.gasUsed);
		console.log(receipt3.receipt.gasUsed);
	});

	it("initialize private sale", async () => {
		
	});

	it("initialize core contributors", async () => {
		
	});

	it("initialize advisors", async () => {
		
	});*/

	it("initialize impermax", async () => {
		
	});
	
	

	
	describe("basics", () => {
		
		
		/*it("permissions check", async () => {
			console.log('vester', await imx.balanceOf(vester.address) / 1e18);
			console.log('farmingPool', await imx.balanceOf(farmingPool.address) / 1e18);
			
			const receipt1 = await farmingPool.trackBorrow(borrowerA, "1000", oneMantissa, {from:borrowable});
			console.log(await imx.balanceOf(borrowerA) / 1e18);
			console.log('gas first trackBorrow', receipt1.receipt.gasUsed);
			
			await setTimestamp(VESTING_BEGIN.add(new BN(24 * 3600)));
			const receipt2 = await farmingPool.claim({from:borrowerA});
			console.log(await imx.balanceOf(borrowerA) / 1e18);
			console.log('gas first claim', receipt2.receipt.gasUsed);
			
			console.log('vester', await imx.balanceOf(vester.address) / 1e18);
			console.log('farmingPool', await imx.balanceOf(farmingPool.address) / 1e18);
			
			await setTimestamp(VESTING_BEGIN.add(new BN(7 * 24 * 3600)));
			const receipt3 = await farmingPool.claim({from:borrowerA});
			console.log(await imx.balanceOf(borrowerA) / 1e18);
			console.log('gas second claim', receipt3.receipt.gasUsed);
			
			await setTimestamp(VESTING_BEGIN.add(new BN(8 * 24 * 3600)));
			const receipt3A = await farmingPool.claim({from:borrowerA});
			console.log(await imx.balanceOf(borrowerA) / 1e18);
			console.log('gas claim', receipt3A.receipt.gasUsed);
			
			console.log('vester', await imx.balanceOf(vester.address) / 1e18);
			console.log('farmingPool', await imx.balanceOf(farmingPool.address) / 1e18);
			
			await setTimestamp(VESTING_BEGIN.add(new BN(15 * 24 * 3600)));
			const receipt4 = await farmingPool.claim({from:borrowerA});
			console.log(await imx.balanceOf(borrowerA) / 1e18);
			console.log('gas effective claim', receipt4.receipt.gasUsed);
			
			const receipt5 = await farmingPool.trackBorrow(borrowerA, "2000", oneMantissa, {from:borrowable});
			console.log('gas second trackBorrow', receipt5.receipt.gasUsed);
			
			await setTimestamp(VESTING_BEGIN.add(new BN(16 * 24 * 3600)));
			const receipt6 = await farmingPool.trackBorrow(borrowerA, "3000", oneMantissa, {from:borrowable});
			console.log('gas third trackBorrow', receipt6.receipt.gasUsed);
			
			console.log('vester', await imx.balanceOf(vester.address) / 1e18);
			console.log('farmingPool', await imx.balanceOf(farmingPool.address) / 1e18);
		});*/
		
	});
	
});
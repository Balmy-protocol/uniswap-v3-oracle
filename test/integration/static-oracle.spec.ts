import hre, { deployments, ethers } from 'hardhat';
import { evm, wallet } from '@utils';
import { contract, given } from '@utils/bdd';
import { expect } from 'chai';
import { getNodeUrl } from 'utils/env';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { StaticOracle } from '@typechained';
import { getLastPrice, convertPriceToNumberWithDecimals, getPrice } from '../utils/defillama';
import { setTestChainId } from 'utils/deploy';
import moment from 'moment';
import { constants, utils } from 'ethers';
import { DeterministicFactory, DeterministicFactory__factory } from '@mean-finance/deterministic-factory';

const PRICE_THRESHOLD = 40;
const PERIOD = moment.duration('3', 'minutes').as('seconds');
const DETERMINISTIC_FACTORY_ADMIN = '0x1a00e1e311009e56e3b0b9ed6f86f5ce128a1c01';
const DEPLOYER_ROLE = utils.keccak256(utils.toUtf8Bytes('DEPLOYER_ROLE'));

contract('StaticOracle', () => {
  let deployer: SignerWithAddress;
  let staticOracle: StaticOracle;

  before(async () => {
    const { deployer: deployerAddress } = await hre.getNamedAccounts();
    deployer = await ethers.getSigner(deployerAddress);
  });

  describe(`getAllPoolsForPair`, () => {
    given(async () => {
      staticOracle = await forkAndDeploy(1, 'ethereum', 14976820);
    });
    it('all pools are returned correctly', async () => {
      // Checking WETH/USDC pair
      const pools = await staticOracle.getAllPoolsForPair(
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      );
      expect(pools.map((_) => _.toLowerCase())).to.eql([
        '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // 0.05%
        '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', // 0.3%
        '0x7bea39867e4169dbe237d55c8242a8f2fcdcc387', // 1%
      ]);
    });
  });

  describe('quote', () => {
    testQuoteOnNetwork({
      network: 'ethereum',
      chainId: 1,
      blockNumber: 14976820,
      weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    });
    testQuoteOnNetwork({
      network: 'optimism',
      chainId: 10,
      blockNumber: 12099200,
      weth: '0x4200000000000000000000000000000000000006',
      usdc: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    });
    testQuoteOnNetwork({
      network: 'arbitrum',
      chainId: 42161,
      blockNumber: 14854050,
      weth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      usdc: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    });
    testQuoteOnNetwork({
      network: 'polygon',
      chainId: 137,
      blockNumber: 29659645,
      weth: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      usdc: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    });
  });

  function testQuoteOnNetwork({
    network,
    chainId,
    blockNumber,
    weth,
    usdc,
  }: {
    network: string;
    chainId: number;
    blockNumber: number;
    weth: string;
    usdc: string;
  }): void {
    context(`on ${network}`, () => {
      let feedPrice: number;
      given(async () => {
        staticOracle = await forkAndDeploy(chainId, network, blockNumber);
        // Get timestamp of block
        const previousBlock = await ethers.provider.getBlock(blockNumber - 1);
        // Get ETH/USD price from coingecko
        feedPrice = await getPrice(network, weth, previousBlock.timestamp);
      });
      it('returns correct twap', async () => {
        const [twap] = await staticOracle.quoteAllAvailablePoolsWithTimePeriod(utils.parseEther('1'), weth, usdc, PERIOD);
        expect(twap).to.be.within(
          convertPriceToNumberWithDecimals(feedPrice - PRICE_THRESHOLD, 6),
          convertPriceToNumberWithDecimals(feedPrice + PRICE_THRESHOLD, 6)
        );
      });
      it('returns correct ofsetted twap', async () => {
        const OFFSET = moment.duration('1', 'hours').as('seconds');
        await ethers.provider.send('evm_increaseTime', [OFFSET]);
        const [twap] = await staticOracle.quoteAllAvailablePoolsWithOffsettedTimePeriod(utils.parseEther('1'), weth, usdc, PERIOD, OFFSET);
        expect(twap).to.be.within(
          convertPriceToNumberWithDecimals(feedPrice - PRICE_THRESHOLD, 6),
          convertPriceToNumberWithDecimals(feedPrice + PRICE_THRESHOLD, 6)
        );
      });
    });
  }

  async function forkAndDeploy(chainId: number, chainName: string, blockNumber: number): Promise<StaticOracle> {
    // Set fork of network
    await setTestChainId(chainId);
    await evm.reset({
      jsonRpcUrl: getNodeUrl(chainName),
      blockNumber,
    });
    // Give deployer role to our deployer address
    const admin = await wallet.impersonate(DETERMINISTIC_FACTORY_ADMIN);
    await wallet.setBalance({ account: admin._address, balance: constants.MaxUint256 });
    const deterministicFactory = await ethers.getContractAt<DeterministicFactory>(
      DeterministicFactory__factory.abi,
      '0xbb681d77506df5CA21D2214ab3923b4C056aa3e2'
    );
    await deterministicFactory.connect(admin).grantRole(DEPLOYER_ROLE, deployer.address);
    // Execute deployment script
    await deployments.fixture(['StaticOracle'], { keepExistingDeployments: false });
    return await ethers.getContract<StaticOracle>('StaticOracle');
  }
});

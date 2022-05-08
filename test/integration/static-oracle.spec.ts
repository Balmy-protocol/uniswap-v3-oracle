import { bytecode as IUniswapV3Pool__bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import { deployments, ethers } from 'hardhat';
import { evm, wallet } from '@utils';
import { contract, given, then, when } from '@utils/bdd';
import { expect } from 'chai';
import { getNodeUrl } from 'utils/env';
import forkBlockNumber from './fork-block-numbers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  ERC20Mock,
  ERC20Mock__factory,
  NonfungiblePositionManager,
  NonfungiblePositionManager__factory,
  StaticOracle,
  IUniswapV3Pool__factory,
  IUniswapV3Factory,
} from '@typechained';
import { getLastPrice, convertPriceToNumberWithDecimals } from '../utils/defillama';
import { setTestChainId } from 'utils/deploy';
import moment from 'moment';
import { FeeAmount, encodePriceSqrt, getCreate2Address } from '@utils/uniswap';
import { utils } from 'ethers';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

contract('StaticOracle', () => {
  let user: SignerWithAddress;
  let staticOracle: StaticOracle;
  let snapshotId: string;

  let tokenA: ERC20Mock;
  let tokenB: ERC20Mock;

  let positionManager: NonfungiblePositionManager;
  let factory: IUniswapV3Factory;

  const PERIOD = moment.duration('3', 'minutes').as('seconds');

  before(async () => {
    [user] = await ethers.getSigners();

    await setTestChainId(1);

    await evm.reset({
      jsonRpcUrl: getNodeUrl('ethereum'),
      blockNumber: forkBlockNumber['ethereum-mainnet'],
    });

    await deployments.fixture(['StaticOracle'], { keepExistingDeployments: false });
    staticOracle = await ethers.getContract<StaticOracle>('StaticOracle');

    positionManager = await ethers.getContractAt<NonfungiblePositionManager>(
      NonfungiblePositionManager__factory.abi,
      '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
    );

    factory = await ethers.getContractAt<IUniswapV3Factory>(IUniswapV3Pool__factory.abi, await staticOracle.UNISWAP_V3_FACTORY());

    const tokenFactory = await ethers.getContractFactory<ERC20Mock__factory>('solidity/contracts/mocks/ERC20.sol:ERC20Mock');

    tokenA = await tokenFactory.deploy('TokenA', 'T1');
    tokenB = await tokenFactory.deploy('TokenB', 'T2');

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  // Tests general quoting mechanism
  describe('quote', () => {
    let feedPrice: number;
    const PRICE_THRESHOLD = 40;
    given(async () => {
      // We fork from ethereum mainnet so we can compare
      // correctly our quote
      await evm.reset({
        jsonRpcUrl: getNodeUrl('ethereum'),
      });
      await deployments.fixture(['StaticOracle'], { keepExistingDeployments: false });
      staticOracle = await ethers.getContract<StaticOracle>('StaticOracle');
      feedPrice = await getLastPrice(WETH);
    });
    it('returns correct twap', async () => {
      const [twap] = await staticOracle.quoteAllAvailablePoolsWithTimePeriod(
        utils.parseEther('1'),
        WETH,
        USDC,
        moment.duration('3', 'minutes').as('seconds')
      );
      expect(twap).to.be.within(
        convertPriceToNumberWithDecimals(feedPrice - PRICE_THRESHOLD, 6),
        convertPriceToNumberWithDecimals(feedPrice + PRICE_THRESHOLD, 6)
      );
    });
  });

  // If we would know how to deploy uniswap in a local fork, all of these
  // could easily be tested there and not through integration
  describe('quoteAllAvailablePoolsWithTimePeriod', () => {
    let pools: { [fees: number]: string } = {};
    when('there is a single pool', () => {
      context('and it doesnt have an observation oldest than the period', () => {
        given(async () => {
          pools = await createPoolsWithSupport({
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feesAndSupportingPeriod: [
              {
                fee: FeeAmount.MEDIUM,
                supportPeriod: false,
              },
            ],
          });
        });
        then(`tx gets reverted with 'No defined pools' error`, async () => {
          await expect(
            staticOracle.quoteAllAvailablePoolsWithTimePeriod(utils.parseEther('1'), tokenA.address, tokenB.address, PERIOD)
          ).to.be.revertedWith('No defined pools');
        });
      });
      context('and it has an observation oldest than the period', () => {
        given(async () => {
          pools = await createPoolsWithSupport({
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feesAndSupportingPeriod: [
              {
                fee: FeeAmount.MEDIUM,
                supportPeriod: true,
              },
            ],
          });
        });
        then('queries the pool', async () => {
          const [, quotedPools] = await staticOracle.callStatic.quoteAllAvailablePoolsWithTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            PERIOD
          );
          expect(quotedPools).to.eql([pools[FeeAmount.MEDIUM]]);
        });
      });
    });
    when('there are multiple pools', () => {
      context('and none have an observation oldest than the period', () => {
        given(async () => {
          pools = await createPoolsWithSupport({
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feesAndSupportingPeriod: [
              {
                fee: FeeAmount.LOW,
                supportPeriod: false,
              },
              {
                fee: FeeAmount.MEDIUM,
                supportPeriod: false,
              },
            ],
          });
        });
        then(`tx gets reverted with 'No defined pools' error`, async () => {
          await expect(
            staticOracle.quoteAllAvailablePoolsWithTimePeriod(utils.parseEther('1'), tokenA.address, tokenB.address, PERIOD)
          ).to.be.revertedWith('No defined pools');
        });
      });
      context('and some have an observation oldest than the period', () => {
        given(async () => {
          pools = await createPoolsWithSupport({
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            feesAndSupportingPeriod: [
              {
                fee: FeeAmount.LOW,
                supportPeriod: true,
              },
              {
                fee: FeeAmount.MEDIUM,
                supportPeriod: false,
              },
              {
                fee: FeeAmount.HIGH,
                supportPeriod: true,
              },
            ],
          });
        });
        then.skip('queries the correct pools', async () => {
          const [, quotedPools] = await staticOracle.callStatic.quoteAllAvailablePoolsWithTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            PERIOD
          );
          expect(quotedPools).to.eql([pools[FeeAmount.LOW], pools[FeeAmount.HIGH]]);
        });
      });
    });
  });

  describe('quoteSpecificFeeTiersWithTimePeriod', () => {
    when('quoting fee tiers that do not have pools', () => {
      then(`tx gets reverted with 'Given tier does not have pool' error`, async () => {
        await expect(
          staticOracle.quoteSpecificFeeTiersWithTimePeriod(utils.parseEther('1'), tokenA.address, tokenB.address, [FeeAmount.LOW], PERIOD)
        ).to.be.rejectedWith('Given tier does not have pool');
      });
    });
    when('quoting fee tiers that have pools but do not support period', () => {
      given(async () => {
        await createPoolsWithSupport({
          tokenA: tokenA.address,
          tokenB: tokenB.address,
          feesAndSupportingPeriod: [
            {
              fee: FeeAmount.LOW,
              supportPeriod: false,
            },
            {
              fee: FeeAmount.MEDIUM,
              supportPeriod: true,
            },
          ],
        });
      });
      // FIX: Does that error message make sense in this case?
      then(`tx gets reverted with 'Given tier does not have pool' error`, async () => {
        await expect(
          staticOracle.quoteSpecificFeeTiersWithTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            [FeeAmount.LOW, FeeAmount.HIGH],
            PERIOD
          )
        ).to.be.rejectedWith('Given tier does not have pool');
      });
    });
    when('quoting fee tiers that do have pools that support period', () => {
      given(async () => {
        await createPoolsWithSupport({
          tokenA: tokenA.address,
          tokenB: tokenB.address,
          feesAndSupportingPeriod: [
            {
              fee: FeeAmount.LOW,
              supportPeriod: true,
            },
            {
              fee: FeeAmount.MEDIUM,
              supportPeriod: true,
            },
          ],
        });
      });
      then.skip('correct pools get queried', async () => {
        const [, quotedPools] = await staticOracle.callStatic.quoteSpecificFeeTiersWithTimePeriod(
          utils.parseEther('1'),
          tokenA.address,
          tokenB.address,
          [FeeAmount.LOW, FeeAmount.MEDIUM],
          PERIOD
        );
        expect(quotedPools).to.eql([FeeAmount.LOW, FeeAmount.MEDIUM]);
      });
    });
  });

  async function createPoolsWithSupport({
    tokenA,
    tokenB,
    feesAndSupportingPeriod,
  }: {
    tokenA: string;
    tokenB: string;
    feesAndSupportingPeriod: { fee: FeeAmount; supportPeriod: boolean }[];
  }): Promise<{ [fee: number]: string }> {
    let feesToPools: { [fee: number]: string } = {};
    const supportedFees = feesAndSupportingPeriod.filter((feesAndSupportingPeriod) => feesAndSupportingPeriod.supportPeriod);
    const notSupportedFees = feesAndSupportingPeriod.filter((feesAndSupportingPeriod) => !feesAndSupportingPeriod.supportPeriod);

    for (let i = 0; i < supportedFees.length; i++) {
      feesToPools[supportedFees[i].fee] = await createPool({
        tokenA,
        tokenB,
        fee: supportedFees[i].fee,
      });
    }
    await evm.advanceTimeAndBlock(PERIOD);
    for (let i = 0; i < notSupportedFees.length; i++) {
      feesToPools[notSupportedFees[i].fee] = await createPool({
        tokenA,
        tokenB,
        fee: notSupportedFees[i].fee,
      });
    }
    return feesToPools;
  }

  async function createPool({ tokenA, tokenB, fee }: { tokenA: string; tokenB: string; fee: FeeAmount }): Promise<string> {
    await positionManager.createAndInitializePoolIfNecessary(tokenA, tokenB, fee, encodePriceSqrt(utils.parseEther(`1`), utils.parseEther(`1`)));
    return getCreate2Address(factory.address, [tokenA, tokenB], fee, IUniswapV3Pool__bytecode);
  }
});

import { bytecode as UniswapV3Pool__bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import { bytecode as UniswapV3Factory__bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import { ethers } from 'hardhat';
import { evm, wallet } from '@utils';
import { contract, given, then, when } from '@utils/bdd';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  ERC20Mock,
  ERC20Mock__factory,
  NonfungiblePositionManager,
  NonfungiblePositionManager__factory,
  IUniswapV3Factory,
  IUniswapV3Factory__factory,
  StaticOracleMock__factory,
  StaticOracleMock,
} from '@typechained';
import moment from 'moment';
import { FeeAmount, encodePriceSqrt, getCreate2Address, getMinTick, TICK_SPACINGS, getMaxTick } from '@utils/uniswap';
import { constants, ContractFactory, utils } from 'ethers';

contract('StaticOracle', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let staticOracle: StaticOracleMock;
  let snapshotId: string;

  let tokenA: ERC20Mock;
  let tokenB: ERC20Mock;

  let positionManager: NonfungiblePositionManager;
  let factory: IUniswapV3Factory;

  const PERIOD = moment.duration('3', 'minutes').as('seconds');

  async function deployUniV3(): Promise<void> {
    const uniswapFactoryContractFactory = new ContractFactory(IUniswapV3Factory__factory.abi, UniswapV3Factory__bytecode, deployer);

    factory = (await uniswapFactoryContractFactory.deploy()) as IUniswapV3Factory;

    const positionManagerContractFactory = new ContractFactory(
      NonfungiblePositionManager__factory.abi,
      NonfungiblePositionManager__factory.bytecode,
      deployer
    );

    positionManager = (await positionManagerContractFactory.deploy(
      factory.address,
      wallet.generateRandomAddress(),
      wallet.generateRandomAddress()
    )) as NonfungiblePositionManager;
  }

  before(async () => {
    [deployer, user] = await ethers.getSigners();

    await deployUniV3();

    const staticOracleFactory = (await ethers.getContractFactory(
      'solidity/contracts/mocks/StaticOracle.sol:StaticOracleMock'
    )) as StaticOracleMock__factory;

    staticOracle = await staticOracleFactory.deploy(factory.address, 60);

    const tokenFactory = (await ethers.getContractFactory('solidity/contracts/mocks/ERC20.sol:ERC20Mock')) as ERC20Mock__factory;

    tokenA = await tokenFactory.deploy('TokenA', 'T1');
    tokenB = await tokenFactory.deploy('TokenB', 'T2');

    await tokenA.mint(user.address, constants.MaxUint256);
    await tokenB.mint(user.address, constants.MaxUint256);

    await tokenA.connect(user).approve(positionManager.address, constants.MaxUint256);
    await tokenB.connect(user).approve(positionManager.address, constants.MaxUint256);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('isPairSupported', () => {
    when('the given pair has no pools', () => {
      then('it is not supported', async () => {
        expect(await staticOracle.isPairSupported(tokenA.address, tokenB.address)).to.be.false;
      });
    });
    when('the given pair has at least one pool', () => {
      given(async () => {
        await createPool({ tokenA: tokenA.address, tokenB: tokenB.address, fee: FeeAmount.MEDIUM });
        await staticOracle.isPairSupported(tokenA.address, tokenB.address);
      });
      then('it is supported', async () => {
        expect(await staticOracle.isPairSupported(tokenA.address, tokenB.address)).to.be.true;
      });
      then('it is also supported in reverse order', async () => {
        expect(await staticOracle.isPairSupported(tokenA.address, tokenB.address)).to.be.true;
      });
    });
  });

  describe('_getPoolsForTiers', () => {
    when('sending no fee tiers', () => {
      then('returns empty array', async () => {
        expect(await staticOracle.getPoolsForTiers(tokenA.address, tokenB.address, [])).to.be.empty;
      });
    });
    when('sending fee tiers but none have pool', () => {
      then('returns empty array', async () => {
        expect(await staticOracle.getPoolsForTiers(tokenA.address, tokenB.address, [500, 3000])).to.be.empty;
      });
    });
    when('sending fee tiers and some have pools', () => {
      let pools: { [fees: number]: string } = {};
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
      then('returns the ones that have pools', async () => {
        expect(
          await staticOracle.callStatic.getPoolsForTiers(tokenA.address, tokenB.address, [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH])
        ).to.eql(Object.values(pools));
      });
    });
  });

  describe('getAllPoolsForPair', () => {
    when('there are no pools', () => {
      then('an empty array is returned', async () => {
        expect(await staticOracle.getAllPoolsForPair(tokenA.address, tokenB.address)).to.be.empty;
      });
    });
    when('there are some pools', () => {
      let pools: { [fees: number]: string } = {};
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
      then('they are returned', async () => {
        expect(await staticOracle.callStatic.getAllPoolsForPair(tokenA.address, tokenB.address)).to.eql(Object.values(pools));
      });
    });
  });

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
        then('queries the correct pools', async () => {
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

  describe('quoteAllAvailablePoolsWithOffsettedTimePeriod', () => {
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
            staticOracle.quoteAllAvailablePoolsWithOffsettedTimePeriod(utils.parseEther('1'), tokenA.address, tokenB.address, PERIOD, PERIOD)
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
          const [, quotedPools] = await staticOracle.callStatic.quoteAllAvailablePoolsWithOffsettedTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            PERIOD / 2,
            PERIOD / 2
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
            staticOracle.quoteAllAvailablePoolsWithOffsettedTimePeriod(
              utils.parseEther('1'),
              tokenA.address,
              tokenB.address,
              PERIOD / 2,
              PERIOD / 2
            )
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
        then('queries the correct pools', async () => {
          const [, quotedPools] = await staticOracle.callStatic.quoteAllAvailablePoolsWithOffsettedTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            PERIOD / 2,
            PERIOD / 2
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
      let pools: { [fees: number]: string } = {};
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
              supportPeriod: true,
            },
          ],
        });
      });
      then('correct pools get queried', async () => {
        const [, quotedPools] = await staticOracle.callStatic.quoteSpecificFeeTiersWithTimePeriod(
          utils.parseEther('1'),
          tokenA.address,
          tokenB.address,
          [FeeAmount.LOW, FeeAmount.MEDIUM],
          PERIOD
        );
        expect(quotedPools).to.eql([pools[FeeAmount.LOW], pools[FeeAmount.MEDIUM]]);
      });
    });
  });

  describe('quoteSpecificFeeTiersWithOfsettedTimePeriod', () => {
    when('quoting fee tiers that do not have pools', () => {
      then(`tx gets reverted with 'Given tier does not have pool' error`, async () => {
        await expect(
          staticOracle.quoteSpecificFeeTiersWithOffsettedTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            [FeeAmount.LOW],
            PERIOD / 2,
            PERIOD / 2
          )
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
          staticOracle.quoteSpecificFeeTiersWithOffsettedTimePeriod(
            utils.parseEther('1'),
            tokenA.address,
            tokenB.address,
            [FeeAmount.LOW, FeeAmount.HIGH],
            PERIOD / 2,
            PERIOD / 2
          )
        ).to.be.rejectedWith('Given tier does not have pool');
      });
    });
    when('quoting fee tiers that do have pools that support period', () => {
      let pools: { [fees: number]: string } = {};
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
              supportPeriod: true,
            },
          ],
        });
      });
      then('correct pools get queried', async () => {
        const [, quotedPools] = await staticOracle.callStatic.quoteSpecificFeeTiersWithOffsettedTimePeriod(
          utils.parseEther('1'),
          tokenA.address,
          tokenB.address,
          [FeeAmount.LOW, FeeAmount.MEDIUM],
          PERIOD / 2,
          PERIOD / 2
        );
        expect(quotedPools).to.eql([pools[FeeAmount.LOW], pools[FeeAmount.MEDIUM]]);
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
    const token0 = tokenA < tokenB ? tokenA : tokenB;
    const token1 = tokenA < tokenB ? tokenB : tokenA;
    await positionManager
      .connect(user)
      .createAndInitializePoolIfNecessary(token0, token1, fee, encodePriceSqrt(utils.parseEther(`1`), utils.parseEther(`1`)));
    await positionManager.connect(user).mint({
      token0,
      token1,
      fee,
      tickLower: getMinTick(TICK_SPACINGS[fee]),
      tickUpper: getMaxTick(TICK_SPACINGS[fee]),
      amount0Desired: utils.parseEther('1'),
      amount1Desired: utils.parseEther('1'),
      amount0Min: 0,
      amount1Min: 0,
      recipient: user.address,
      deadline: moment().add('10', 'minutes').unix(),
    });
    return getCreate2Address(factory.address, [token0, token1], fee, UniswapV3Pool__bytecode);
  }
});

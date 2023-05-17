import chai, { expect } from 'chai';
import { FakeContract, smock } from '@defi-wonderland/smock';
import {
  IUniswapV3Factory,
  IUniswapV3Factory__factory,
  IUniswapV3Pool,
  IUniswapV3Pool__factory,
  StaticOracleMock,
  StaticOracleMock__factory,
} from '@typechained';
import { contract, given, then, when } from '@utils/bdd';
import { ethers } from 'hardhat';
import { snapshot } from '@utils/evm';
import { evm, wallet } from '@utils';
import { constants, utils } from 'ethers';
import moment from 'moment';

chai.use(smock.matchers);

contract('StaticOracle @skip-on-coverage', () => {
  let snapshotId: string;
  let staticOracle: StaticOracleMock;
  let staticOracleFactory: StaticOracleMock__factory;
  let uniswapV3Pool: FakeContract<IUniswapV3Pool>;
  let uniswapV3Pool2: FakeContract<IUniswapV3Pool>;
  let uniswapV3Factory: FakeContract<IUniswapV3Factory>;
  let supportedPools: Map<string, string>;

  const CARDINALITY_PER_MINUTE = 10;
  const BASE_KNOWN_FEE_TIERS = [500, 3_000, 10_000];
  const TOKEN_A = wallet.generateRandomAddress();
  const TOKEN_B = wallet.generateRandomAddress();

  before(async () => {
    uniswapV3Pool = await smock.fake<IUniswapV3Pool>(IUniswapV3Pool__factory.abi);
    uniswapV3Pool2 = await smock.fake<IUniswapV3Pool>(IUniswapV3Pool__factory.abi);
    uniswapV3Factory = await smock.fake<IUniswapV3Factory>(IUniswapV3Factory__factory.abi);
    staticOracleFactory = await ethers.getContractFactory<StaticOracleMock__factory>(
      'solidity/contracts/mocks/StaticOracle.sol:StaticOracleMock'
    );
    staticOracle = await staticOracleFactory.deploy(uniswapV3Factory.address, CARDINALITY_PER_MINUTE);
    snapshotId = await snapshot.take();
  });

  beforeEach('Deploy and configure', async () => {
    supportedPools = new Map<string, string>();
    uniswapV3Pool.observations.reset();
    uniswapV3Pool.slot0.reset();
    uniswapV3Pool2.observations.reset();
    uniswapV3Pool2.slot0.reset();
    uniswapV3Factory.feeAmountTickSpacing.reset();
    uniswapV3Factory.getPool.reset();
    uniswapV3Factory.getPool.returns(({ tokenA, tokenB, fee }: { tokenA: string; tokenB: string; fee: number }) => {
      const key = `${tokenA}-${tokenB}-${fee}`;
      return supportedPools.get(key) ?? constants.AddressZero;
    });
    await snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    when('contract is initiated', () => {
      then('factory is set', async () => {
        expect(await staticOracle.UNISWAP_V3_FACTORY()).to.equal(uniswapV3Factory.address);
      });
      then('cardinality per minute is set', async () => {
        expect(await staticOracle.CARDINALITY_PER_MINUTE()).to.equal(CARDINALITY_PER_MINUTE);
      });
      then('default fee tiers are set', async () => {
        expect(await staticOracle.knownFeeTiers()).to.eql(BASE_KNOWN_FEE_TIERS);
      });
    });
  });

  describe('supportedFeeTiers', () => {
    when('no added tiers', () => {
      then('returns default fee tiers', async () => {
        expect(await staticOracle.supportedFeeTiers()).to.eql(BASE_KNOWN_FEE_TIERS);
      });
    });
    when('tiers were added', () => {
      const NEW_TIER = 20_000;
      given(async () => {
        await staticOracle.addKnownFeeTier(NEW_TIER);
      });
      then('returns correct fee tiers', async () => {
        expect(await staticOracle.supportedFeeTiers()).to.eql([...BASE_KNOWN_FEE_TIERS, NEW_TIER]);
      });
    });
  });

  describe('prepareAllAvailablePoolsWithTimePeriod', () => {
    let pools: FakeContract<IUniswapV3Pool>[];
    const PERIOD = moment.duration('2', 'minutes').as('seconds');
    given(async () => {
      pools = [uniswapV3Pool, uniswapV3Pool2];
      await staticOracle.setPoolForTiersReturn(pools.map((pool) => pool.address));
      await staticOracle.prepareAllAvailablePoolsWithTimePeriod(TOKEN_A, TOKEN_B, PERIOD);
    });
    when('called', () => {
      thenIncreasesCardinalityForPools({
        pools: () => pools,
        period: PERIOD,
      });
    });
  });

  describe('prepareSpecificFeeTiersWithTimePeriod', () => {
    when('sending tiers that do not have pool', () => {
      given(async () => {
        await staticOracle.setPoolForTiersReturn([]);
      });
      then('tx reverts with message', async () => {
        await expect(staticOracle.prepareSpecificFeeTiersWithTimePeriod(TOKEN_A, TOKEN_B, [300], 100)).to.be.revertedWith(
          'Given tier does not have pool'
        );
      });
    });
    when('all sent tiers have pools', () => {
      let pools: FakeContract<IUniswapV3Pool>[];
      const PERIOD = moment.duration('2', 'minutes').as('seconds');
      given(async () => {
        pools = [uniswapV3Pool];
        await staticOracle.setPoolForTiersReturn(pools.map((pool) => pool.address));
        await staticOracle.prepareSpecificFeeTiersWithTimePeriod(TOKEN_A, TOKEN_B, [300], PERIOD);
      });
      thenIncreasesCardinalityForPools({
        pools: () => pools,
        period: PERIOD,
      });
    });
  });

  describe('prepareSpecificPoolsWithTimePeriod', () => {
    let pools: FakeContract<IUniswapV3Pool>[];
    const PERIOD = moment.duration('1', 'minutes').as('seconds');
    given(async () => {
      pools = [uniswapV3Pool, uniswapV3Pool2];
      await staticOracle.prepareSpecificPoolsWithTimePeriod(
        pools.map((pool) => pool.address),
        PERIOD
      );
    });
    thenIncreasesCardinalityForPools({
      pools: () => pools,
      period: PERIOD,
    });
  });

  describe('prepareAllAvailablePoolsWithCardinality', () => {
    let pools: FakeContract<IUniswapV3Pool>[];
    const CARDINALITY = 50;
    given(async () => {
      pools = [uniswapV3Pool, uniswapV3Pool2];
      await staticOracle.setPoolForTiersReturn(pools.map((pool) => pool.address));
      await staticOracle.prepareAllAvailablePoolsWithCardinality(TOKEN_A, TOKEN_B, CARDINALITY);
    });
    when('called', () => {
      thenIncreasesCardinalityForPools({
        pools: () => pools,
        cardinality: CARDINALITY,
      });
    });
  });

  describe('prepareSpecificFeeTiersWithCardinality', () => {
    when('sending tiers that do not have pool', () => {
      given(async () => {
        await staticOracle.setPoolForTiersReturn([]);
      });
      then('tx reverts with message', async () => {
        await expect(staticOracle.prepareSpecificFeeTiersWithCardinality(TOKEN_A, TOKEN_B, [300], 100)).to.be.revertedWith(
          'Given tier does not have pool'
        );
      });
    });
    when('all sent tiers have pools', () => {
      let pools: FakeContract<IUniswapV3Pool>[];
      const CARDINALITY = 39;
      given(async () => {
        pools = [uniswapV3Pool];
        await staticOracle.setPoolForTiersReturn(pools.map((pool) => pool.address));
        await staticOracle.prepareSpecificFeeTiersWithCardinality(TOKEN_A, TOKEN_B, [300], CARDINALITY);
      });
      thenIncreasesCardinalityForPools({
        pools: () => pools,
        cardinality: CARDINALITY,
      });
    });
  });

  describe('prepareSpecificPoolsWithCardinality', () => {
    let pools: FakeContract<IUniswapV3Pool>[];
    const CARDINALITY = 14;
    given(async () => {
      pools = [uniswapV3Pool, uniswapV3Pool2];
      await staticOracle.prepareSpecificPoolsWithCardinality(
        pools.map((pool) => pool.address),
        CARDINALITY
      );
    });
    thenIncreasesCardinalityForPools({
      pools: () => pools,
      cardinality: CARDINALITY,
    });
  });

  function thenIncreasesCardinalityForPools({
    pools,
    cardinality,
    period,
  }: {
    pools: () => FakeContract<IUniswapV3Pool>[];
    cardinality?: number;
    period?: number;
  }): void {
    then('increases cardinality correctly for pools', () => {
      const poolsToTest = pools();
      cardinality = cardinality ?? getCardinalityForPeriod(period!);
      for (let i = 0; i < poolsToTest.length; i++) {
        expect(poolsToTest[i].increaseObservationCardinalityNext).to.have.been.calledWith(cardinality);
      }
    });
  }

  describe('addNewFeeTier', () => {
    const NEW_TIER = 20_000;
    when('trying to add a non-factory fee tier', () => {
      given(() => {
        uniswapV3Factory.feeAmountTickSpacing.returns(0);
      });
      then(`tx gets reverted with 'Invalid fee tier' message`, async () => {
        await expect(staticOracle.addNewFeeTier(NEW_TIER)).to.be.revertedWith('Invalid fee tier');
        expect(uniswapV3Factory.feeAmountTickSpacing).to.have.been.calledOnceWith(NEW_TIER);
      });
    });
    when('adding an already added fee tier', () => {
      given(async () => {
        uniswapV3Factory.feeAmountTickSpacing.returns(1);
        await staticOracle.addKnownFeeTier(NEW_TIER);
      });
      then(`tx gets reverted with 'Tier already supported' message`, async () => {
        await expect(staticOracle.addNewFeeTier(NEW_TIER)).to.be.revertedWith('Tier already supported');
      });
    });
    when('adding valid fee tier', () => {
      given(async () => {
        uniswapV3Factory.feeAmountTickSpacing.returns(1);
        await staticOracle.addNewFeeTier(NEW_TIER);
      });
      then('gets added to known tiers', async () => {
        expect(await staticOracle.knownFeeTiers()).to.include(NEW_TIER);
      });
    });
  });

  describe('_getCardinalityForTimePeriod', () => {
    it('calculates cardinality for time period correctly', async () => {
      expect(await staticOracle.getCardinalityForTimePeriod(30)).to.be.equal(getCardinalityForPeriod(30));
    });
  });

  describe('_prepare', () => {
    let pools: FakeContract<IUniswapV3Pool>[];
    const PERIOD = moment.duration('1', 'minutes').as('seconds');
    given(async () => {
      pools = [uniswapV3Pool, uniswapV3Pool2];
      await staticOracle.prepare(
        pools.map((pool) => pool.address),
        PERIOD
      );
    });
    thenIncreasesCardinalityForPools({
      pools: () => pools,
      period: PERIOD,
    });
  });

  describe('_quote', () => {
    when('not quoting any pool', () => {
      then('tx reverts with message', async () => {
        await expect(staticOracle.quote(utils.parseEther('1'), TOKEN_A, TOKEN_B, [], 100)).to.be.revertedWith('Given tier does not have pool');
      });
    });
    when('quoting an offsetted spot price', () => {
      then('tx reverts with message', async () => {
        await expect(staticOracle.quoteOffsetted(utils.parseEther('1'), TOKEN_A, TOKEN_B, [uniswapV3Pool.address], 0, 100)).to.be.revertedWith(
          'Cannot query an offsetted spot quote'
        );
      });
    });
  });

  describe('_getQueryablePoolsForTiers', () => {
    given(async () => {
      await staticOracle.setPoolForTiersReturn([uniswapV3Pool.address, uniswapV3Pool2.address]);
    });
    when('period is zero', () => {
      then('returns all pools for that tier', async () => {
        expect(await staticOracle.getQueryablePoolsForTiers(TOKEN_A, TOKEN_B, 0)).to.eql([uniswapV3Pool.address, uniswapV3Pool2.address]);
      });
    });
    when('period is not zero', () => {
      const PERIOD = moment.duration('2', 'minutes').as('seconds');
      context(`and all pool's observations are bigger or equal than period`, () => {
        given(async () => {
          // Avoid bug when not controlling execution times
          const futureTimestamp = moment().add('1', 'hour').unix();
          await evm.advanceToTimeAndBlock(futureTimestamp);
          setLastTradeTimeToPool({
            pool: uniswapV3Pool,
            tradeTimestamp: futureTimestamp - PERIOD * 1.5,
          });
          setLastTradeTimeToPool({
            pool: uniswapV3Pool2,
            tradeTimestamp: futureTimestamp - PERIOD * 1.5,
          });
        });
        then('returns all pools', async () => {
          expect(await staticOracle.getQueryablePoolsForTiers(TOKEN_A, TOKEN_B, PERIOD)).to.eql([uniswapV3Pool.address, uniswapV3Pool2.address]);
        });
      });
      context(`and not all pool's observations are bigger or equal than period`, () => {
        given(async () => {
          // Avoid bug when not controlling execution times
          const futureTimestamp = moment().add('1', 'hour').unix();
          await evm.advanceToTimeAndBlock(futureTimestamp);
          setLastTradeTimeToPool({
            pool: uniswapV3Pool,
            tradeTimestamp: futureTimestamp - PERIOD * 1.5,
          });
          setLastTradeTimeToPool({
            pool: uniswapV3Pool2,
            tradeTimestamp: futureTimestamp - PERIOD / 2,
          });
        });
        then('returns only those who are', async () => {
          expect(await staticOracle.getQueryablePoolsForTiers(TOKEN_A, TOKEN_B, PERIOD)).to.eql([uniswapV3Pool.address]);
        });
      });
    });
  });

  function setLastTradeTimeToPool({ pool, tradeTimestamp }: { pool: FakeContract<IUniswapV3Pool>; tradeTimestamp: number }): void {
    const observationIndex = 4;
    const observationCardinality = 7;
    pool.slot0.returns([
      0, // sqrtPriceX96
      0, // tick
      observationIndex, // observationIndex
      observationCardinality, // observationCardinality
      0, // observationCardinalityNext
      0, // feeProtocol
      true, // unlocked
    ]);
    pool.observations.whenCalledWith((observationIndex + 1) % observationCardinality).returns([
      tradeTimestamp, // blockTimestamp,
      0, // tickCumulative,
      0, // secondsPerLiquidityCumulativeX128,
      true, // initialized
    ]);
  }

  function getCardinalityForPeriod(period: number): number {
    return (period * CARDINALITY_PER_MINUTE) / 60 + 1;
  }
});

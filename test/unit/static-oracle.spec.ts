import chai, { expect } from 'chai';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
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
import { hexZeroPad } from 'ethers/lib/utils';
import { wallet } from '@utils';
import { constants } from 'ethers';
import moment from 'moment';

chai.use(smock.matchers);

contract('StaticOracle', () => {
  let snapshotId: string;
  let staticOracle: StaticOracleMock;
  let staticOracleFactory: StaticOracleMock__factory;
  let uniswapV3Pool: FakeContract<IUniswapV3Pool>;
  let uniswapV3Pool2: FakeContract<IUniswapV3Pool>;
  let uniswapV3Factory: FakeContract<IUniswapV3Factory>;
  let supportedPools: Map<string, string>;

  const CARDINALITY_PER_MINUTE = 10;
  const BASE_KNOWN_FEE_TIERS = [300, 5_000, 10_000];
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

  describe('quoteAllAvailablePoolsWithTimePeriod', () => {
    then('todo');
  });

  describe('quoteSpecificFeeTiersWithTimePeriod', () => {
    then('todo');
  });

  describe('quoteSpecificPoolsWithTimePeriod', () => {
    then('todo');
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
      thenIncreasesCardinalityForPeriodForPools({
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
      thenIncreasesCardinalityForPeriodForPools({
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
    thenIncreasesCardinalityForPeriodForPools({
      pools: () => pools,
      period: PERIOD,
    });
  });

  function thenIncreasesCardinalityForPeriodForPools({ pools, period }: { pools: () => FakeContract<IUniswapV3Pool>[]; period: number }): void {
    then('increases cardinality correctly for pools', () => {
      const poolsToTest = pools();
      const cardinality = getCardinalityForPeriod(period);
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
    thenIncreasesCardinalityForPeriodForPools({
      pools: () => pools,
      period: PERIOD,
    });
  });

  describe('_quote', () => {
    then('todo');
  });

  describe('_getQueryablePoolsForTiers', () => {
    when('period is zero', () => {
      then('returns all pools for that tier');
    });
    when('period is not zero', () => {
      context(`and all pool's observations are bigger or equal than period`, () => {
        then('returns all pools');
      });
      context(`and not all pool's observations are bigger or equal than period`, () => {
        then('returns only those who are');
      });
    });
  });

  describe('_getPoolsForTiers', () => {
    when('sending none fee tiers', () => {
      then('returns empty array', async () => {
        expect(await staticOracle.getPoolsForTiers(TOKEN_A, TOKEN_B, [])).to.be.empty;
      });
    });
    when('sending fee tiers but none have pool', () => {
      then('returns empty array', async () => {
        expect(await staticOracle.getPoolsForTiers(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS)).to.be.empty;
      });
    });
    when('sending fee tiers and some have pools', () => {
      const POOL_A = wallet.generateRandomAddress();
      const POOL_B = wallet.generateRandomAddress();
      let pools: string[];
      given(async () => {
        addPoolToFactory(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS[1], POOL_A);
        addPoolToFactory(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS[2], POOL_B);
        pools = await staticOracle.callStatic.getPoolsForTiers(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS);
      });
      then('returns the ones that have pools', async () => {
        expect(uniswapV3Factory.getPool).to.have.been.calledWith(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS[0]);
        expect(uniswapV3Factory.getPool).to.have.been.calledWith(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS[1]);
        expect(uniswapV3Factory.getPool).to.have.been.calledWith(TOKEN_A, TOKEN_B, BASE_KNOWN_FEE_TIERS[2]);
        expect(pools).to.eql([POOL_A, POOL_B]);
      });
    });
  });

  describe('_copyValidElementsIntoNewArray', () => {
    when('copying all valid elements of temp array', () => {
      then('returns temp array', async () => {
        expect(
          await staticOracle.copyValidElementsIntoNewArray([hexZeroPad('0x1', 20), hexZeroPad('0x2', 20), hexZeroPad('0x3', 20)], 3)
        ).to.eql([hexZeroPad('0x1', 20), hexZeroPad('0x2', 20), hexZeroPad('0x3', 20)]);
      });
    });
    when('copying part of the elements of temp array', () => {
      then('returns array with valid elements', async () => {
        const ARRAY = [hexZeroPad('0x1', 20), hexZeroPad('0x2', 20), hexZeroPad('0x3', 20)];
        expect(await staticOracle.copyValidElementsIntoNewArray(ARRAY, 2)).to.eql([hexZeroPad('0x1', 20), hexZeroPad('0x2', 20)]);
      });
    });
    when('copying just one element of temp array', () => {
      then('returns array with the first element', async () => {
        const ARRAY = [hexZeroPad('0x1', 20), hexZeroPad('0x2', 20), hexZeroPad('0x3', 20)];
        expect(await staticOracle.copyValidElementsIntoNewArray(ARRAY, 1)).to.eql([hexZeroPad('0x1', 20)]);
      });
    });
  });

  function addPoolToFactory(tokenA: string, tokenB: string, fee: number, pool: string) {
    const key = `${tokenA}-${tokenB}-${fee}`;
    supportedPools.set(key, pool);
  }

  function getCardinalityForPeriod(period: number): number {
    return (period * CARDINALITY_PER_MINUTE) / 60 + 1;
  }
});

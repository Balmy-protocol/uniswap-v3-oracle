import { bytecode as UniswapV3Pool__bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import { bytecode as UniswapV3Factory__bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import blablaArtifact from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json';
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
  StaticOracle,
  IUniswapV3Pool__factory,
  IUniswapV3Factory,
  IUniswapV3Factory__factory,
  SwapRouter__factory,
  SwapRouter,
  TickLens__factory,
  TickLens,
  NFTDescriptor__factory,
  NFTDescriptor,
  NonfungibleTokenPositionDescriptor,
  NonfungibleTokenPositionDescriptor__factory,
  QuoterV2__factory,
  QuoterV2,
  StaticOracleMock__factory,
  WETH9__factory,
} from '@typechained';
import moment from 'moment';
import { FeeAmount, encodePriceSqrt, getCreate2Address } from '@utils/uniswap';
import { ContractFactory, utils } from 'ethers';

contract('StaticOracle', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let staticOracle: StaticOracle;
  let snapshotId: string;

  let tokenA: ERC20Mock;
  let tokenB: ERC20Mock;

  let positionManager: NonfungiblePositionManager;
  let factory: IUniswapV3Factory;

  const PERIOD = moment.duration('3', 'minutes').as('seconds');

  async function deployUniV3(): Promise<void> {
    const wethContractFactory = new ContractFactory(WETH9__factory.abi, WETH9__factory.bytecode, deployer);

    const weth = await wethContractFactory.deploy();
    console.log('weth address', weth.address);

    const uniswapFactoryContractFactory = new ContractFactory(IUniswapV3Factory__factory.abi, UniswapV3Factory__bytecode, deployer);

    factory = (await uniswapFactoryContractFactory.deploy()) as IUniswapV3Factory;
    console.log('factory address', factory.address);

    // Proxy admin

    // Tick lens
    // const tickLensContractFactory = new ContractFactory(
    //   TickLens__factory.abi,
    //   TickLens__factory.bytecode,
    //   deployer
    // );

    // const tickLens = (await tickLensContractFactory.deploy()) as TickLens;
    // console.log('tickLens address', tickLens.address);

    // // QuoterV2
    // const quoterContractFactory = new ContractFactory(
    //   QuoterV2__factory.abi,
    //   QuoterV2__factory.bytecode,
    //   deployer
    // );

    // const quoter = (await quoterContractFactory.deploy(
    //   factory.address,
    //   weth.address
    // )) as QuoterV2;
    // console.log('quoter address', quoter.address);

    // const swapRouterContractFactory = new ContractFactory(
    //   SwapRouter__factory.abi,
    //   SwapRouter__factory.bytecode,
    //   deployer
    // );

    // const swapRouter = (await swapRouterContractFactory.deploy(
    //   factory.address,
    //   weth.address
    // )) as SwapRouter;
    // console.log('swapRouter address', swapRouter.address);

    // NFTDescriptor
    const nftDescriptorContractFactory = new ContractFactory(NFTDescriptor__factory.abi, NFTDescriptor__factory.bytecode, deployer);

    const nftDescriptor = (await nftDescriptorContractFactory.deploy()) as NFTDescriptor;
    console.log('nftDescriptor address', nftDescriptor.address);

    // NonfungibleTokenPositionDescriptor
    const nftTokenPositionDescriptorContractFactory = await ethers.getContractFactoryFromArtifact(blablaArtifact, {
      signer: deployer,
      libraries: {
        NFTDescriptor: nftDescriptor.address,
      },
    });

    console.log('passed nftTokenPositionDescriptorContractFactory');

    const nftTokenPositionDescriptor = (await nftTokenPositionDescriptorContractFactory.deploy(
      weth.address,
      '0x4554480000000000000000000000000000000000000000000000000000000000' // WETH as bytes32
    )) as NonfungibleTokenPositionDescriptor;
    console.log('nftTokenPositionDescriptor address', nftTokenPositionDescriptor.address);

    const positionManagerContractFactory = new ContractFactory(
      NonfungiblePositionManager__factory.abi,
      NonfungiblePositionManager__factory.bytecode,
      deployer
    );

    positionManager = (await positionManagerContractFactory.deploy(
      factory.address,
      weth.address,
      nftTokenPositionDescriptor.address
    )) as NonfungiblePositionManager;
    console.log('positionManager address', positionManager.address);
    // Set owner
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

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
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
    console.log('b4 createAndInitializePoolIfNecessary', tokenA < tokenB);
    const token0 = tokenA < tokenB ? tokenA : tokenB;
    const token1 = tokenA < tokenB ? tokenB : tokenA;
    await positionManager.createAndInitializePoolIfNecessary(token0, tokenA, fee, encodePriceSqrt(utils.parseEther(`1`), utils.parseEther(`1`)));
    console.log('created at least one');
    return getCreate2Address(factory.address, [token0, tokenA], fee, UniswapV3Pool__bytecode);
  }
});

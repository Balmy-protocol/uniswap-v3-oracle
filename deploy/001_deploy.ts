import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';
import { deploy, getCreationCode } from '@utils/contracts';
import { ethers } from 'hardhat';
import { utils } from 'ethers';
import { StaticOracle__factory } from '@typechained';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const UNISWAP_V3_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

export const CARDINALITY_PER_MINUTE: { [chainId: string]: number } = {
  '1': 4, // Ethereum: Blocks every ~15s
  '3': 1, // Ethereum Ropsten: Blocks every ~60s
  '4': 4, // Ethereum Rinkeby: Blocks every ~15s
  '5': 4, // Ethereum Goerli: Blocks every ~15s
  '42': 13, // Ethereum Kovan: Blocks every ~4s
  '10': 60, // Optimism: Blocks every ~1s
  '69': 60, // Optimism Kovan: Blocks every ~12
  '42161': 60, // Arbitrum: Blocks every ~1s
  '421613': 60, // Arbitrum Goerli: Blocks every ~1s
  '137': 30, // Polygon: Blocks every ~2s
  '80001': 12, // Polygon Mumbai: Blocks every ~5s
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  await deployThroughDeterministicFactory({
    deployer,
    name: 'StaticOracle',
    salt: 'MF-UniswapV3-StaticOracle-V1',
    contract: 'solidity/contracts/StaticOracle.sol:StaticOracle',
    bytecode: StaticOracle__factory.bytecode,
    constructorArgs: {
      types: ['address', 'uint8'],
      values: [UNISWAP_V3_FACTORY_ADDRESS, CARDINALITY_PER_MINUTE[chainId]],
    },
    log: !process.env.TEST,
    overrides: {
      gasLimit: 3_000_000,
    },
  });
};

deployFunction.dependencies = [];
deployFunction.tags = ['StaticOracle'];
export default deployFunction;

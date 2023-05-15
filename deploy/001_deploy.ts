import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';
import { StaticOracle__factory } from '@typechained';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const UNISWAP_V3_FACTORY_ADDRESS: { [chainId: string]: string } = {
  '1': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '3': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '4': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '5': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '42': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '10': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '56': '0xdb1d10011ad0ff90774d0c6bb92e5c5c8b4461f7',
  '69': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '42161': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '421611': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '137': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '80001': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '84531': '0x76B071f1c32a3E6Fc73ED7F1b5668Bd51506F5E0',
};

export const CARDINALITY_PER_MINUTE: { [chainId: string]: number } = {
  '1': 4, // Ethereum: Blocks every ~15s
  '3': 1, // Ethereum Ropsten: Blocks every ~60s
  '4': 4, // Ethereum Rinkeby: Blocks every ~15s
  '5': 4, // Ethereum Goerli: Blocks every ~15s
  '42': 13, // Ethereum Kovan: Blocks every ~4s
  '10': 60, // Optimism: Blocks every ~1s
  '56': 20, // BNB: Blocks every ~3
  '69': 60, // Optimism Kovan: Blocks every ~12
  '42161': 60, // Arbitrum: Blocks every ~1s
  '421611': 60, // Arbitrum Rinkeby: Blocks every ~1s
  '137': 30, // Polygon: Blocks every ~2s
  '80001': 12, // Polygon Mumbai: Blocks every ~5s
  '84531': 30, // Base Goerli: Blocks every ~2s
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  await deployThroughDeterministicFactory({
    deployer,
    name: 'StaticOracle',
    salt: 'MF-UniswapV3-StaticOracle-V2',
    contract: 'solidity/contracts/StaticOracle.sol:StaticOracle',
    bytecode: StaticOracle__factory.bytecode,
    constructorArgs: {
      types: ['address', 'uint8'],
      values: [UNISWAP_V3_FACTORY_ADDRESS[chainId], CARDINALITY_PER_MINUTE[chainId]],
    },
    log: !process.env.TEST,
    overrides: {
      gasLimit: 20_000_000,
      maxPriorityFeePerGas: 0,
    },
  });
};

deployFunction.dependencies = [];
deployFunction.tags = ['StaticOracle'];
export default deployFunction;

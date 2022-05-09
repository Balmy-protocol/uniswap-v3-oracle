import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';
import { deploy, getCreationCode } from '@utils/contracts';
import { ethers } from 'hardhat';
import { utils } from 'ethers';
import { StaticOracle__factory } from '@typechained';
import { DeterministicFactory } from '@mean-finance/deterministic-factory/typechained';
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
  '421611': 60, // Arbitrum Rinkeby: Blocks every ~1s
  '137': 30, // Polygon: Blocks every ~2s
  '80001': 12, // Polygon Mumbai: Blocks every ~5s
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);

  const deterministicFactory = await ethers.getContract<DeterministicFactory>('DeterministicFactory');

  const SALT = utils.formatBytes32String('ffff-v2.1.2');

  const args = [UNISWAP_V3_FACTORY_ADDRESS, CARDINALITY_PER_MINUTE[chainId]];

  const creationCode = getCreationCode({
    bytecode: StaticOracle__factory.bytecode,
    constructorArgs: {
      types: ['address', 'uint8'],
      values: args,
    },
  });

  const receipt = await hre.deployments.execute(
    'DeterministicFactory',
    {
      from: deployer,
      log: true,
      waitConfirmations: 10,
    },
    'deploy',
    SALT, // SALT
    creationCode,
    0 // Value
  );

  const deployment = await hre.deployments.buildDeploymentSubmission({
    name: 'StaticOracle',
    contractAddress: await deterministicFactory.getDeployed(SALT),
    options: {
      contract: 'solidity/contracts/StaticOracle.sol:StaticOracle',
      from: deployer,
      args,
    },
    receipt,
  });

  await hre.deployments.save('StaticOracle', deployment);
};
deployFunction.dependencies = [];
deployFunction.tags = ['StaticOracle'];
export default deployFunction;

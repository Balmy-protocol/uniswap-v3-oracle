import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getChainId, shouldVerifyContract } from '../utils/deploy';
import { deploy, getCreationCode } from '@utils/contracts';
import hre, { ethers } from 'hardhat';
import { StaticOracle__factory } from '../typechained/factories/artifacts/solidity/contracts';
import '@nomiclabs/hardhat-etherscan';

const UNISWAP_V3_FACTORY_ADDRESS = '0x53B23D577ef40c49Fc30EdAB9287B241D6e7977A';

export const CARDINALITY_PER_MINUTE = 60;

async function deployStaticOracle() {
  // const { deployer } = await hre.getNamedAccounts();
  const deployer = (await ethers.getSigners())[0].address;

  const factory = await ethers.getContractFactory('StaticOracle');
  const instance = await factory.deploy(UNISWAP_V3_FACTORY_ADDRESS, CARDINALITY_PER_MINUTE);
  await instance.deployed();
  console.log('StaticOracle', ' deployed to:', instance.address);

  //Verify
  await hre.run('verify:verify', {
    address: instance.address,
    constructorArguments: [UNISWAP_V3_FACTORY_ADDRESS, CARDINALITY_PER_MINUTE],
  });
}

deployStaticOracle().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { Contract, ContractFactory } from '@ethersproject/contracts';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { ContractInterface, Signer } from 'ethers';
import { getAddress, getStatic, ParamType, solidityKeccak256 } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

export const deploy = async (contract: ContractFactory, args: any[]): Promise<{ tx: TransactionResponse; contract: Contract }> => {
  const deploymentTransactionRequest = await contract.getDeployTransaction(...args);
  const deploymentTx = await contract.signer.sendTransaction(deploymentTransactionRequest);
  const contractAddress = getStatic<(deploymentTx: TransactionResponse) => string>(contract.constructor, 'getContractAddress')(deploymentTx);
  const deployedContract = getStatic<(contractAddress: string, contractInterface: ContractInterface, signer?: Signer) => Contract>(
    contract.constructor,
    'getContract'
  )(contractAddress, contract.interface, contract.signer);
  return {
    tx: deploymentTx,
    contract: deployedContract,
  };
};

export const getCreationCode = ({
  bytecode,
  constructorArgs,
}: {
  bytecode: string;
  constructorArgs: { types: string[] | ParamType[]; values: any[] };
}): string => {
  return `${bytecode}${ethers.utils.defaultAbiCoder.encode(constructorArgs.types, constructorArgs.values).slice(2)}`;
};

export const getCreate2Address = (create2DeployerAddress: string, salt: string, bytecode: string): string => {
  return getAddress(
    '0x' +
      solidityKeccak256(
        ['bytes'],
        [`0xff${create2DeployerAddress.slice(2)}${salt.slice(2)}${solidityKeccak256(['bytes'], [bytecode]).slice(2)}`]
      ).slice(-40)
  );
};

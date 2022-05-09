import { BigNumber, BigNumberish, utils } from 'ethers';
import bn from 'bignumber.js';

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;

export function getCreate2Address(factoryAddress: string, [tokenA, tokenB]: [string, string], fee: number, bytecode: string): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0, token1, fee]);
  const create2Inputs = [
    '0xff',
    factoryAddress,
    // salt
    utils.keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    utils.keccak256(bytecode),
  ];
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`;
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`);
}

export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
  bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });
  return BigNumber.from(new bn(reserve1.toString()).div(reserve0.toString()).sqrt().multipliedBy(new bn(2).pow(96)).integerValue(3).toString());
}

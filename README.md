[![Lint](https://github.com/Mean-Finance/uniswap-v3-oracle/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/Mean-Finance/uniswap-v3-oracle/actions/workflows/lint.yml)
[![Tests](https://github.com/Mean-Finance/uniswap-v3-oracle/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/Mean-Finance/uniswap-v3-oracle/actions/workflows/tests.yml)
[![Slither Analysis](https://github.com/Mean-Finance/uniswap-v3-oracle/actions/workflows/slither.yml/badge.svg?branch=main)](https://github.com/Mean-Finance/uniswap-v3-oracle/actions/workflows/slither.yml)

# StaticOracle

StaticOracle is a tool developed under Uniswap's grant program that aims to help developers integrate easily and fast with uniswap's v3 twaps oracles.

This is done by leveraging already existing [WeightedOracleLibrary]() implemented by [Nicolás Chamo](https://github.com/nchamo).

StaticOracle will allow developers to:

- Prepare a set of pools (for exmaple: by a token pair and a fee tier) to support a certain period of time (for example: 60 seconds).
- Quote a TWAP for a set of pools (for exmaple: by a token pair and a fee tier, or addresses).

## Package

The package will contain:

- Artifacts can be found under `@mean-finance/uniswap-v3-oracles/artifacts`
- Compatible deployments for [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) plugin under the `@mean-finance/uniswap-v3-oracle/deployments` folder.
- Typescript smart contract typings under `@mean-finance/uniswap-v3-oracle/typechained`

## Installation

To install with [**Hardhat**](https://github.com/nomiclabs/hardhat) or [**Truffle**](https://github.com/trufflesuite/truffle):

#### YARN

```sh
yarn install @mean-finance/uniswap-v3-oracle
```

### NPM

```sh
npm install @mean-finance/uniswap-v3-oracle
```

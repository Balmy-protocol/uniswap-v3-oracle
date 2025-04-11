[![Lint](https://github.com/Balmy-protocol/uniswap-v3-oracle/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/Balmy-protocol/uniswap-v3-oracle/actions/workflows/lint.yml)
[![Tests](https://github.com/Balmy-protocol/uniswap-v3-oracle/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/Balmy-protocol/uniswap-v3-oracle/actions/workflows/tests.yml)
[![Slither Analysis](https://github.com/Balmy-protocol/uniswap-v3-oracle/actions/workflows/slither.yml/badge.svg?branch=main)](https://github.com/Balmy-protocol/uniswap-v3-oracle/actions/workflows/slither.yml)

# StaticOracle

StaticOracle is a tool developed under Uniswap's grant program that aims to help developers integrate easily and fast with Uniswap's v3 TWAP oracles.

This is done by leveraging already existing [WeightedOracleLibrary](https://github.com/Uniswap/v3-periphery/pull/146) implemented by [Nicolás Chamo](https://github.com/nchamo).

StaticOracle will allow developers to:

- Prepare a set of pools (for example: by a token pair and a fee tier) to support a certain period of time (for example: 60 seconds).
- Quote a TWAP for a set of pools (for example: by a token pair and a fee tier, or addresses).

## Package

The package will contain:

- Artifacts can be found under `@balmy/uniswap-v3-oracles/artifacts`
- Compatible deployments for [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) plugin under the `@balmy/uniswap-v3-oracle/deployments` folder.
- Typescript smart contract typings under `@balmy/uniswap-v3-oracle/typechained`

## Documentation

Everything that you need to know as a developer on how to use StaticOracle can be read in the [documented interface](./solidity/interfaces/IStaticOracle.sol).

## Installation

To install with [**Hardhat**](https://github.com/nomiclabs/hardhat) or [**Truffle**](https://github.com/trufflesuite/truffle):

#### YARN

```sh
yarn install @balmy/uniswap-v3-oracle
```

### NPM

```sh
npm install @balmy/uniswap-v3-oracle
```

### Deployment Registry

Contract deployed at the same address `0xB210CE856631EeEB767eFa666EC7C1C57738d438` accross the following networks:

- [Ethereum Rinkeby](https://rinkeby.etherscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Ethereum Goerli](https://goerli.etherscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Ethereum Mainnet](https://etherscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Optimism Mainnet](https://optimistic.etherscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Optimism Kovan](https://kovan-optimistic.etherscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Arbitrum Mainnet](https://arbiscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Arbitrum Rinkeby](https://testnet.arbiscan.io/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Polygon Mainnet](https://polygonscan.com/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Polygon Mumbai](https://mumbai.polygonscan.com/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)
- [Base Goerli](https://goerli.basescan.org/address/0xB210CE856631EeEB767eFa666EC7C1C57738d438)

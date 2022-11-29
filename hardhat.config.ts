import 'dotenv/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import '@typechain/hardhat/dist/type-extensions';
// import 'hardhat-gas-reporter';
// import '@0xged/hardhat-deploy';
import './tasks/npm-publish-clean-typechain';
// import 'solidity-coverage';
import { HardhatUserConfig, MultiSolcUserConfig, NetworksUserConfig } from 'hardhat/types';
import * as env from './utils/env';
// import 'tsconfig-paths/register';

// @ts-ignore

console.log(env.getNodeUrl('RPC_URL_ARBIGOERLI'));

const networks: NetworksUserConfig =
  env.isHardhatCompile() || env.isHardhatClean() || env.isTesting()
    ? {}
    : {
        hardhat: {
          forking: {
            enabled: process.env.RPC_URL_ARBIGOERLI ? true : false,
            url: process.env.RPC_URL_ARBIGOERLI,
          },
        },
        ['ethereum-ropsten']: {
          url: env.getNodeUrl('ethereum-ropsten'),
          accounts: env.getAccounts('ethereum-ropsten'),
        },
        ['ethereum-rinkeby']: {
          url: env.getNodeUrl('ethereum-rinkeby'),
          accounts: env.getAccounts('ethereum-rinkeby'),
        },
        ['ethereum-kovan']: {
          url: env.getNodeUrl('ethereum-kovan'),
          accounts: env.getAccounts('ethereum-kovan'),
        },
        ['ethereum-goerli']: {
          url: env.getNodeUrl('ethereum-goerli'),
          accounts: env.getAccounts('ethereum-goerli'),
        },
        ethereum: {
          url: env.getNodeUrl('ethereum'),
          accounts: env.getAccounts('ethereum'),
        },
        optimism: {
          url: env.getNodeUrl('optimism'),
          accounts: env.getAccounts('optimism'),
        },
        ['optimism-kovan']: {
          url: env.getNodeUrl('optimism-kovan'),
          accounts: env.getAccounts('optimism-kovan'),
        },
        arbitrum: {
          url: env.getNodeUrl('arbitrum'),
          accounts: env.getAccounts('arbitrum'),
        },
        ['arbitrum-goerli']: {
          url: process.env.RPC_URL_ARBIGOERLI,
          accounts: [process.env.FLORA_DEPLOYER_PKEY],
        },
        polygon: {
          url: env.getNodeUrl('polygon'),
          accounts: env.getAccounts('polygon'),
        },
        ['polygon-mumbai']: {
          url: env.getNodeUrl('polygon-mumbai'),
          accounts: env.getAccounts('polygon-mumbai'),
        },
      };

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  namedAccounts: {
    deployer: {
      default: 4,
    },
  },
  mocha: {
    timeout: process.env.MOCHA_TIMEOUT || 300000,
  },
  networks,
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ARBISCAN_API_KEY,
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: 'none',
      },
    },
  },
  gasReporter: {
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY || 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: process.env.REPORT_GAS ? true : false,
    showMethodSig: true,
    onlyCalledMethods: false,
    excludeContracts: ['ERC20'],
  },
  // preprocess: {
  //   eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  // },

  typechain: {
    outDir: 'typechained',
    target: 'ethers-v5',
    externalArtifacts: ['node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'],
  },
  paths: {
    sources: './solidity',
  },
};

if (process.env.TEST) {
  (config.solidity as MultiSolcUserConfig).compilers = (config.solidity as MultiSolcUserConfig).compilers.map((compiler) => {
    return {
      ...compiler,
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    };
  });
}

export default config;

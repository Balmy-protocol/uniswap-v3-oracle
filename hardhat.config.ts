import 'dotenv/config';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import '@typechain/hardhat/dist/type-extensions';
import { removeConsoleLog } from 'hardhat-preprocessor';
import 'hardhat-gas-reporter';
import '@0xged/hardhat-deploy';
import './tasks/npm-publish-clean-typechain';
import 'solidity-coverage';
import { HardhatUserConfig, MultiSolcUserConfig, NetworksUserConfig } from 'hardhat/types';
import * as env from './utils/env';
import 'tsconfig-paths/register';

const networks: NetworksUserConfig =
  env.isHardhatCompile() || env.isHardhatClean() || env.isTesting()
    ? {}
    : {
        hardhat: {
          forking: {
            enabled: process.env.FORK ? true : false,
            url: env.getNodeUrl('ethereum'),
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
        bnb: {
          url: env.getNodeUrl('bnb'),
          accounts: env.getAccounts('bnb'),
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
        ['arbitrum-rinkeby']: {
          url: env.getNodeUrl('arbitrum-rinkeby'),
          accounts: env.getAccounts('arbitrum-rinkeby'),
        },
        polygon: {
          url: env.getNodeUrl('polygon'),
          accounts: env.getAccounts('polygon'),
        },
        ['polygon-mumbai']: {
          url: env.getNodeUrl('polygon-mumbai'),
          accounts: env.getAccounts('polygon-mumbai'),
        },
        ['base-goerli']: {
          url: env.getNodeUrl('base-goerli'),
          accounts: env.getAccounts('base-goerli'),
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
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 9999,
          },
        },
      },
    ],
  },
  gasReporter: {
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY || 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: process.env.REPORT_GAS ? true : false,
    showMethodSig: true,
    onlyCalledMethods: false,
    excludeContracts: ['ERC20'],
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  etherscan: {
    apiKey: {
      ...env.getEtherscanAPIKeys([
        'ethereum-ropsten',
        'ethereum-rinkeby',
        'ethereum-kovan',
        'ethereum-goerli',
        'ethereum',
        'optimism',
        'optimism-kovan',
        'arbitrum',
        'arbitrum-rinkeby',
        'polygon',
        'polygon-mumbai',
        'bnb',
      ]),
      'base-goerli': 'PLACEHOLDER_STRING',
    },
    customChains: [
      {
        network: 'base-goerli',
        chainId: 84531,
        urls: {
          apiURL: 'https://api-goerli.basescan.org/api',
          browserURL: 'https://goerli.basescan.org',
        },
      },
    ],
  },
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

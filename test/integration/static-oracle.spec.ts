import { deployments, ethers } from 'hardhat';
import { evm } from '@utils';
import { contract, given, then, when } from '@utils/bdd';
import { expect } from 'chai';
import { getNodeUrl } from 'utils/env';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { StaticOracle } from '@typechained';
import { getLastPrice, convertPriceToNumberWithDecimals } from '../utils/defillama';
import { setTestChainId } from 'utils/deploy';
import moment from 'moment';
import { utils } from 'ethers';

const PRICE_THRESHOLD = 40;

contract('StaticOracle', () => {
  let staticOracle: StaticOracle;

  const PERIOD = moment.duration('3', 'minutes').as('seconds');

  describe('quote', () => {
    testQuoteOnNetwork({
      network: 'ethereum',
      chainId: 1,
      weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    });
    testQuoteOnNetwork({
      network: 'optimism',
      chainId: 10,
      weth: '0x4200000000000000000000000000000000000006',
      usdc: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    });
    testQuoteOnNetwork({
      network: 'arbitrum',
      chainId: 42161,
      weth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      usdc: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    });
    testQuoteOnNetwork({
      network: 'polygon',
      chainId: 137,
      weth: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      usdc: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    });
  });

  function testQuoteOnNetwork({ network, chainId, weth, usdc }: { network: string; chainId: number; weth: string; usdc: string }): void {
    context(`on ${network}`, () => {
      let feedPrice: number;
      given(async () => {
        await setTestChainId(chainId);
        await evm.reset({
          jsonRpcUrl: getNodeUrl(network),
        });
        await deployments.fixture(['StaticOracle'], { keepExistingDeployments: false });
        staticOracle = await ethers.getContract<StaticOracle>('StaticOracle');
        feedPrice = await getLastPrice(network, weth);
      });
      it('returns correct twap', async () => {
        const [twap] = await staticOracle.quoteAllAvailablePoolsWithTimePeriod(utils.parseEther('1'), weth, usdc, PERIOD);
        expect(twap).to.be.within(
          convertPriceToNumberWithDecimals(feedPrice - PRICE_THRESHOLD, 6),
          convertPriceToNumberWithDecimals(feedPrice + PRICE_THRESHOLD, 6)
        );
      });
    });
  }
});

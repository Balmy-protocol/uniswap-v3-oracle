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

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

contract('StaticOracle', () => {
  let user: SignerWithAddress;
  let staticOracle: StaticOracle;
  let snapshotId: string;

  const PERIOD = moment.duration('3', 'minutes').as('seconds');

  before(async () => {
    [user] = await ethers.getSigners();

    await setTestChainId(1);

    await evm.reset({
      jsonRpcUrl: getNodeUrl('ethereum'),
    });

    await deployments.fixture(['StaticOracle'], { keepExistingDeployments: false });
    staticOracle = await ethers.getContract<StaticOracle>('StaticOracle');

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  // Tests general quoting mechanism
  describe('quote', () => {
    let feedPrice: number;
    const PRICE_THRESHOLD = 40;
    given(async () => {
      // We fork from ethereum mainnet so we can compare
      // correctly our quote
      await evm.reset({
        jsonRpcUrl: getNodeUrl('ethereum'),
      });
      await deployments.fixture(['StaticOracle'], { keepExistingDeployments: false });
      staticOracle = await ethers.getContract<StaticOracle>('StaticOracle');
      feedPrice = await getLastPrice(WETH);
    });
    it('returns correct twap', async () => {
      const [twap] = await staticOracle.quoteAllAvailablePoolsWithTimePeriod(utils.parseEther('1'), WETH, USDC, PERIOD);
      expect(twap).to.be.within(
        convertPriceToNumberWithDecimals(feedPrice - PRICE_THRESHOLD, 6),
        convertPriceToNumberWithDecimals(feedPrice + PRICE_THRESHOLD, 6)
      );
    });
  });
});

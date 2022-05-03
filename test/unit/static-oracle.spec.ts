import chai, { expect } from 'chai';
import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { StaticOracle, StaticOracle__factory } from '@typechained';
import { evm } from '@utils';
import { contract, then, when } from '@utils/bdd';

chai.use(smock.matchers);

contract('StaticOracle', () => {
  describe('constructor', () => {
    when('contract is initiated', () => {
      then('factory is set');
      then('cardinality per minute is set');
      then('default fee tiers are set');
    });
  });

  describe('supportedFeeTiers', () => {
    when('no added tiers', () => {
      then('returns default fee tiers');
    });
    when('tiers were added', () => {
      then('returns correct fee tiers');
    });
  });

  describe('quoteAllAvailablePoolsWithTimePeriod', () => {
    then('todo');
  });

  describe('quoteSpecificFeeTiersWithTimePeriod', () => {
    then('todo');
  });

  describe('quoteSpecificPoolsWithTimePeriod', () => {
    then('todo');
  });

  describe('prepareAllAvailablePoolsWithTimePeriod', () => {
    then('todo');
  });

  describe('prepareSpecificFeeTiersWithTimePeriod', () => {
    then('todo');
  });

  describe('prepareSpecificPoolsWithTimePeriod', () => {
    then('todo');
  });

  describe('addNewFeeTeer', () => {
    when('trying to add a non-factory fee tier', () => {
      then(`tx gets reverted with 'Invalid fee tier' message`);
    });
    when('adding an already added fee tier', () => {
      then(`tx gets reverted with 'Tier already supported' message`);
    });
    when('adding valid fee tier', () => {
      then('gets added to known tiers');
    });
  });

  describe('_prepare', () => {
    then('todo');
  });

  describe('_quote', () => {
    then('todo');
  });

  describe('_getQueryablePoolsForTiers', () => {
    then('todo');
  });

  describe('_getPoolsForTiers', () => {
    then('todo');
  });

  describe('_copyValidElementsIntoNewArray', () => {
    then('todo');
  });
});

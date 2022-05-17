// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../StaticOracle.sol';

contract StaticOracleMock is StaticOracle {
  constructor(IUniswapV3Factory _factory, uint8 _cardinalityPerMinute) StaticOracle(_factory, _cardinalityPerMinute) {}

  function knownFeeTiers() external view returns (uint24[] memory) {
    return _knownFeeTiers;
  }

  function addKnownFeeTier(uint24 _feeTier) external {
    _knownFeeTiers.push(_feeTier);
  }

  function getCardinalityForTimePeriod(uint32 _period) external view returns (uint16 _cardinality) {
    return _getCardinalityForTimePeriod(_period);
  }

  function prepare(address[] memory pools, uint16 cardinality) external {
    _prepare(pools, cardinality);
  }

  function quote(
    uint128 baseAmount,
    address baseToken,
    address quoteToken,
    address[] memory pools,
    uint32 period
  ) external view returns (uint256 quoteAmount) {
    return _quote(baseAmount, baseToken, quoteToken, pools, period);
  }

  function getQueryablePoolsForTiers(
    address tokenA,
    address tokenB,
    uint32 period
  ) external view returns (address[] memory) {
    return _getQueryablePoolsForTiers(tokenA, tokenB, period);
  }

  address[] internal _poolsForTiersReturn;

  function setPoolForTiersReturn(address[] memory __poolsForTiersReturn) external {
    _poolsForTiersReturn = __poolsForTiersReturn;
  }

  function _getPoolsForTiers(
    address tokenA,
    address tokenB,
    uint24[] memory feeTiers
  ) internal view override returns (address[] memory) {
    if (_poolsForTiersReturn.length > 0) {
      return _poolsForTiersReturn;
    }
    return super._getPoolsForTiers(tokenA, tokenB, feeTiers);
  }

  function getPoolsForTiers(
    address tokenA,
    address tokenB,
    uint24[] memory feeTiers
  ) external view returns (address[] memory) {
    return _getPoolsForTiers(tokenA, tokenB, feeTiers);
  }
}

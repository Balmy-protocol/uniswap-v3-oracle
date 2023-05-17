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

  function prepare(address[] memory _pools, uint16 _cardinality) external {
    _prepare(_pools, _cardinality);
  }

  function quote(
    uint128 _baseAmount,
    address _baseToken,
    address _quoteToken,
    address[] memory _pools,
    uint32 _period
  ) external view returns (uint256 _quoteAmount) {
    return _quote(_baseAmount, _baseToken, _quoteToken, _pools, _period, 0);
  }

  function quoteOffsetted(
    uint128 _baseAmount,
    address _baseToken,
    address _quoteToken,
    address[] memory _pools,
    uint32 _period,
    uint32 _offset
  ) external view returns (uint256 _quoteAmount) {
    return _quote(_baseAmount, _baseToken, _quoteToken, _pools, _period, _offset);
  }

  function getQueryablePoolsForTiers(
    address _tokenA,
    address _tokenB,
    uint32 _period
  ) external view returns (address[] memory) {
    return _getQueryablePoolsForTiers(_tokenA, _tokenB, _period);
  }

  address[] internal _poolsForTiersReturn;

  function setPoolForTiersReturn(address[] memory __poolsForTiersReturn) external {
    _poolsForTiersReturn = __poolsForTiersReturn;
  }

  function _getPoolsForTiers(
    address _tokenA,
    address _tokenB,
    uint24[] memory _feeTiers
  ) internal view override returns (address[] memory) {
    if (_poolsForTiersReturn.length > 0) {
      return _poolsForTiersReturn;
    }
    return super._getPoolsForTiers(_tokenA, _tokenB, _feeTiers);
  }

  function getPoolsForTiers(
    address _tokenA,
    address _tokenB,
    uint24[] memory _feeTiers
  ) external view returns (address[] memory) {
    return _getPoolsForTiers(_tokenA, _tokenB, _feeTiers);
  }
}

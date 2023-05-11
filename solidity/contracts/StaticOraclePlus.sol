// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/utils/Address.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import '../libraries/OracleLibraryPlus.sol';
import './StaticOracle.sol';

import '../interfaces/IStaticOraclePlus.sol';

/// @title Uniswap V3 Static Oracle with targeted observation periods
/// @notice Oracle contract for price quoting against Uniswap V3 pools
contract StaticOraclePlus is StaticOracle, IStaticOraclePlus {
  constructor(IUniswapV3Factory _UNISWAP_V3_FACTORY, uint8 _CARDINALITY_PER_MINUTE) StaticOracle(_UNISWAP_V3_FACTORY, _CARDINALITY_PER_MINUTE) {}

  /// @inheritdoc IStaticOraclePlus
  function quoteAllAvailablePoolsWithOffsettedTimePeriod(
    uint128 _baseAmount,
    address _baseToken,
    address _quoteToken,
    uint32 _period,
    uint32 _offset
  ) external view override returns (uint256 _quoteAmount, address[] memory _queriedPools) {
    _queriedPools = _getQueryablePoolsForTiers(_baseToken, _quoteToken, _offset + _period);
    _quoteAmount = _quote(_baseAmount, _baseToken, _quoteToken, _queriedPools, _period, _offset);
  }

  /// @inheritdoc IStaticOraclePlus
  function quoteSpecificFeeTiersWithOffsettedTimePeriod(
    uint128 _baseAmount,
    address _baseToken,
    address _quoteToken,
    uint24[] calldata _feeTiers,
    uint32 _period,
    uint32 _offset
  ) external view override returns (uint256 _quoteAmount, address[] memory _queriedPools) {
    _queriedPools = _getPoolsForTiers(_baseToken, _quoteToken, _feeTiers);
    require(_queriedPools.length == _feeTiers.length, 'Given tier does not have pool');
    _quoteAmount = _quote(_baseAmount, _baseToken, _quoteToken, _queriedPools, _period, _offset);
  }

  /// @inheritdoc IStaticOraclePlus
  function quoteSpecificPoolsWithOffsettedTimePeriod(
    uint128 _baseAmount,
    address _baseToken,
    address _quoteToken,
    address[] calldata _pools,
    uint32 _period,
    uint32 _offset
  ) external view override returns (uint256 _quoteAmount) {
    return _quote(_baseAmount, _baseToken, _quoteToken, _pools, _period, _offset);
  }

  function _quote(
    uint128 _baseAmount,
    address _baseToken,
    address _quoteToken,
    address[] memory _pools,
    uint32 _period,
    uint32 _offset
  ) internal view returns (uint256 _quoteAmount) {
    require(_pools.length > 0, 'No defined pools');
    OracleLibrary.WeightedTickData[] memory _tickData = new OracleLibrary.WeightedTickData[](_pools.length);

    for (uint256 i; i < _pools.length; i++) {
      (_tickData[i].tick, _tickData[i].weight) = OracleLibraryPlus.consult(_pools[i], _period, _offset);
    }
    int24 _weightedTick = _tickData.length == 1 ? _tickData[0].tick : OracleLibrary.getWeightedArithmeticMeanTick(_tickData);
    return OracleLibrary.getQuoteAtTick(_weightedTick, _baseAmount, _baseToken, _quoteToken);
  }
}

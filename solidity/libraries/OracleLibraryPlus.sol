// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

library OracleLibraryPlus {
  /// @notice Calculates time-weighted means of tick and liquidity for a given Uniswap V3 pool
  /// @param _pool Address of the pool that we want to observe
  /// @param _secondsAgos Array of seconds in the past from which to calculate the time-weighted means
  /// @return _arithmeticMeanTick The arithmetic mean tick from _secondsAgos[0] to _secondsAgos[1]
  /// @return _harmonicMeanLiquidity The harmonic mean liquidity from _secondsAgos[0] to _secondsAgos[1]
  function consult(address _pool, uint32[] memory _secondsAgos)
    internal
    view
    returns (int24 _arithmeticMeanTick, uint128 _harmonicMeanLiquidity)
  {
    require(_secondsAgos.length == 2, 'Wrong length');
    require(_secondsAgos[1] > _secondsAgos[0], 'Wrong order');
    uint32 _secondsBetween = _secondsAgos[1] - _secondsAgos[0];

    (int56[] memory _tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) = IUniswapV3Pool(_pool).observe(_secondsAgos);

    int56 _tickCumulativesDelta = _tickCumulatives[1] - _tickCumulatives[0];
    uint160 _secondsPerLiquidityCumulativesDelta = secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

    _arithmeticMeanTick = int24(_tickCumulativesDelta / _secondsBetween);
    // Always round to negative infinity
    if (_tickCumulativesDelta < 0 && (_tickCumulativesDelta % _secondsBetween != 0)) _arithmeticMeanTick--;

    // We are multiplying here instead of shifting to ensure that _harmonicMeanLiquidity doesn't overflow uint128
    uint192 _secondsAgoX160 = uint192(_secondsBetween) * type(uint160).max;
    _harmonicMeanLiquidity = uint128(_secondsAgoX160 / (uint192(_secondsPerLiquidityCumulativesDelta) << 32));
  }
}

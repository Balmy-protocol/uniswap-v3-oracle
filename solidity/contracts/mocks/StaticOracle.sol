// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../StaticOracle.sol';

contract StaticOracleMock is StaticOracle {
  constructor(IUniswapV3Factory _factory, uint8 _cardinalityPerMinute) StaticOracle(_factory, _cardinalityPerMinute) {}

  function prepare(address[] memory pools, uint32 period) external {
    _prepare(pools, period);
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

  function getPoolsForTiers(
    address tokenA,
    address tokenB,
    uint24[] memory feeTiers
  ) external view returns (address[] memory) {
    return _getPoolsForTiers(tokenA, tokenB, feeTiers);
  }

  function copyValidElementsIntoNewArray(address[] calldata tempArray, uint256 amountOfValidElements)
    external
    pure
    returns (address[] memory array)
  {
    return _copyValidElementsIntoNewArray(tempArray, amountOfValidElements);
  }
}

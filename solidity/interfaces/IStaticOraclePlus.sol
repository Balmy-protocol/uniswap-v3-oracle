// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6 <0.9.0;

import './IStaticOracle.sol';

/// @title Uniswap V3 Static Oracle
/// @notice Oracle contract for calculating price quoting against Uniswap V3
interface IStaticOraclePlus is IStaticOracle {
  /**
   * @notice Returns a quote, based on the given tokens and amount, by querying all of the pair's pools
   * @dev If some pools are not configured correctly for the given period, then they will be ignored
   * @dev Will revert if there are no pools available/configured for the pair and period combination
   * @param baseAmount Amount of token to be converted
   * @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
   * @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
   * @param period Length in seconds of the TWAP calculation length
   * @param offset Number of seconds ago to start the TWAP calculation
   * @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
   * @return queriedPools The pools that were queried to calculate the quote
   */
  function quoteAllAvailablePoolsWithOffsettedTimePeriod(
    uint128 baseAmount,
    address baseToken,
    address quoteToken,
    uint32 period,
    uint32 offset
  ) external view returns (uint256 quoteAmount, address[] memory queriedPools);

  /**
   * @notice Returns a quote, based on the given tokens and amount, by querying only the specified fee tiers
   * @dev Will revert if the pair does not have a pool for one of the given fee tiers
   * @dev Will revert if one of the pools is not prepared/configured correctly for the given period
   * @param baseAmount Amount of token to be converted
   * @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
   * @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
   * @param feeTiers The fee tiers to consider when calculating the quote
   * @param period Length in seconds of the TWAP calculation length
   * @param offset Number of seconds ago to start the TWAP calculation
   * @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
   * @return queriedPools The pools that were queried to calculate the quote
   */
  function quoteSpecificFeeTiersWithOffsettedTimePeriod(
    uint128 baseAmount,
    address baseToken,
    address quoteToken,
    uint24[] calldata feeTiers,
    uint32 period,
    uint32 offset
  ) external view returns (uint256 quoteAmount, address[] memory queriedPools);

  /**
   * @notice Returns a quote, based on the given tokens and amount, by querying only the specified pools
   * @dev Will revert if one of the pools is not prepared/configured correctly for the given period
   * @param baseAmount Amount of token to be converted
   * @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
   * @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
   * @param pools The pools to consider when calculating the quote
   * @param period Length in seconds of the TWAP calculation length
   * @param offset Number of seconds ago to start the TWAP calculation
   * @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
   */
  function quoteSpecificPoolsWithOffsettedTimePeriod(
    uint128 baseAmount,
    address baseToken,
    address quoteToken,
    address[] calldata pools,
    uint32 period,
    uint32 offset
  ) external view returns (uint256 quoteAmount);
}

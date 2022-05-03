//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

interface IGreeter {
  event GreetingSet(string _greeting);

  error EmptyGreeting();

  function greeting() external returns (string memory);

  function greet() external view returns (string memory);

  function setGreeting(string memory _greeting) external returns (bool);
}

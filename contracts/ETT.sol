pragma solidity ^0.4.21;

import "./StandardToken.sol";

contract ETT is StandardToken {
  string public name;
  string public symbol;
  uint8 public decimals;
  uint public cutoffTime;

  constructor(
    uint256 _initialAmount,
    string _tokenName,
    uint8 _decimalUnits,
    string _tokenSymbol,
    uint _cutoffTime)
  public {
    name = _tokenName;
    symbol = _tokenSymbol;
    decimals = _decimalUnits;
    cutoffTime = _cutoffTime;
    totalSupply_ = _initialAmount;
    balances[msg.sender] = _initialAmount;
  }
  function updateTotalSupply(int256 amount) 
  public {
    if(amount > 0) {
      totalSupply_ = totalSupply_.add(uint256(amount));
    } else {
      totalSupply_ = totalSupply_.sub(uint256(amount));
    }
  }
}
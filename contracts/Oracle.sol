pragma solidity ^0.4.21;

contract Oracle {
  // Callback functions
  event CallbackHasKyc(address indexed createOrderAddress, address investor);
  event CallbackOrderCreated(address indexed createOrderAddress, uint indexed index, address investor, address[] brokers, uint executionDate);
  event CallbackOrderStateUpdated(address indexed createOrderAddress, uint indexed index, uint state);
  event CallbackOrderSetPrice(address indexed createOrderAddress, uint indexed index, address broker, bytes32 price);
  event CallbackOrderInvestorConfirm(address indexed createOrderAddress, uint index, address broker);
  event CallbackOrderBrokerConfirm(address indexed createOrderAddress, uint index, address broker);
  event CallbackTokenCreated(address indexed tokenAddress, string name, uint8 decimals, string symbol, uint cutoffTime);
  event CallbackTokenHoldingsRemoved(address indexed tokenAddress);
  event CallbackTokenHoldingAdded(address indexed tokenAddress, bytes32 ticker, uint16 percent);

  constructor() public { }

  function emitTokenHoldingsRemoved(address tokenAddress) public {
    emit CallbackTokenHoldingsRemoved(tokenAddress);
  }
  function emitTokenHoldingAdded(address tokenAddress, bytes32 ticker, uint16 percent) public {
    emit CallbackTokenHoldingAdded(tokenAddress, ticker, percent);
  }
  function emitHasKyc(address createOrderAddress, address investor) public {
    emit CallbackHasKyc(createOrderAddress, investor);
  }
  function emitOrderCreated(address createOrderAddress, uint index, address investor, address[] brokers, uint executionDate) public {
    emit CallbackOrderCreated(createOrderAddress, index, investor, brokers, executionDate);
  }
  function emitOrderStateUpdated(address createOrderAddress, uint index, uint state) public {
    emit CallbackOrderStateUpdated(createOrderAddress, index, state);
  }
  function emitTokenCreated(address tokenAddress, string name, uint8 decimals, string symbol, uint cutoffTime) public {
    emit CallbackTokenCreated(tokenAddress, name, decimals, symbol, cutoffTime);
  }
  function emitOrderSetPrice(address createOrderAddress, uint index, address broker, bytes32 price) public {
    emit CallbackOrderSetPrice(createOrderAddress, index, broker, price);
  }
  function emitOrderInvestorConfirm(address createOrderAddress, uint index, address broker) public {
    emit CallbackOrderInvestorConfirm(createOrderAddress, index, broker);
  }
  function emitOrderBrokerConfirm(address createOrderAddress, uint index, address broker) public {
    emit CallbackOrderBrokerConfirm(createOrderAddress, index, broker);
  }
}
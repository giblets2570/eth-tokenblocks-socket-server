pragma solidity ^0.4.21;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Permissions is Ownable {
	// 	Investors = 1;
	// 	Brokers = 2;
	// 	Funds = 3;
	//  Custodians = 4;
	// 	Admins = 5;

	mapping(address => uint) permissions;

	constructor() public {}

	function isAuthorized(address agent, uint role) public view returns(bool) {
		return permissions[agent] == role;
	}

	function setAuthorized(address agent, uint role) public onlyOwner {
		permissions[agent] = role;
	}
}
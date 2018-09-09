pragma solidity ^0.4.21;

import "./ETT.sol";
import "./Oracle.sol";

contract TokenFactory {
    mapping(address => address[]) public created;
    mapping(address => bool) public isETT; //verify without having to do a bytecode check.
    bytes public ETTByteCode; // solhint-disable-line var-name-mixedcase
    uint public numTokens;
    mapping(uint => address) public tokenAddresses;
    mapping(bytes32 => address) public symbolToAddresses;
    address private oracle;
    
    constructor(address _oracle) public {
        //upon creation of the factory, deploy a ETT (parameters are meaningless) and store the bytecode provably.
        oracle = _oracle;
        numTokens = 0;
    }
    function setETTByteCode() public {
        address verifiedToken = new ETT(10000, "Verify Token", 3, "VTX", 64800);
        ETTByteCode = codeAt(verifiedToken);
    }
    //verifies if a contract that has been deployed is a Human Standard Token.
    //NOTE: This is a very expensive function, and should only be used in an eth_call. ~800k gas
    function verifyETT(address _tokenContract) public view returns (bool) {
        bytes memory fetchedTokenByteCode = codeAt(_tokenContract);
        if (fetchedTokenByteCode.length != ETTByteCode.length) {
            return false; //clear mismatch
        }
        //starting iterating through it if lengths match
        for (uint i = 0; i < fetchedTokenByteCode.length; i++) {
            if (fetchedTokenByteCode[i] != ETTByteCode[i]) {
                return false;
            }
        }
        return true;
    }
    function createETT(uint256 _initialAmount, string _name, uint8 _decimals, string _symbol, uint _cutoffTime) public returns (address) {

        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));
        // require(symbolToAddresses[symbolHash] == address(0));
        ETT newToken = (new ETT(_initialAmount, _name, _decimals, _symbol, _cutoffTime));
        created[msg.sender].push(address(newToken));
        isETT[address(newToken)] = true;
        //the factory will own the created tokens. You must transfer them.
        newToken.transfer(msg.sender, _initialAmount);

        tokenAddresses[numTokens] = address(newToken);
        numTokens += 1;

        symbolToAddresses[symbolHash] = address(newToken);

        Oracle(oracle).emitTokenCreated(address(newToken), _name, _decimals, _symbol, _cutoffTime);
        return address(newToken);
    }
    //for now, keeping this internal. Ideally there should also be a live version of this that
    // any contract can use, lib-style.
    //retrieves the bytecode at a specific address.
    function codeAt(address _addr) internal view returns (bytes outputCode) {
        assembly { // solhint-disable-line no-inline-assembly
            // retrieve the size of the code, this needs assembly
            let size := extcodesize(_addr)
            // allocate output byte array - this could also be done without assembly
            // by using outputCode = new bytes(size)
            outputCode := mload(0x40)
            // new "memory end" including padding
            mstore(0x40, add(outputCode, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            // store length in memory
            mstore(outputCode, size)
            // actually retrieve the code, this needs assembly
            extcodecopy(_addr, add(outputCode, 0x20), 0, size)
        }
    }
    function tokenFromSymbol(string _symbol) public view returns (address){
        bytes32 symbolHash = keccak256(abi.encodePacked(_symbol));
        require(symbolToAddresses[symbolHash] != address(0));
        return symbolToAddresses[symbolHash];
    }
}
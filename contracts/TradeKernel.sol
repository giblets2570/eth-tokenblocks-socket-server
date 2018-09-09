pragma solidity ^0.4.24;

import "./Permissions.sol";

contract TradeKernel {
    // Error Codes
    enum Errors {
        TRADE_EXPIRED  // Trade has already expired
    }

    // Mappings of tradeHash => amount
    mapping (bytes32 => bytes32) public confirmed;
    // Mappings of tradeHash => canceller
    mapping (bytes32 => address) public cancelled;
    // Mappings of tradeHash => number tokens issued
    mapping (bytes32 => uint) public verified;
    // Mappings of tradeHash => sk
    mapping (bytes32 => bytes32) public secretKeys;

    address permissions;

    event LogConfirmed(
        address indexed investor,
        address indexed broker,
        address token,
        bytes32 tradeHash
    );

    event LogCancel(
        address indexed investor,
        address indexed broker,
        address token,
        address indexed canceller,
        bytes32 tradeHash
    );

    event LogVerified(
        address indexed custodian,
        bytes32 tradeHash
    );

    event LogError(uint8 indexed errorId, bytes32 indexed tradeHash);

    struct Trade {
        address investor;
        address broker;
        address token;
        bytes32 nominalAmount;
        bytes32 price;
        uint executionDate;
        uint expirationTimestampInSec;
        bytes32 tradeHash;
    }

    constructor(address _permissions) public {
        permissions = _permissions;
    }

    /*
    * Core kernel functions
    */

    /// @dev Fills the input trade.
    /// @param tradeAddresses Array of trade's investor, broker, token
    /// @param tradeBytes Array of trade's ik1, ik2, ek1, ek2, nominalAmount, price
    /// @param tradeValues Array of trade's executionDate, expirationTimestampInSec, and salt.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    function confirmTrade(
        address[3] tradeAddresses, 
        bytes32[2] tradeBytes, 
        uint[3] tradeValues,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
    {   
        Trade memory trade = Trade({
            investor: tradeAddresses[0],
            broker: tradeAddresses[1],
            token: tradeAddresses[2],
            nominalAmount: tradeBytes[0],
            price: tradeBytes[1],
            executionDate: tradeValues[0],
            expirationTimestampInSec: tradeValues[1],
            tradeHash: getTradeHash(tradeAddresses, tradeBytes, tradeValues)
        });

        require(trade.broker == msg.sender);
        require(Permissions(permissions).isAuthorized(trade.investor,1));
        require(Permissions(permissions).isAuthorized(msg.sender,2));

        require(isValidSignature(
            trade.investor,
            trade.tradeHash,
            v,
            r,
            s
        ));

        // if (block.timestamp >= trade.expirationTimestampInSec) {
        //     emit LogError(uint8(Errors.ORDER_EXPIRED), trade.tradeHash);
        //     require(false);
        // }

        confirmed[trade.tradeHash] = trade.nominalAmount;

        emit LogConfirmed(
            msg.sender,
            trade.broker,
            trade.token,
            trade.tradeHash
        );
    }

    /// @dev Cancels the input trade.
    /// @param tradeAddresses Array of trade's investor, broker, token
    /// @param tradeBytes Array of trade's ik1, ik2, ek1, ek2, nominalAmount, price
    /// @param tradeValues Array of trade's executionDate, expirationTimestampInSec, and salt.
    function cancelTrade(
        address[3] tradeAddresses, 
        bytes32[2] tradeBytes, 
        uint[3] tradeValues)
        public
    {
        Trade memory trade = Trade({
            investor: tradeAddresses[0],
            broker: tradeAddresses[1],
            token: tradeAddresses[2],
            nominalAmount: tradeBytes[0],
            price: tradeBytes[1],
            executionDate: tradeValues[0],
            expirationTimestampInSec: tradeValues[1],
            tradeHash: getTradeHash(tradeAddresses, tradeBytes, tradeValues)
        });

        require(trade.broker == msg.sender || trade.investor == msg.sender);

        // if (block.timestamp >= trade.expirationTimestampInSec) {
        //     emit LogError(uint8(Errors.ORDER_EXPIRED), trade.tradeHash);
        //     require(false);
        // }

        cancelled[trade.tradeHash] = msg.sender;
        
        emit LogCancel(
            trade.investor,
            trade.broker,
            trade.token,
            msg.sender,
            trade.tradeHash
        );
    }

    function verifyTrade(bytes32 tradeHash, uint amount)
        public
    {
        require(cancelled[tradeHash] == address(0));
        require(confirmed[tradeHash] == bytes32(0));   
        require(verified[tradeHash] == 0);

        verified[tradeHash] = amount;

        emit LogVerified(msg.sender, tradeHash);
    }

    function verifyTrade(
        address broker,
        bytes32 tradeHash,
        bytes32[] tradeHashes, 
        uint[] amounts,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
    {   
        require(tradeHashes.length==amounts.length);
        require(isValidSignature(
            broker,
            tradeHash,
            v,
            r,
            s
        ));

        for(uint i = 0; i < tradeHashes.length; i++){
            this.verifyTrade(tradeHashes[i], amounts[i]);
        }
    }

    /*
    * Constant public functions
    */

    /// @dev Calculates Keccak-256 hash of trade with specified parameters.
    /// @param tradeAddresses Array of trade's investor, broker, token
    /// @param tradeBytes Array of trade's nominalAmount, price
    /// @param tradeValues Array of trade's executionDate, expirationTimestampInSec, and salt.
    /// @return Keccak-256 hash of trade.
    function getTradeHash(
        address[3] tradeAddresses, 
        bytes32[2] tradeBytes, 
        uint[3] tradeValues)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                address(this),
                tradeAddresses[0], // investor
                tradeAddresses[1], // broker
                tradeAddresses[2], // token
                tradeBytes[0],     // nominalAmount
                tradeBytes[1],     // price
                tradeValues[0],    // executionDate
                tradeValues[1],    // expirationTimestampInSec
                tradeValues[2]     // salt
            )
        );
    }

    /// @dev Verifies that an trade signature is valid.
    /// @param signer address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @return Validity of trade signature.
    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
        pure
        returns (bool)
    {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
        return ecrecover(prefixedHash, v, r, s) == signer;
    }
}
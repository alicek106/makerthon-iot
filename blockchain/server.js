'use strict';
var CryptoJS = require("crypto-js");
var express = require("express");
var bodyParser = require('body-parser');
var WebSocket = require("ws");
var keypair = require('keypair');
var http_port = 3001 //process.env.HTTP_PORT || 3001;
var p2p_port = 6001 //process.env.P2P_PORT || 6001;
var initialPeers = []

const consoleLog = require('./date.js').timestampLog;
const writeKey = require('./fileio.js').writeKey;

class Block {
    constructor(index, previousHash, timestamp, data, hash) {
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash.toString();
    }
}

var sockets = [];
var MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};


/*****************
Key Create
******************/
consoleLog('Creating key pair... Server will use private key.')

var pair = keypair()
var createFirstBlock = () => {
    return new Block(0, "0", new Date().getTime(), 'First Block', CryptoJS.SHA256(pair.private + pair.public).toString());
};
var blockchain = [createFirstBlock()];
writeKey('private.key', pair.private)
consoleLog('Successfully saved private key')

/*******************
HTTP Rest API Server Start
******************/
var initHttpServer = () => {
    var app = express();
    app.use(bodyParser.json());
	
    app.get('/blocks', (req, res) => res.send(JSON.stringify(blockchain)));
    app.get('/peers', (req, res) => {
        res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });

    app.listen(http_port, () => consoleLog('Listening http on port: ' + http_port));
};



/***********************************
Web Socket Functions
************************************/

var initP2PServer = () => {
    var server = new WebSocket.Server({port: p2p_port});
    server.on('connection', ws => initConnection(ws));
    consoleLog('listening websocket p2p port on: ' + p2p_port);

};

var initConnection = (ws) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, onConnectMessage());
};

var initMessageHandler = (ws) => {
    ws.on('message', (data) => {
        var message = JSON.parse(data);
        // console.log('Received message : ' + JSON.stringify(message));
        switch (message.type) {
            case 1:
                consoleLog('I\'m trying to handshake :O')
                write(ws, responseMessage());
                break;
            case 2:
                consoleLog('Thank you for handshaking :D I\'ll send key,')
                sendKey(pair.public)
                syncBlock()
                break; 
            case 3:
                consoleLog('Create Block. IoT data arrived. : ' + JSON.stringify(message))
                addBlock(generateNextBlock(data));
                consoleLog('Successfully created new block. Let\'s broadcast!')
                syncBlock()
                break;
        }
    });
};

var sendKey = (pubKey) => {
    var obj = {'type':4, 'pubkey':pubKey}
    sockets.forEach(socket => write(socket, obj))
}

var initErrorHandler = (ws) => {
    var closeConnection = (ws) => {
        consoleLog('connection failed to peer: ' + ws.url);
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

var connectToPeers = (newPeers) => {
    newPeers.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => {
            consoleLog('connection failed')
        });
    });
};

var onConnectMessage = () => ({'type':1, 'data': 'I am trying to handshake.'});
var responseMessage = () => ({'type':2, 'data': 'Hello!'});
var write = (ws, message) => ws.send(JSON.stringify(message));
var sendBroadcastForTest = (message) => sockets.forEach(socket => write(socket, message))




/*******************************
// Block Functions
/*******************************/

var generateNextBlock = (blockData) => {
    var previousBlock = getLatestBlock();
    var nextIndex = previousBlock.index + 1;
    var nextTimestamp = new Date().getTime();
    var nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);
    return new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, nextHash);
};

var calculateHash = (index, previousHash, timestamp, data) => {
    return CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
};

var addBlock = (newBlock) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
    }
};

var isValidNewBlock = (newBlock, previousBlock) => {
    if (previousBlock.index + 1 !== newBlock.index) {
        consoleLog('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        consoleLog('invalid previoushash');
        return false;
    } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        consoleLog(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
        consoleLog('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    }
    return true;
};

var calculateHashForBlock = (block) => {
    return calculateHash(block.index, block.previousHash, block.timestamp, block.data);
};

var getLatestBlock = () => blockchain[blockchain.length - 1];

var syncBlock = () => {
   var message = {'type':5, 'data':JSON.stringify([getLatestBlock()])}
   sockets.forEach(socket => write(socket, message))
}

/********************************
Start Server
*********************************/
connectToPeers(initialPeers);
initHttpServer();
initP2PServer();

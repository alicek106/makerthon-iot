'use strict';
var CryptoJS = require("crypto-js");
var express = require("express");
var bodyParser = require('body-parser');
var WebSocket = require("ws");
var http_port = 3002 //process.env.HTTP_PORT || 3001;
var p2p_port = 6002 //process.env.P2P_PORT || 6001;
var initialPeers = ['ws://localhost:6001']//process.env.PEERS ? process.env.PEERS.split(',') : [];

class Block {
    constructor(index, previousHash, timestamp, data, hash) {
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash.toString();
    }
}

const writeKey = require('./fileio.js').writeKey;
const consoleLog = require('./date.js').timestampLog;

var sockets = [];
var blockchain = [];

var initHttpServer = () => {
    var app = express();
    app.use(bodyParser.json());
	
    app.get('/blocks', (req, res) => res.send(JSON.stringify(blockchain)));
    app.get('/peers', (req, res) => {
        res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/api/data/send', (req, res) => {
        sendToServer(req.body)
        consoleLog("/api/data/send GET : " + JSON.stringify(req.body))
        res.send()
    })
    app.listen(http_port, () => consoleLog('Listening http on port: ' + http_port));
};


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
                consoleLog('Thank you for handshaking :D')
                break;
            case 4:
                writeKey('public.key', message.pubkey)
                consoleLog('Successfully saved public key')
                break;
            case 5:
                consoleLog('Server gave New block')
                handleNewBlock(message)
                // TODO : 블록 들어온거에 대해서 싱크맞추고 생성하기
        }
    });
};

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
var sendToServer = (message) => {
        message.type = 3
        sockets.forEach(socket => write(socket, message))
}

var getLatestBlock = () => blockchain[blockchain.length - 1];

var handleNewBlock = (message) => {
    var receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.index - b2.index));
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    var latestBlockHeld = getLatestBlock();

    if(blockchain.length == 0){
        consoleLog('Initial block created. Just push to blockchain.')
        blockchain.push(latestBlockReceived)
        return;
    }

    if (latestBlockReceived.index > latestBlockHeld.index) {
        consoleLog('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash == latestBlockReceived.previousHash) {
            consoleLog('We can append the received block to our chain');
            blockchain.push(latestBlockReceived);
        }else{
            consoleLog('Hash is not same. Something goes wrong. Exit.')
        }
    } 
};

connectToPeers(initialPeers);
initHttpServer();
initP2PServer();

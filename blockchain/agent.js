var mqtt = require('mqtt')
var http = require("http")

var options = {
  hostname: 'localhost',
  path: '/api/data/send',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  port: '3002'  
}

function handleResponse(response) {
  var serverData = '';
  response.on('data', function (chunk) {
    serverData += chunk;
  });
  response.on('end', function () {
    //console.log(serverData);
  });
}

var client  = mqtt.connect('mqtt://163.180.117.195')

var arr = []
 
client.on('connect', function () {
  client.subscribe('makerton/data')
})
 
client.on('message', function (topic, message) {
  switch(topic){
    case 'makerton/data':
      //console.log('topic : ' + topic + ' / message : ' + message.toString())
      arr.push(JSON.parse(message.toString()))
      if(arr.length == 1){
          console.log('Requesting message send..')
          var jsonObj = {}
          jsonObj['data'] = JSON.stringify(arr)
          var req = http.request(options, handleResponse);
          req.write(JSON.stringify(jsonObj));
          req.end()
          arr = []
      }
  }
})

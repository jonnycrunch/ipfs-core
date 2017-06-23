'use strict'

const os = require('os')
const path = require('path')
const IPFS = require('ipfs')
var request = require('request')
var bigInt = require('big-integer')
var lodash = require('lodash')
const FunctionNode = require('computes-vm');
// const FunctionNode = require('/Users/topher/Projects/computes/nanocyte-component-function')
var topic, nodeData;

if(typeof process.env.DOMAIN_KEY !== "undefined"){
  // topic = [process.env.DOMAIN_KEY, "computes"];
  topic = [process.env.DOMAIN_KEY];
} else {
  topic = ["computes"];
}

const node = new IPFS({
  repo: path.join(os.tmpdir() + '/' + new Date().toString()),
  // repo: "/tmp/ipfs-docker-data/data/ipfs",
  init: {
    emptyRepo: true,
    bits: 2048
  },
  start: true,
  EXPERIMENTAL: {
    pubsub: true
  }
})

function requestWork(domain){

  for (var i = 0; i < topic.length; i++) {
    console.log("Requesting work:", topic[i]);

    var msgObj = {
      node: nodeData,
      status: "available",
      domain: topic[i]
    }
    var msgSend = new Buffer(JSON.stringify(msgObj).toString());

    node.pubsub.publish(domain || topic[i], msgSend, (err) => {
      if (err) {
        console.log("error", err);
        throw err;
      }
    })
  }

};

function evalHandler(body, data, callback){
  var functionNode = new FunctionNode;
  functionNode.onEnvelope({
    metadata: {},
    message: {},
    config: {
      func: body,
      data: data
    }
  }, function(error, results) {
    var result = {result:results};
    console.log('operation: ', JSON.stringify(body));
    console.log('data: ', JSON.stringify(data));
    console.log('result: ', result);
    return callback(null, result);
  })
}

node.on('ready', () => {
  node.id(function(err, data){
    nodeData = data
    console.log("Node info:", data)
    console.log('Computes core ready (via IPFS)')
    console.log("Listening for work on:", topic);

    for (var i = 0; i < topic.length; i++) {
      node.pubsub.subscribe(topic[i], receiveMsg);
    }
    node.pubsub.subscribe(nodeData.id, receivePM);

    requestWork();
  })
})

const receivePM = (msg) => {
  console.log("private:",msg.data.toString());
  var dataObj = JSON.parse(msg.data.toString());
  var fromNode = dataObj.node.id;
  var operation = dataObj.compute;
  var data = dataObj.data;
  // if (fromNode != nodeData.id){

  // check if operation is URL. If so, fetch operation
  var expression = /https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,}/;
  var regex = new RegExp(expression);

  // check if operation is IPFS. If so, fetch operation
  var expression = /ipfs:\/\//;
  var ipfsRegex = new RegExp(expression);

  // check if operation is NPM. If so, fetch operation
  var expression = /npm:\/\//;
  var npmRegex = new RegExp(expression);

  if (operation.match(regex)) {
    console.log("operation is url. fetching javascript");
    request(operation, function (error, response, body) {
      // console.log(body);
      if (!error && response.statusCode == 200) {
        // console.log("operation",body);
        evalHandler(body, data, function(err, result){
          // console.log("result", result);
          var msgObj = {
            node: nodeData,
            compute: dataObj.compute,
            data: dataObj.data,
            result: result.result
          }
          var msgSend = new Buffer(JSON.stringify(msgObj).toString());
          node.pubsub.publish(fromNode, msgSend, (err) => {
            if (err) {
              console.log("error", err);
              throw err;
            }
          })
        });
      }
    });

  } else if (operation.match(ipfsRegex)) {
    console.log("operation is ipfs. fetching javascript");
    var filename = operation.split("//");
    var filehash = filename[1];

    try{

      ipfs.cat(filehash, function(err, buffer) {
        if (err) throw err;
        // console.log("operation", buffer.toString());
        var body = buffer.toString();
        evalHandler(body, data, function(err, result){
          // console.log("result", result);
          var msgObj = {
            node: nodeData,
            compute: dataObj.compute,
            data: dataObj.data,
            result: result.result
          }
          var msgSend = new Buffer(JSON.stringify(msgObj).toString());
          node.pubsub.publish(fromNode, msgSend, (err) => {
            if (err) {
              console.log("error", err);
              throw err;
            }
          })
        });

      });

    } catch(e) {
      // res.sendStatus(403);
      throw e;
    }

  } else if (operation.match(npmRegex)) {
      console.log("operation is NPM module. fetching javascript");
      var moduleArray = operation.split("//");
      var moduleName = moduleArray[1];
      var moduleParts = moduleName.split('@');
      var moduleUrl = "https://computes-browserify-cdn.herokuapp.com/debug-bundle/" + moduleName;
      // var moduleUrl = "https://wzrd.in/debug-bundle/" + moduleName;
      request(moduleUrl, function (error, response, body) {
        // console.log(response);
        if (!error && response.statusCode == 200) {
          body = body + ' ("' + moduleParts[0] + '")';
          evalHandler(body, data, function(err, result){
            // console.log("result", result);
            var msgObj = {
              node: nodeData,
              compute: dataObj.compute,
              data: dataObj.data,
              result: result.result
            }
            var msgSend = new Buffer(JSON.stringify(msgObj).toString());
            node.pubsub.publish(fromNode, msgSend, (err) => {
              if (err) {
                console.log("error", err);
                throw err;
              }
            })
          });
        }
      });

   } else {
     console.log("operation is javascript");
     evalHandler(operation, data, function(err, result){
      //  console.log("result", result);
       var msgObj = {
         node: nodeData,
         compute: dataObj.compute,
         data: dataObj.data,
         result: result.result
       }
       var msgSend = new Buffer(JSON.stringify(msgObj).toString());
       node.pubsub.publish(fromNode, msgSend, (err) => {
         if (err) {
           console.log("error", err);
           throw err;
         }
       })
     });
  };
}

const receiveMsg = (msg) => {
  console.log("public:",msg.data.toString());
  var dataObj = JSON.parse(msg.data.toString());
  var fromNode = dataObj.node.id;
  // console.log(dataObj.domain);
  setTimeout(requestWork, 1000);
  // requestWork(dataObj.domain);
  // requestWork();
}

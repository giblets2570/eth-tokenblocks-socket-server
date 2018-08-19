var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);
 
// parse various different custom JSON types as JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/order-created', function(req, res){
  // sending to all connected clients
  io.emit('order-created', req.body.id);
  for(let broker of req.body.brokers) {
    io.emit(`order-created-broker:${broker}`, req.body.id);
  }
  return res.json({message: 'Finished'});
});

app.post('/order-set-price', function(req, res){
  // sending to all connected clients
  io.emit(`order-set-price:${req.body.id}`);
  return res.json({message: 'Finished'});
});

app.post('/order-investor-confirm', function(req, res){
  // sending to all connected clients
  io.emit(`order-investor-confirm:${req.body.id}`, req.body.broker_id);
  return res.json({message: 'Finished'});
});

app.post('/order-broker-confirm', function(req, res){
  // sending to all connected clients
  io.emit(`order-broker-confirm:${req.body.id}`);
  return res.json({message: 'Finished'});
});

http.listen(8090, function(){
  console.log('listening on *:8090');
});


// Oracle service.js
const rp = require("request-promise");

const api_url = process.env.API_URL || 'http://localhost:8000'
const socket_url = process.env.SOCKET_URL || 'http://localhost:8090'

let contract_folder = process.env.CONTRACT_FOLDER

const Oracle = require(`${contract_folder}Oracle.json`)
const CreateOrder = require(`${contract_folder}CreateOrder.json`)
const contract = require('truffle-contract')

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

const oracle = contract(Oracle)
const createOrder = contract(CreateOrder)

oracle.setProvider(web3.currentProvider)
createOrder.setProvider(web3.currentProvider)
// Dirty hack for web3@1.0.0 support for localhost testrpc
// see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
if (typeof oracle.currentProvider.sendAsync !== "function") {
  oracle.currentProvider.sendAsync = function() {
    return oracle.currentProvider.send.apply(
      oracle.currentProvider, arguments
    );
  };
}

let events = [
  {name: 'CallbackOrderCreated', api_url_end: 'orders', socket_url_end: 'order-created'},
  {name: 'CallbackOrderSetPrice', api_url_end: 'orders/{index}/set-price', api_type: 'PUT', socket_url_end: 'order-set-price'},
  {name: 'CallbackOrderInvestorConfirm', api_url_end: 'orders/{index}/investor-confirm', api_type: 'PUT', socket_url_end: 'order-investor-confirm'},
  {name: 'CallbackOrderBrokerConfirm', api_url_end: 'orders/{index}/broker-confirm', api_type: 'PUT', socket_url_end: 'order-broker-confirm'},
  {name: 'CallbackTokenCreated', api_url_end: 'tokens', socket_url_end: ''},
  {name: 'CallbackTokenHoldingsRemoved', api_url_end: 'tokens/holdings-removed', socket_url_end: ''},
  {name: 'CallbackTokenHoldingAdded', api_url_end: 'tokens/holding-added', socket_url_end: ''}
]

let watchCallback = (api_url_end, socket_url_end, api_type) =>  async (err, event) => {
  api_type = api_type ? api_type : 'POST'
  let args = event.args
  let api_url_end_clone = api_url_end;
  for(let key of Object.keys(event.args)) {
    if(args[key].constructor.name == 'BigNumber') args[key] = args[key].toNumber()
    if(api_url_end.includes(`{${key}}`)) api_url_end_clone = api_url_end.replace(`{${key}}`, args[key])
  }
  

  let uri = `${api_url}/${api_url_end_clone}`
  let api_options = {uri:uri,qs:{},body:args,method:api_type,headers:{},json:true}
  try{
    let result = await rp(api_options)
    if(!socket_url_end) return;
    uri = `${socket_url}/${socket_url_end}`
    let socket_options = {uri:uri,qs:{},body:result,method:'POST',headers:{},json:true}
    await rp(socket_options)
  }catch(e){
    console.log('error')
  }
}

web3.eth.getAccounts((err, accounts) => {
  oracle.deployed()
  .then((instance) => {
    for(let event of events) {
      if(instance[event.name]){
        instance[event.name]({},{fromBlock: 0, toBlock: 'pending'})
        .watch(watchCallback(event.api_url_end, event.socket_url_end, event.api_type))
      }else{
        console.log(`No event for ${event.name}`)
      }
    }
  })
  .catch((err) => {
    console.log(err)
  })
})
var app = require('express')();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var http = require('http').Server(app);
var io = require('socket.io')(http);
const rp = require("request-promise");
const contract = require('truffle-contract');
const Web3 = require('web3');

const api_url = process.env.API_URL || 'http://localhost:8000'
const socket_url = process.env.SOCKET_URL || ''
const contract_folder = process.env.CONTRACT_FOLDER

const Oracle = require(`${contract_folder}Oracle.json`)
const OrderKernel = require(`${contract_folder}OrderKernel.json`)
const port = process.env.PORT || 8090

http.listen(port, function(){
  console.log(`listening on *:${port}`);
});
let functions = {
  "order-created": function(body) {
    // sending to all connected clients
    console.log(body)
    io.emit('order-created', body.id);
    console.log('order-created');
    for(let broker of body.brokers) {
      io.emit(`order-created-broker:${broker}`, body.id);
      console.log(`order-created-broker:${broker}`);
    }
  },
  "order-update": function(body) {
    // sending to all connected clients
    console.log(`order-update:${body.id}`)
    io.emit(`order-update:${body.id}`);
  },
}

for(let func in functions) {
  app.post('/'+func, (req, res) => {
    console.log(func)
    functions[func](req.body);
    return res.json({message: "Done"});
  })
}

// Oracle service.js
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
const oracle = contract(Oracle)
const orderKernel = contract(OrderKernel)
oracle.setProvider(web3.currentProvider)
orderKernel.setProvider(web3.currentProvider)

// Dirty hack for web3@1.0.0 support for localhost testrpc
// see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
if (typeof oracle.currentProvider.sendAsync !== "function") {
  oracle.currentProvider.sendAsync = function() {
    return oracle.currentProvider.send.apply(
      oracle.currentProvider, arguments
    );
  };
}

let oracleEvents = [
  {name: 'CallbackTokenCreated', api_url_end: 'tokens', socket_url_end: ''},
];

let orderKernelEvents = [
  {name: 'LogConfirmed', api_url_end: 'orders/{orderHash}/confirmed', api_type: 'PUT'}
];


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
    functions[socket_url_end](result)
  }catch(e){
    console.log(e.toString())
  }
}
web3.eth.getAccounts((err, accounts) => {
  oracle.deployed()
  .then((instance) => {
    for(let event of oracleEvents) {
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
  orderKernel.deployed()
  .then((instance) => {
    for(let event of orderKernelEvents) {
      if(instance[event.name]){
        instance[event.name]({},{fromBlock: 0, toBlock: 'pending'})
        .watch(watchCallback(event.api_url_end, event.socket_url_end, event.api_type))
      }else{
        console.log(`No event for ${event.name}`)
      }
    }
  })
})
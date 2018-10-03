const isUrl = require('is-url');
const Web3 = require('web3');
const contract = require('truffle-contract');
const rp = require("request-promise");

const contract_folder = process.env.CONTRACT_FOLDER || './'
const provider = process.env.PROVIDER || 'http://127.0.0.1:8545'
const api_url = process.env.API_URL || 'http://localhost:8000'
const promisify = require('tiny-promisify')

let web3 = provider.split(':')[0] === 'http'
? new Web3(new Web3.providers.HttpProvider(provider))
: new Web3(new Web3.providers.WebsocketProvider(provider))
// const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8546'))
let tradeKernelEvents = [
  {name: 'LogConfirmed', api_url_end: 'trades/confirmed', api_type: 'PUT'},
  {name: 'LogCancel', api_url_end: 'trades/cancel', api_type: 'PUT'},
  {name: 'LogComplete', api_url_end: 'orders/complete', api_type: 'PUT'},
  {name: 'LogError', api_url_end: 'errors'},
];

let ettEvents = [
  {name: 'TotalSupplyUpdate', api_url_end: 'users/balance/total-supply', api_type: 'PUT'},
  {name: 'Transfer', api_url_end: 'users/balance/transfer', api_type: 'PUT'},
  {name: 'FeeTaken', api_url_end: 'users/balance/fee-taken', api_type: 'PUT'},
  {name: 'EndOfDay', api_url_end: 'tokens/contract/end-of-day', api_type: 'PUT'},
];

let getContracts = async () => {
  let TradeKernel, TokenFactory, ETT;
  if(isUrl(contract_folder)) {
    TradeKernel = await rp.get(`${contract_folder}TradeKernel.json`, {json:true});
    TokenFactory = await rp.get(`${contract_folder}TokenFactory.json`, {json:true});
    ETT = await rp.get(`${contract_folder}ETT.json`, {json:true});
  }else{
    TradeKernel = require(`${contract_folder}TradeKernel.json`);
    TokenFactory = require(`${contract_folder}TokenFactory.json`);
    ETT = require(`${contract_folder}ETT.json`);
  }
  return {TradeKernel, TokenFactory, ETT};
}


let watchCallback = (api_url_end, api_type, extra_args={}) => async (event) => {
  api_type = api_type ? api_type : 'POST'
  let args = event.returnValues
  let api_url_end_clone = api_url_end;
  for(let key of Object.keys(event.returnValues)) {
    if(args[key].constructor.name == 'BigNumber') args[key] = args[key].toNumber()
    if(api_url_end.includes(`{${key}}`)) api_url_end_clone = api_url_end.replace(`{${key}}`, args[key])
  }
  let uri = `${api_url}/${api_url_end_clone}`
  for(let key of Object.keys(extra_args)) args[key] = extra_args[key];
  let api_options = {uri:uri,qs:{},body:args,method:api_type,headers:{},json:true}
  try{
    let result = await rp(api_options);
  }catch(e){
    console.log(e.toString());
  }
}

let createTokenWatch = (ETT) => (event) => {
  let {tokenAddress} = event.returnValues
  let ett = new web3.eth.Contract(ETT.abi, tokenAddress)
  for(let event of ettEvents) {
    if(instance[event.name]){
      instance[event.name]({},{fromBlock: 0, toBlock: 'pending'})
      .watch(watchCallback(event.api_url_end, event.api_type, {token: tokenAddress}));
    }else{
      console.log(`No event for ${event.name}`);
    }
  }
}

let watch = async () => {
  let network = await web3.eth.net.getId()
  let {TradeKernel, TokenFactory, ETT} = await getContracts();
  let tradeKernel = new web3.eth.Contract(TradeKernel.abi, TradeKernel.networks[`${network}`].address)
  let tokenFactory = new web3.eth.Contract(TokenFactory.abi, TokenFactory.networks[`${network}`].address)
  for(let event of tradeKernelEvents) {
    tradeKernel.events[event.name]({
      fromBlock: 0
    })
    .on('data', function(data){
        return watchCallback(event.api_url_end, event.api_type)(data)
    })
    .on('changed', function(event){
        // remove event from local database
    })
    .on('error', console.error);
  }

  tokenFactory.events.TokenCreated({
      fromBlock: 0
  })
  .on('data', function(data){
    console.log(data.returnValues)
    watchCallback('tokens/update/contract','PUT')(data)
  })
  .on('changed', function(event){
      // remove event from local database
  })
  .on('error', console.error);
}

module.exports = {
  watch
}
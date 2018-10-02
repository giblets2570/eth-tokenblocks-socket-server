const isUrl = require('is-url');
const Web3 = require('web3');
const contract = require('truffle-contract');
const rp = require("request-promise");

const contract_folder = process.env.CONTRACT_FOLDER || './'
const provider = process.env.PROVIDER || 'http://127.0.0.1:8545'
const api_url = process.env.API_URL || 'http://localhost:8000'
const promisify = require('tiny-promisify')

const web3 = new Web3(new Web3.providers.HttpProvider(provider));

let tradeKernelEvents = [
  {name: 'LogConfirmed', api_url_end: 'trades/confirmed', api_type: 'PUT'},
  {name: 'LogCancel', api_url_end: 'trades/cancel', api_type: 'PUT'},
  {name: 'LogComplete', api_url_end: 'orders/complete', api_type: 'PUT'},
  {name: 'LogError', api_url_end: 'errors'},
];

let ettEvents = [
  {name: 'TotalSupplyUpdate', api_url_end: 'users/balance/total-supply', api_type: 'PUT'},
  {name: 'Transfer', api_url_end: 'users/balance/transfer', api_type: 'PUT'}
];

let watchCallback = (api_url_end, api_type, extra_args={}) => async (err, event) => {
  api_type = api_type ? api_type : 'POST'
  let args = event.args
  let api_url_end_clone = api_url_end;
  for(let key of Object.keys(event.args)) {
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

let getContracts = async () => {
  let network = await promisify(web3.version.getNetwork)()
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
  const tradeKernel = contract(TradeKernel);
  tradeKernel.setProvider(web3.currentProvider);
  const tokenFactory = contract(TokenFactory);
  tokenFactory.setProvider(web3.currentProvider);
  const ett = contract(ETT);
  ett.setProvider(web3.currentProvider);
  return {tradeKernel, tokenFactory, ett};
}

let createTokenWatch = (ett) => (err, event) => {
  console.log(err)
  console.log(event)
  if(err){
    return console.log(err)
  }
  let {tokenAddress} = event.args
  ett.at(tokenAddress)
  .then((instance) => {
    for(let event of ettEvents) {
      if(instance[event.name]){
        instance[event.name]({},{fromBlock: 0, toBlock: 'pending'})
        .watch(watchCallback(event.api_url_end, event.api_type, {token: tokenAddress}));
      }else{
        console.log(`No event for ${event.name}`);
      }
    }
  })
}

let watch = async () => {
  let {tradeKernel, tokenFactory, ett} = await getContracts();
  web3.eth.getAccounts((err, accounts) => {
    tradeKernel.deployed()
    .then((instance) => {
      for(let event of tradeKernelEvents) {
        if(instance[event.name]){
          instance[event.name]({},{fromBlock: 0, toBlock: 'pending'})
          .watch(watchCallback(event.api_url_end, event.api_type));
        }else{
          console.log(`No event for ${event.name}`);
        }
      }
    })
    .catch((err) => {
      console.log(err);
    })
    tokenFactory.deployed()
    .then((instance) => {
      instance.TokenCreated({},{fromBlock: 0, toBlock: 'pending'})
      .watch((err, event) => {
        watchCallback('tokens/update/contract','PUT')(err, event)
        createTokenWatch(ett)(err, event)
      });
    })
    .catch((err) => {
      console.log(err);
    })

  })
}

module.exports = {
  watch
}
var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);
 
// parse various different custom JSON types as JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/order-created', function(req, res){
  // sending to all connected clients
  console.log('/order-created');
  console.log(req.body);
  io.emit('order-created', req.body.id);
  for(let broker of req.body.brokers) {
    io.emit(`order-created-broker:${broker}`, req.body.id);
  }
  return res.json({message: 'Finished'});
});

app.post('/order-set-price', function(req, res){
  // sending to all connected clients
  console.log('/order-set-price');
  console.log(req.body);
  console.log(`order-set-price:${req.body.id}`);
  io.emit(`order-set-price:${req.body.id}`);
  return res.json({message: 'Finished'});
});

app.post('/order-investor-confirm', function(req, res){
  // sending to all connected clients
  console.log('/order-investor-confirm');
  console.log(req.body);
  console.log(`order-investor-confirm:${req.body.id}`, req.body.broker_id)
  io.emit(`order-investor-confirm:${req.body.id}`, req.body.broker_id);
  return res.json({message: 'Finished'});
});

app.post('/order-broker-confirm', function(req, res){
  // sending to all connected clients
  console.log('/order-broker-confirm');
  console.log(req.body);
  console.log(`order-broker-confirm:${req.body.id}`);
  io.emit(`order-broker-confirm:${req.body.id}`);
  return res.json({message: 'Finished'});
});

http.listen(8090, function(){
  console.log('listening on *:8090');
});
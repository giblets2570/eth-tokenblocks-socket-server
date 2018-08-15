var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);
 
// parse various different custom JSON types as JSON
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post('/order-created', function(req, res){
  // sending to all connected clients
  console.log(req.body.id)
  io.emit('order-created', req.body.id);
  return res.json({message: 'Finished'});
});

http.listen(8090, function(){
  console.log('listening on *:8090');
});
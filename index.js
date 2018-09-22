var app = require('express')();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var http = require('http').Server(app);
var io = require('socket.io')(http);

let {watch} = require('./watcher');

let main = async () => {
  const port = process.env.PORT || 8090

  http.listen(port, function(){
    console.log(`listening on *:${port}`);
  });

  const functions = {
    "trade-created": function(body) {
      // sending to all connected clients
      console.log(body)
      io.emit('trade-created', body.id);
      console.log('trade-created');
      for(let broker of body.brokers) {
        io.emit(`trade-created-broker:${broker}`, body.id);
        console.log(`trade-created-broker:${broker}`);
      }
    },
    "trade-update": function(body) {
      // sending to all connected clients
      console.log(`trade-update:${body.id}`)
      io.emit(`trade-update:${body.id}`);
    },
  }

  for(let func in functions) {
    app.post('/'+func, (req, res) => {
      functions[func](req.body);
      return res.json({message: "Done"});
    })
  }
}


main()
watch()
require('joose')
require('joosex-namespace-depended')
require('hash')
Fs = require('fs')
Sys = require('sys')
Config = JSON.parse(Fs.readFileSync('config.json', 'utf8'))
Http = require('http')
Express = require('express')
IO = require('socket.io')
Jade = require('jade')
Helpers = require('./helpers')
Host = if process.env.NODE_ENV == 'production' then 'kindlebility.darkhax.com' else 'localhost:9090'

# Write out a pidfile when we start
PidFile = "node.#{process.pid}.pid"
Fs.writeFileSync(PidFile, process.pid.toString())

# Cleanup pidfile on exit
process.on 'exit', ->
  Fs.unlinkSync(PidFile)

# Exit cleanly, firing events
process.on 'SIGINT', ->
  process.exit(0)

# Catch errors with Hoptoad
Hoptoad = require('hoptoad-notifier').Hoptoad
Hoptoad.key = Config.hoptoad
process.on 'uncaughtException', (error) ->
  # But only in production mode
  if process.env.NODE_ENV == 'production'
    Hoptoad.notify error, ->
      # Let's exit, since we're not entirely sure what state the app might be in
      process.exit(1)
  else
    Sys.puts(error)

app = Express.createServer()

app.configure ->
  app.use(Express.static(__dirname + '/public'))
  app.set('view engine', 'jade')

app.get '/', (req, res) ->
  res.render('index', {
    layout: false,
    locals: {
      host: Host
    }
  })

app.get /\/go|bookmarklet\.js/, (req, res) ->
  res.contentType('text/javascript')
  if Helpers.verifyParams(req)
    res.render('bookmarklet.ejs', {
      layout: false,
      locals: {
        to: req.param('to'),
        host: Host
      }
    })
  else
    res.send("alert('Invalid request. Missing query params. Try making your bookmarklet again.');")

app.listen(9090)

socket = IO.listen(app)
socket.on 'connection', (client) ->
  client.on 'message', (data) ->
    json = JSON.parse(data)
    json['client'] = client
    Helpers.processSocketIO(json)

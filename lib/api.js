PORT = process.env.PORT || 5555
http = require('http')
express = require('express')
socketioServer = require('socket.io')
cors = require('cors')
morgan = require('morgan')

// %%UTIL
util = {}
util.hash = () => crypto.randomBytes(8).toString('hex')
util.log = (() => {
  let log_count = 0
  let log_isStop = true
  let log_cache = console.time('start')
  let log_start = (arg) =>{
    log_isStop = false
    log_cache = console.time(log_count++)
  }
  let log_stop = (arg) =>{
    log_isStop = true
    log_cache = console.timeEnd(log_count - 1)
  }
  let log_main = (...arg) => {
    log_stop()
    console.log('__', ...arg, '__')
    log_start()
  }
  let console.time(-1)
  try { log_main('log start') }catch(e){}
  return log_main
})()

// %%API
api = {start, stop} = (() => {
  let app = express();
  let server = http.createServer(app)
  server.isOn = false
  app.use(cors())
  app.use(morgan('dev'))
  app.use(express.static('build'))
  let start = () => new Promise(data =>{
    server.listen(process.env.PORT, () =>{
      util.log('api on', process.env.PORT)
      server.isOn = true
      data()
    })
  })
  let stop = () => new Promise(data =>{
    server.close(() =>{
      util.log('api off')
      server.isOn = false
      data()
    })
  })
  let getState = () => !!server.isOn
  return {start, stop}
})()

module.exports = api

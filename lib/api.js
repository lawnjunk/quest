// NOTES
// NON-GOALS
// * parse code into seporate modules
// * adding let/var/const to globals
//   + im using vim-slime while deving and the node-repl
//     will barf if you define a variable more than once
//
//  search for %% to tab trough namespaces

// load env
// import dependencies
http = require('http')
express = require('express')
socketioServer = require('socket.io')
cors = require('cors')
morgan = require('morgan')
colors = require('colors')

// %% f
f = (() => {
  let compose = (a, b) => (...args) => a(b(...args))
  let partial = (cb, ...data) => (...args) =>
  cb.apply(null, [...data].concat([...args]))
  reducerCreate = name =>
  (l, ...args) => Array.prototype[name].apply(l, [...args])
  reducers = ['map', 'filter', 'reduce', 'concat', 'slice']
  let { map, filter, reduce, concat, slice } =
    reducers.reduce((p, n) => (p[n] = reducerCreate(n)) && p, {})
  return { map, filter, reduce, concat, slice, compose, partial }
})()



// %%UTIL
util = {}
util.safely = (cb) => { try{ cb() } catch(e){} }
util.hash = () => crypto.randomBytes(8).toString('hex')
util.log = (function(){
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
  let log_main = (...arg) =>{
    log_stop()
    console.log('__'.random, ...arg, '__'.random)
    log_start()
  }
  console.time(-1)
  util.safely(() => log_main('log start'))
  return log_main
})()

// %% store
store = (() => {
  let listeners = []
  let state = {}
  let addListener = (cb) => listeners.push(cb)
  let getState = () => state
  let emmit = () => listeners.forEach((cb) => cb(state))
  let setState = (change) => (state = change) && emmit()
  let updateState = (change) =>
  (state = Object.assign(state, change)) && emmit()
  return { addListener, getState, updateState , setState}
})()

// %% task
task = (() =>{
  let socketCreate = (socket) =>{
    store.updateState(s => {connected: f.concat(s.connected, [s])})
  }
  return {socketCreate}
})()

// %% realtime
realtime = (() => {
  let handleConnection = (socket) =>{
    util.log('socket connection')
    socketPool.add(socket)
  }
  return {handleConnection}
})()

// %%API
api = (() => {
  let PORT = process.env.PORT || 7000
  let app = express();
  let server = http.createServer(app)
  let io = socketioServer(server);
  io.on('connection', realtime.handleConnection);
  server.isOn = false
  app.use(cors())
  app.use(morgan('dev'))
  app.use(express.static('build'))
  let start = () => new Promise(data =>{
    server.listen(PORT, () =>{
      util.log('api on', PORT)
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
  return {start, stop, getState}
})()
module.exports = api

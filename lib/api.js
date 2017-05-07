// NOTES
// NON-GOALS
// * parse code into seporate modules
// * adding let/var/const to globals
//   + im using vim-slime while deving and the node-repl
//     will barf if you define a variable more than once
//
//  search for %% to tab trough namespaces
//  serach for ## to tab trough environments
//
//  IDEAS
//    * add store postHook that percists to a db

// load env
// import dependencies
//
// DEP TREE
// |mocks
// |  |util
// |  | |f
// |api
// |  |f
// |  |util
// |  | |f
// |  |realtime
// |    |task
//        | ipsum
//        |  | f
// |      |f
// |      |store
// |        |f
// |main
// |  |util
cors = require('cors')
http = require('http')
colors = require('colors')
expect = require('expect')
events = require('events')
morgan = require('morgan')
express = require('express')
socketioServer = require('socket.io')

// %% f
f = (() => {
  let compose = (a, b) => (...args) => a(b(...args))
  let partial = (cb, ...data) => (...args) =>
  cb.apply(null, [...data].concat([...args]))
  reducerCreate = name =>
  (l, ...args) => Array.prototype[name].apply(l, [...args])
  reducers = ['map', 'filter', 'reduce', 'concat', 'slice', 'forEach']
  let { map, filter, reduce, concat, slice , forEach} =
    reducers.reduce((p, n) => (p[n] = reducerCreate(n)) && p, {})
  each = compose(() => true, forEach)
  list = (n, cb) => map(new Array(n).fill(null), cb)
  go = (...list) => reduce([...list], (prev, cb) => cb(), null)
  return { map, filter, reduce, concat, slice, compose, partial, forEach, each, list, go}
})()

// %%UTIL
util = (() => {
  let safely = (cb) => { try{ cb() } catch(e){} }
  let hash = () => crypto.randomBytes(8).toString('hex')
  let randomBelow = (num) => Math.floor(Math.random() * num)
  let random = (offset, scale) => 
    f.compose(num => num + offset, f.partial(randomBelow, scale - offset))()
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
  let log = (...arg) =>{
    log_stop()
    console.log('=='.green, ...arg, '=='.green)
    log_start()
  }
  console.time(-1)
  safely(() => log('log start'))
  return {log, safely, hash, random}
})()

// %% mocks
mock = (() => {
  let socket = () => (() => {
    let result =  new events.EventEmitter()
    result.id = util.hash()
    return result;
  })()
  return {socket}
})()

// %% store
store = (() => {
  let hooks = {pre: [], post: []}
  let state = {}
  let hookPush = (type, cb) => hooks[type].push(cb)
  let getState = () => state
  let runHooks = type => f.each(hooks[type], cb => cb(state))
  let setState = change => runHooks('pre') && (state = change) && runHooks('post')
  let updateState = change =>
  runHooks('pre') &&
    (state = Object.assign(state, change(state))) &&
    runHooks('post')
  return { hookPush, getState, updateState , setState}
})()

// %% ipsum
ipsum = (() =>{
  let vocbulary = {
    world: ('the park before meddow hill and show ' +
      'yard to moon rock forest of mountain fog a ' +
      'open flats system').split(' '),
  }
  let vocabIpusmCreate = (topic) => () => {
    let index 
    let words = vocbulary[topic]
    let length = util.random(3, 6)
    words = f.list(length, () => 
      words[util.random(0, words.length)])
    return words.join(' ')
  }
  let world = vocabIpusmCreate('world')
  return {world}
})()

// %% world
world = (() =>{
  let create = () => ({
    id: util.hash(),
    title: ipsum.world(),
    width: 25, 
    height: 25,
  })
  return {create} 
})()

// %% action
router = (() =>{
  let routes = { }
  let routePush = (path, cb) => (routes[path] = cb ) 
  let initConnection = (s) => {
    console.log('routes', routes)
    for(let path in routes){
      console.log('on path', path)
      s.on(path, routes[path])}}
  return {routePush, initConnection}
})()

router.routePush('/read/world', () => util.log(world.create()))

s = mock.socket()
s.on('cool', () => util.log('cool'))
router.initConnection(s)
s.emit('/read/world')


// %% task
task = (() =>{
  let socketCreate = (socket) =>
  store.updateState(past =>({
    connections: f.concat(past.connections, [socket])}))
    return {socketCreate}
})()

task.socketCreate({id: util.hash()})

// %% realtime
realtime = (() => {
  let handleConnection = (s) => task.socketCreate(s)
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

// ## TESTING
if (process.env.NODE_ENV === 'TESTING') (() => {
//store.hookPush('pre', (s) => util.log('pre', s))
//store.hookPush('post', (s) => util.log('post', s))
//store.setState({
  //connections: [],
//})
  describe('testing api', function(){
    it('should pass', () => expect(true).toEqual(true))
  })
})()

if (process.env.NODE_ENV === 'RUNNING') (() => {
  // TODO: implament  %%main
})()

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
// %% deps
crypto = require('crypto')
cors = require('cors')
http = require('http')
colors = require('colors')
expect = require('expect')
events = require('events')
morgan = require('morgan')
express = require('express')
socketioServer = require('socket.io')
socketioClient = require('socket.io-client')

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
  let safely = (cb) => { try{return cb() } catch(e){} }
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
util.request = (client, path, body) =>{
  return new Promise((data, err) => {
    let responsePath = path.replace('/q/', '/r/')
    let responseHandler = (res) => {
      client.removeListener(responsePath, responseHandler)
      client.removeListener('error', errorHandler)
      if(res.status > 299) return err(res)
        data(res)
    }
    let errorHandler = (res) => {
      client.removeListener(responsePath, responseHandler)
      client.removeListener('error', errorHandler)
      err(res)
    }
    client.on(responsePath, responseHandler)
    client.on('error', errorHandler)
    client.emit(path, body)
  })
}

// %% mocks
mock = (() => {
  let socket = () => {
    return new Promise((data, err) => {
      let PORT = process.env.PORT || 7000
      let c = socketioClient('http://localhost:' + PORT)
      c.on('/r/connect', (d) => {
        data(c)
        console.log('d', d)
      })
      c.on('error', () => err(c))
    })
  }

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
store.setState({
  connections: [],
})

// %% ipsum
ipsum = (() =>{
  let vocbulary = {
    world: ('the park before meddow hill and show ' +
            'yard to moon rock forest of mountain fog a ' +
            'open flats system').split(' '),
    player: ('yellow lavender mint peach salmon cyan ' +
             'beige lime aqua sky').split(' '),
    location: ('grassy sandy quiet calm windy beach ' +
               'cloudy night lookout above below aside the and a' +
               'rocky dawn comfortable wooden drywall glass').split(' '),
  }
  let vocabIpusmCreate = (min, max, topic) => () => {
    let index
    let words = vocbulary[topic]
    let length = util.random(min, max)
    words = f.list(length, () =>
                   words[util.random(0, words.length)])
                   return words.join(' ')
  }
  let world = vocabIpusmCreate(3, 5, 'world')
  let player = vocabIpusmCreate(1, 3,'player')
  let location = vocabIpusmCreate(1, 4,'location')
  return {world, player, location}
})()

// %% world
world = (() =>{
  let create = () => ({
    id: util.hash(),
    title: ipsum.world(),
    width: 25,
    height: 25,
  })
  let validate = w => !!w.id && !!w.title && !!w.width && !!w.height
  return {create, validate}
})()

// %% router
router = (() =>{
  let routes = { }
  let on = (path, cb) => (routes[path] = cb )
  let initConnection = (s) => {
    util.log('initConnection')
    store.updateState(past =>({
      connections: f.concat(past.connections, [s])}))
      s.state = {id: util.hash()}
      for(let path in routes){
        s.on(path, (...args) => {
          let result = routes[path](s, ...args)
          s.emit(path.replace('/q/', '/r/'), result)
          util.log(path, result)
        })
      }
      s.emit('/r/connect', s.state)
  }
      return {on, initConnection}
})()
router.on('/q/read/world', (s) => {
  if(s.state.world) return {status: 200, data: s.state.world}
  let data = s.state.world = world.create()
  return {status: 200, data}
})
router.on('/q/update/world', (s, data) => {
  util.log('/q/update/world', data)
  if(data && world.validate(data)){
    s.state.world = data;
    return  {status: 200, data}
  }
  return {status: 400}
})

// %%API
api = (() => {
  let PORT = process.env.PORT || 7000
  let app = express();
  let server = http.createServer(app)
  let io = socketioServer(server);
  io.on('connection', router.initConnection);
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
  let stop = (done) => new Promise(data =>{
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
  describe('testing world', function(){
    before(api.start)
    after((done) => api.stop().then(done()))
    describe('/q/read/world', function(){
      it('should resolve a world', (done) => {
        mock.socket()
        .then(s => util.request(s, '/q/read/world'))
        .then(res => {
          expect(res.status).toEqual(200)
          expect(res.data.id).toExist()
          expect(res.data.title).toExist()
          expect(res.data.width).toEqual(25)
          expect(res.data.height).toEqual(25)
          done()
        })
        .catch(done)
      })
    })
  })
})()

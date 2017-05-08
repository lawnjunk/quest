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
//
// load env
// import dependencies
// define modules
// export api
// test modules
// * mock 
// tests 

// ## DEV

// %% load env
require('dotenv').config()

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
  let copy = (item) => {
    let result = {}
    for(let key in item){
      if(typeof item[key] === 'object')
        result[key] = copy(item[key])
      else
        result[key] = item[key]
    }
    return result
  }
  let reducerCreate = name =>
    (l, ...args) => Array.prototype[name].apply(l, [...args])
  let reducers = ['map', 'filter', 'reduce', 'concat', 'slice', 'forEach']
  let { map, filter, reduce, concat, slice , forEach} =
    reducers.reduce((p, n) => (p[n] = reducerCreate(n)) && p, {})
  let each = compose(() => true, forEach)
  let list = (n, cb) => map(new Array(n).fill(null), cb)
  let go = (...list) => reduce([...list], (prev, cb) => cb(), null)
  let append = (list, ...items) => list.concat([...items])
  let prepend = (list, ...items) => [...items].concat(list)
  return { map, filter, reduce, concat, slice, compose, partial, 
           forEach, each, list, go, append, prepend, copy}
})()

// %% util
util = (() => {
  let safely = (cb) => { try{return cb() } catch(e){} }
  let hash = () => crypto.randomBytes(8).toString('hex')
  let randomBelow = (num) => Math.floor(Math.random() * num)
  let random = (offset, scale) =>
    f.compose(num => num + offset, f.partial(randomBelow, scale - offset))()
  let reload = () => {
    delete require.cache[require.resolve('./index.js')]
    return require('./index.js')
  }
  let log_count = 1
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
  let log = (...args) =>{
    let msg = ['=='.green, ...args, '== '.green].join(' ')
    process.stdout.write(msg)
    log_stop()
    log_start()
    return msg
  }
  console.time(log_count - 1)
  log('log start')
  return {log, safely, hash, random, reload}
})()
util.request = (client, path, body) =>{
  return new Promise((data, err) => {
    client.emit(path, body, (response) => {
      if(response.status > 299) return err(response)
      data(response)
    })
  })
}

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

// %% store
createStore = (() => {
  let hooks = {pre: [], post: []}
  let state = {}
  let hookPush = (type, cb) => hooks[type].push(cb)
  let getState = () => state
  let runHooks = type => f.each(hooks[type], cb => cb(state))
  let setState = change => runHooks('pre') && (state = change(state)) && runHooks('post')
  let updateState = change =>
  runHooks('pre') &&
    (state = Object.assign(state, change(state))) &&
    runHooks('post')
  return { hookPush, getState, updateState , setState}
})
store = createStore()
store.setState(s => ({
  connections: [],
  world: {
    id: util.hash(),
    title: ipsum.world(),
    width: Number(process.env.WORLD_WIDTH),
    height: Number(process.env.WORLD_HEIGHT),
  },
  locations: f.list(Number(process.env.WORLD_HEIGHT), (_, y ) => 
                f.list(Number(process.env.WORLD_WIDTH), (_, x) => ({
                  y, x, z: 0, players: [], id: util.hash(), name: ipsum.location()
                })))}))

// %% location 
location = (() => {
  let locationCreate = (data) => ({
    z: 0,
    x: data.x,
    y: data.y,
    id: util.hash(),
    name: ipsum.location(),
  })
  let read = (s, data, send) =>{
    if(data.x === undefined || data.y === undefined) return send({status: 400})
    data.x %=  Number(process.env.WORLD_WIDTH)
    data.y %=  Number(process.env.WORLD_HEIGHT)
    let locations = f.copy(store.getState().locations)
    let oldLocation = locations[s.state.location.x][s.state.location.y]
    oldLocation.players = f.filter(oldLocation.players, p => p.id != s.state.id)
    let result = locations[data.y][data.x]
    s.state.location = f.copy(result)
    result.players.push(f.copy(s.state))
    store.updateState(s => {locations})
    return send({status: 200, data: result})
  }
  return {read}
})()

// %% router
router = (() =>{
  let routes = { }
  let on = (path, cb) => (routes[path] = cb )
  let initConnection = (s) => {
    util.log('initConnection', routes)
    store.updateState(past =>({
      connections: f.concat(past.connections, [s])}))
      s.state = {
        id: util.hash(),
        name: ipsum.player(), 
        location: f.copy(store.getState().locations[0][0])
      }
      for(let path in routes){
        let cb = routes[path]
        util.log('adding on', path, 'to', s.state.id)
        s.on(path, (arg, send) => {
          util.log('hit', path, arg)
          return cb(s, arg, send)
        })
      }
      s.emit('/connect', s.state)
  }
  return {on, initConnection}
})()
router.on('/read/location', location.read)

// %% api
api = module.exports = (() => {
  let PORT = process.env.PORT 
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

  // %% mock
  mock = (() => {
    let socketCreate = function(){
      return new Promise((data, err) =>{
        let PORT = process.env.PORT 
        let socket = socketioClient('http://localhost:' + PORT)
        this.tempSocket = socket
        socket.on('/connect', (state) => (socket.state = state) && data(socket))
        socket.on('error', err)
      })
    }
    let socketDelete = function(){
        this.tempSocket.close()
        return Promise.resolve()
    }
    return {socketCreate, socketDelete}
  })()

  describe('testing f', function(){
    it('should compose two functions', () =>{
      let addFiveTimesTen = f.compose(num => num * 10, num => num + 5)
      expect(addFiveTimesTen(1)).toEqual(60)
      let capsAndTrim = f.compose(s => s.trim(), s => s.toUpperCase())
      expect(capsAndTrim(' hello ')).toEqual('HELLO')
    })
    it('should create a partial', () =>{
      let add = (a, b) => a + b 
      let addTen = f.partial(add, 10)
      expect(addTen(2)).toEqual(12)
    })
    it('should map an array', () =>{
      let result = f.map([1,2,3], (n, i, a) => n + i + a.length)
      expect(result).toEqual([4,6,8])
    })
    it('should filter an array', () =>{
      let result = f.filter([1,2,3,4,5,6], (n) => n % 2 == 0 )
      expect(result).toEqual([2,4,6])
    })
    it('should reudce an array', () =>{
      let result = f.reduce([1,2,3], (p, n) => p + n)
      expect(result).toEqual(6)
    })
    it('should forEach an array', () =>{
      let data = []
      let result = f.forEach([1,2,3], (n) => data.push(n))
      expect(result).toEqual(undefined)
      expect(data).toEqual([1,2,3])
    })
    it('should each an array', () =>{
      let data = []
      let result = f.each([1,2,3], (n) => data.push(n))
      expect(result).toEqual(true)
      expect(data).toEqual([1,2,3])
    })
    it('should concat an array', () =>{
      let result = f.concat([3], [4,5])
      expect(result).toEqual([3,4,5])
    })
    it('should append a numbers', () =>{
      let result = f.append([1,2,3], 4, 5, 6)
      expect(result).toEqual([1,2,3,4,5,6])
    })
    it('should prepend a numbers', () =>{
      let result = f.prepend([1,2,3], 4, 5, 6)
      expect(result).toEqual([4,5,6,1,2,3])
    })
    it('should slice an array', () =>{
      let result = f.slice([0,1,2,3,4], 1, 4)
      expect(result).toEqual([1,2,3])
    })
    it('should list should create an array', () => {
      let result = f.list(5, (_, i) => i)
      expect(result).toEqual([0,1,2,3,4])
    })
    it('it should return the last result', () =>{
      let a, b, c;
      let result = f.go(
        () => a = 0,
        () => b = 1,
        () => c = 2,
        () => 'hello'
      )
      expect(a).toEqual(0)
      expect(b).toEqual(1)
      expect(c).toEqual(2)
      expect(result).toEqual('hello')
    })
  })
  describe('tesing util', function(){
    it('util.hash should return a hash', () =>{
      let result = util.hash()
      expect(typeof result).toEqual('string')
      expect(result.length).toEqual(16)
    })
    it('util.log should return a msg', () =>{
      let result = util.log('hello', 'world')
      expect(result).toEqual(['=='.green, 'hello', 'world', '== '.green].join(' '))
    })
    it('util.safely should not throw ', () =>{
      let dangerous = () => {throw 'hello'}
      expect(dangerous).toThrow()
      expect(f.partial(util.safely, dangerous)).toNotThrow()
    })
    it('util.random should return a number', ()=>{
      let result = util.random(10, 100)
      expect(typeof result).toEqual('number')
      expect(result).toBeLessThan(100)
      expect(result).toBeGreaterThan(9)
    })
  })
  describe('testing store', function(){
    it('createStore should return a store', () => {
      let store = createStore();
      expect(store.setState).toExist()
      expect(store.getState).toExist()
      expect(store.updateState).toExist()
      expect(store.hookPush).toExist()
      expect(store.getState()).toEqual({})
    })
    it('store.updateState should update the store state', ()=>{
      let store = createStore();
      expect(store.getState()).toEqual({})
      store.updateState(s => ({title: 'hah'}))
      expect(store.getState()).toEqual({title: 'hah'})
      store.updateState(s => ({cool: 'lul'}))
      expect(store.getState()).toEqual({title: 'hah', cool: 'lul'})
      store.updateState(s => ({title: 'a'}))
      expect(store.getState()).toEqual({title: 'a', cool: 'lul'})
    })
    it('store.setState should set the store state', ()=>{
      let store = createStore();
      expect(store.getState()).toEqual({})
      store.setState(s => ({title: 'hah'}))
      expect(store.getState()).toEqual({title: 'hah'})
      store.setState(s => ({cool: 'lul'}))
      expect(store.getState()).toEqual({cool: 'lul'})
    })
    it('store.hookPush should add pre and post hooks', ()=>{
      let calls = 0;
      let store = createStore();
      let last = {}
      let next = {a: '1'}
      store.hookPush('pre', s => calls++ && expect(s).toEqual(last))
      store.hookPush('pre', s => calls++ && expect(s).toEqual(last))
      store.hookPush('post', s => calls++ && expect(s).toEqual(next))
      store.hookPush('post', s => calls++ && expect(s).toEqual(next))
      store.setState(s => next)
      last = next
      next = {b: '2'}
      store.setState(s => next)
      expect(calls).toEqual(8)
    })
  })
  describe('testing ipsum', function(){
    it('ipsum.world should return a string', () => {
      let result = ipsum.world()
      expect(result.split(' ').length).toBeGreaterThan(2)
      expect(result.split(' ').length).toBeLessThan(5)
    })
    it('ipsum.location should return a string', () => {
      let result = ipsum.location()
      expect(result.split(' ').length).toBeGreaterThan(0)
      expect(result.split(' ').length).toBeLessThan(4)
    })
    it('ipsum.player should return a string', () => {
      let result = ipsum.player()
      expect(result.split(' ').length).toBeGreaterThan(0)
      expect(result.split(' ').length).toBeLessThan(3)
    })
  })
  describe('testing world', function(){
    before(api.start)
    after((done) => api.stop().then(done()))
    describe('mock socket', function(){
      before(mock.socketCreate.bind(this))
      after(mock.socketDelete.bind(this))
      it('should resolve a world', () => {
        expect(this.tempSocket.state.id).toExist()
      })
    })
    describe('testing location', function(){
      before(mock.socketCreate.bind(this))
      after(mock.socketDelete.bind(this))
      it('/read/location should resolve a location', () => {
        return util.request(this.tempSocket, '/read/location', {x: 0, y: 0})
        .then(res => {
          expect(res.status).toEqual(200)
          expect(res.data.x).toEqual(0)
          expect(res.data.y).toEqual(0)
          expect(res.data.name).toExist()
          this.tempLocation = res.data;
        })
      })
      it('/read/location should resolve a location', () => {
        return util.request(this.tempSocket, '/read/location', {x: 25, y: 25})
        .then(res => {
          console.log('res.data', res.data)
          expect(res.status).toEqual(200)
          expect(res.data.x).toEqual(0)
          expect(res.data.y).toEqual(0)
          expect(res.data.name).toEqual(this.tempLocation.name)
        })
      })
    })
  })
})()

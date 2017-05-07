// %%UTIL 
util = {}
// __hash
util.hash = () => crypto.randomBytes(8).toString('hex')
// __log
log_count = 0
log_isStop = true
log_cache = console.time('start')
log_start = (arg) =>{
  log_isStop = false
  log_cache = console.time(log_count++)
}
log_stop = (arg) =>{
  log_isStop = true 
  log_cache = console.timeEnd(log_count - 1)
}
log_main = (...arg) => {
  log_stop()
  console.log('__', ...arg, '__')
  log_start()
}
util.log = log_main
console.time(-1)
try { log_main('log start') }catch(e){}
module.exports = util

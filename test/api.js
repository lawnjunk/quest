// %%API_TEST
let util = require('../lib/util.js')
require('dotenv').config()
let api = require('../lib/api.js')
describe('api', function(){
  before(api.start)
  describe('world', function(){
    util.log('TODO: ,red,world')
  })
  after(api.stop)
})

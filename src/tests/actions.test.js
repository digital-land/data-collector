/* eslint-env mocha */
var assert = require('chai').assert
var fs = require('fs')
var nock = require('nock')
var timekeeper = require('timekeeper')
var fixtures = require('./fixtures/expected.json')
var handler = require('./../handler.js').actions

describe('Collector - Actions', function () {
  const url = 'https://fakeurl.com'

  before(function () {
    nock.disableNetConnect()

    nock(url)
      .persist()
      .get('/')
      .reply(200, 'hello')

    nock(url)
      .get('/404')
      .reply(404, 'not found')

    nock(url)
      .get('/timeout')
      .reply(200, function (uri, requestBody) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve()
          }, 10001)
        })
      })

    return timekeeper.freeze(new Date('2019-01-01'))
  })

  after(function () {
    nock.restore()
    return timekeeper.reset()
  })

  describe('getTodaysDate', function () {
    it('should return todays date in ISO8601 format', function () {
      const result = handler.getTodaysDate()
      return assert.equal(result, '2019-01-01T00:00:00.000Z')
    })

    it('should return todays date in YYYY-MM-DD format (short)', function () {
      const result = handler.getTodaysDate(true)
      return assert.equal(result, '2019-01-01')
    })
  })

  describe('retrieve', function () {
    it('should return an object with information if the URL is resolvable, not including organisation and dataset', async function () {
      const result = await handler.retrieve(url)
      delete result.headers.data.elapsed
      return assert.deepEqual(result, fixtures.resolvable)
    })

    it('should return an object with information if the URL is resolvable, including organisation and dataset', async function () {
      const result = await handler.retrieve(url, 'local-authority-eng:test', 'test-register')
      delete result.headers.data.elapsed
      return assert.deepEqual(result, fixtures.resolvableWithOrganisation)
    })

    it('should return an object with information if the URL doesn\'t return a 200', async function () {
      const result = await handler.retrieve(url + '/404')
      delete result.headers.data.elapsed
      return assert.deepEqual(result, fixtures.not200)
    })

    it('should return an object with information if the URL times out', async function () {
      const result = await handler.retrieve(url + '/timeout')
      delete result.headers.data.elapsed
      return assert.deepEqual(result, fixtures.timeout)
    })
  })

  describe('mapStatus', function () {
    it('should return the original status as a string', function () {
      const result = handler.mapStatus(200)
      return assert.equal(result, '200')
    })

    it('should return ENOTFOUND as a string of "404"', function () {
      const result = handler.mapStatus('ENOTFOUND')
      return assert.equal(result, '404')
    })

    it('should return ECONNABORTED as a string of "404"', function () {
      const result = handler.mapStatus('ECONNABORTED')
      return assert.equal(result, '408')
    })

    it('should return HPE_INVALID_CONSTANT as a string of "404"', function () {
      const result = handler.mapStatus('HPE_INVALID_CONSTANT')
      return assert.equal(result, 'PARSE_ERROR')
    })

    it('should return UNABLE_TO_VERIFY_LEAF_SIGNATURE as a string of "404"', function () {
      const result = handler.mapStatus('UNABLE_TO_VERIFY_LEAF_SIGNATURE')
      return assert.equal(result, 'TLS_ERROR')
    })
  })

  describe('sendSQSMessage', function () {

  })

  describe('deleteSQSMessage', function () {

  })

  describe('uploadToS3', function () {

  })

  describe('getDatasets', function () {

  })

  describe('getMaster', function () {

  })

  describe('getSingular', function () {

  })
})

// var assert = require('chai').assert
// var nock = require('nock')
// var timekeeper = require('timekeeper')
// var fs = require('fs')
// var handler = require('./../handler.js').actions
// var register = fs.readFileSync(process.cwd() + '/tests/fixtures/register.csv')

// describe('Collector - Actions', function () {
//   beforeEach(function () {
//     nock.disableNetConnect()
//     nock('http://fakeurl.com')
//       .get('/register')
//       .reply(200, register)

//     nock('http://fakeurl.com')
//       .get('/registerf')
//       .reply(404)

//     nock('http://fakeurl.com')
//       .get('/register_stream')
//       .reply(204, Buffer.from('0105A', 'hex'))

//     return timekeeper.freeze(new Date(2019, 0, 1))
//   })

//   afterEach(function () {
//     nock.cleanAll()
//     nock.enableNetConnect()

//     return timekeeper.reset()
//   })

//   describe('checkIfFileExists', function () {

//   })

//   describe('generateRandomId', function () {
//     it('should generate a random ID of 24 characters', function () {
//       return assert.lengthOf(handler.generateRandomId(), 48)
//     })
//   })

//   describe('getTodaysDate', function () {
//     it('should return today\'s date', function () {
//       const result = handler.getTodaysDate()
//       assert.lengthOf(result, 10)
//       return assert.equal(result, '2019-01-01')
//     })
//   })

//   describe('mapPutRequests', function () {
//     const expecting = {
//       PutRequest: {
//         Item: {
//           organisation: null,
//           date: '2019-01-01',
//           'register-url': null,
//           references: {
//             headers: null,
//             validation: null,
//             response: {
//               original: null,
//               fixed: null
//             }
//           }
//         }
//       }
//     }

//     it('should return an object with just a date set', function () {
//       return assert.deepEqual(handler.mapPutRequests({}), expecting)
//     })

//     it('should return an object with the organisation and date set', function () {
//       expecting.PutRequest.Item.organisation = 'fake:' + process.env.type
//       return assert.deepEqual(handler.mapPutRequests({ organisation: 'fake' }), expecting)
//     })
//   })

//   describe('mapStatus', function () {
//     it('should map `ENOTFOUND` to 404', function () {
//       return assert.equal(handler.mapStatus('ENOTFOUND'), 404)
//     })
//     it('should map `ECONNABORTED` to 408', function () {
//       return assert.equal(handler.mapStatus('ECONNABORTED'), 408)
//     })
//     it('should map `UNABLE_TO_VERIFY_LEAF_SIGNATURE` to `TLS_ERROR`', function () {
//       return assert.equal(handler.mapStatus('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), 'TLS_ERROR')
//     })
//     it('should map `HPE_INVALID_CONSTANT` to `PARSE_ERROR`', function () {
//       return assert.equal(handler.mapStatus('HPE_INVALID_CONSTANT'), 'PARSE_ERROR')
//     })
//     it('should return original status if it can\'t map an error', function () {
//       return assert.equal(handler.mapStatus('FAKE_RANDOM_ERROR'), 'FAKE_RANDOM_ERROR')
//     })
//     it('should return `UNKNOWN_ERROR` if status is undefined', function () {
//       return assert.equal(handler.mapStatus(), 'UNKNOWN_ERROR')
//     })
//   })

//   describe('retrieve', function () {
//     let expecting = {}

//     beforeEach(function () {
//       expecting = {
//         response: null,
//         error: false,
//         headers: {
//           raw: null,
//           status: null,
//           mime: null
//         }
//       }
//     })

//     it('should retrieve the URL', async function () {
//       expecting.response = register
//       expecting.headers.status = 200
//       expecting.headers.raw = {}
//       const result = await handler.retrieve('http://fakeurl.com/register')
//       return assert.deepEqual(result, expecting)
//     })

//     it('should return an object with errors if there\'s an error retrieving a URL response', async function () {
//       expecting.response = Buffer.from('')
//       expecting.headers.status = 404
//       expecting.headers.raw = {}
//       const result = await handler.retrieve('http://fakeurl.com/registerf')
//       return assert.deepEqual(result, expecting)
//     })

//     it('should return an object with errors if there\'s an error connecting to a URL', async function () {
//       expecting.error = true
//       expecting.headers.status = 'ENETUNREACH'
//       const result = await handler.retrieve('/')
//       return assert.deepEqual(result, expecting)
//     })

//     it('should return an object with errors if there\'s an error streaming a URL response', async function () {
//       // expecting.error = true
//       // expecting.headers.status = 'ENETUNREACH'
//       const result = await handler.retrieve('http://fakeurl.com/register_stream')
//       return assert.deepEqual(result, expecting)
//     })
//   })
// })

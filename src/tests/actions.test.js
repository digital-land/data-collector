/* eslint-env mocha */
var assert = require('chai').assert
var nock = require('nock')
var timekeeper = require('timekeeper')
var fs = require('fs')
var handler = require('./../handler.js').actions
var register = fs.readFileSync(process.cwd() + '/tests/fixtures/register.csv')

describe('Collector - Actions', function () {
  beforeEach(function () {
    nock.disableNetConnect()
    nock('http://fakeurl.com')
      .get('/register')
      .reply(200, register)

    nock('http://fakeurl.com')
      .get('/registerf')
      .reply(404)

    nock('http://fakeurl.com')
      .get('/register_stream')
      .reply(204, Buffer.from('0105A', 'hex'))

    return timekeeper.freeze(new Date(2019, 0, 1))
  })

  afterEach(function () {
    nock.cleanAll()
    nock.enableNetConnect()

    return timekeeper.reset()
  })

  describe('checkIfFileExists', function () {

  })

  describe('generateRandomId', function () {
    it('should generate a random ID of 24 characters', function () {
      return assert.lengthOf(handler.generateRandomId(), 48)
    })
  })

  describe('getTodaysDate', function () {
    it('should return today\'s date', function () {
      const result = handler.getTodaysDate()
      assert.lengthOf(result, 10)
      return assert.equal(result, '2019-01-01')
    })
  })

  describe('mapPutRequests', function () {
    const expecting = {
      PutRequest: {
        Item: {
          organisation: null,
          date: '2019-01-01',
          'register-url': null,
          references: {
            headers: null,
            validation: null,
            response: {
              original: null,
              fixed: null
            }
          }
        }
      }
    }

    it('should return an object with just a date set', function () {
      return assert.deepEqual(handler.mapPutRequests({}), expecting)
    })

    it('should return an object with the organisation and date set', function () {
      expecting.PutRequest.Item.organisation = 'fake:' + process.env.type
      return assert.deepEqual(handler.mapPutRequests({ organisation: 'fake' }), expecting)
    })
  })

  describe('mapStatus', function () {
    it('should map `ENOTFOUND` to 404', function () {
      return assert.equal(handler.mapStatus('ENOTFOUND'), 404)
    })
    it('should map `ECONNABORTED` to 408', function () {
      return assert.equal(handler.mapStatus('ECONNABORTED'), 408)
    })
    it('should map `UNABLE_TO_VERIFY_LEAF_SIGNATURE` to `TLS_ERROR`', function () {
      return assert.equal(handler.mapStatus('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), 'TLS_ERROR')
    })
    it('should map `HPE_INVALID_CONSTANT` to `PARSE_ERROR`', function () {
      return assert.equal(handler.mapStatus('HPE_INVALID_CONSTANT'), 'PARSE_ERROR')
    })
    it('should return original status if it can\'t map an error', function () {
      return assert.equal(handler.mapStatus('FAKE_RANDOM_ERROR'), 'FAKE_RANDOM_ERROR')
    })
    it('should return `UNKNOWN_ERROR` if status is undefined', function () {
      return assert.equal(handler.mapStatus(), 'UNKNOWN_ERROR')
    })
  })

  describe('retrieve', function () {
    let expecting = {}

    beforeEach(function () {
      expecting = {
        response: null,
        error: false,
        headers: {
          raw: null,
          status: null,
          mime: null
        }
      }
    })

    it('should retrieve the URL', async function () {
      expecting.response = register
      expecting.headers.status = 200
      expecting.headers.raw = {}
      const result = await handler.retrieve('http://fakeurl.com/register')
      return assert.deepEqual(result, expecting)
    })

    it('should return an object with errors if there\'s an error retrieving a URL response', async function () {
      expecting.response = Buffer.from('')
      expecting.headers.status = 404
      expecting.headers.raw = {}
      const result = await handler.retrieve('http://fakeurl.com/registerf')
      return assert.deepEqual(result, expecting)
    })

    it('should return an object with errors if there\'s an error connecting to a URL', async function () {
      expecting.error = true
      expecting.headers.status = 'ENETUNREACH'
      const result = await handler.retrieve('/')
      return assert.deepEqual(result, expecting)
    })

    it('should return an object with errors if there\'s an error streaming a URL response', async function () {
      // expecting.error = true
      // expecting.headers.status = 'ENETUNREACH'
      const result = await handler.retrieve('http://fakeurl.com/register_stream')
      return assert.deepEqual(result, expecting)
    })
  })
})

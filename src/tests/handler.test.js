/* eslint-env mocha */
const assert = require('chai').assert
const nock = require('nock')
const fs = require('fs')
const register = fs.readFileSync(process.cwd() + '/tests/fixtures/register.csv')

const handler = require('./../handler.js')

// describe('Collector - Handler - getMaster', function () {
//   beforeEach(function () {
//     nock('https://raw.githubusercontent.com')
//       .get('/digital-land/data-schemas/master/brownfield-sites/register.csv')
//       .reply(200, register)
//   })

//   it('should store all rows in the CSV', async function () {
//     const result = await handler.getMaster({})
//     return assert.deepEqual(result, [{ UnprocessedItems: {} }])
//   })
// })

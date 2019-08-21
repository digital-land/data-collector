/* eslint-env mocha */
const assert = require('chai').assert
const helper = require('./../helper.js')

describe('AWS Helper - DynamoDB', () => {
  it('should lock DynamoDB to a specific API version', () => assert.equal(helper.Dynamo.options.apiVersion, '2012-08-10'))
  it('should lock DynamoDB to a specific region', () => assert.equal(helper.Dynamo.options.region, 'eu-west-2'))
})

/*
  S3 doesn't currently provide a way to access options for testing. Below is for the future...
*/
/*
  describe('AWS Helper - S3', () => {
    it('should lock S3 to a specific API version', () => assert.equal(helper.S3.options.apiVersion, '2006-03-01'))
    it('should lock S3 to a specific region', () => assert.equal(helper.S3.options.region, 'eu-west-2'))
  })
*/

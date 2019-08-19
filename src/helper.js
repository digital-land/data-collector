const Dynamo = require('aws-sdk/clients/dynamodb')
const S3 = require('aws-sdk/clients/s3')

exports.Dynamo = new Dynamo.DocumentClient({
  apiVersion: '2012-08-10',
  region: 'eu-west-2'
})

exports.S3 = new S3({
  apiVersion: '2006-03-01',
  region: 'eu-west-2'
})

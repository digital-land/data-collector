const AWS = require('aws-sdk')
AWS.config.update({ region: 'eu-west-2' })
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })

const axios = require('axios')
const crypto = require('crypto')
const csv = require('csv')
const fs = require('fs')

/* TODO: Find a better way to measure time taken for the request to complete */
const performance = require('perf_hooks').performance
axios.interceptors.request.use(config => {
  performance.now()
  return config
})

axios.interceptors.response.use(response => {
  response.elapsed = performance.now()
  return response
})

const actions = {
  getHeader (response, checksum, organisation) {
    const obj = {
      checksum: null,
      body: JSON.stringify({
        datetime: actions.getTodaysDate(),
        elapsed: response.elapsed,
        'request-headers': response.config.headers,
        'response-headers': response.headers,
        status: response.status || 'UNKNOWN_STATUS',
        body: checksum,
        dataset: process.env.dataset,
        organisation: organisation
      })
    }

    obj.checksum = crypto.createHash('sha256').update(obj.body).digest('hex')

    return obj
  },
  getTodaysDate (short = false) {
    const date = (new Date()).toISOString()
    return (short === true) ? date.split('T')[0] : date
  },
  retrieve (url) {
    return axios.get(url, {
      timeout: 10000,
      responseType: 'stream',
      validateStatus () {
        return true // Never throw an error unless there's a problem with Axios or the like
      }
    })
  },
  async getMaster () {
    if (!process.env.dataset) {
      throw new Error('No dataset specified')
    }

    try {
      return await actions.retrieve(`https://raw.githubusercontent.com/digital-land/data-schemas/master/${process.env.dataset}/register.csv`)
        .then(response => {
          return new Promise((resolve, reject) => {
            const promises = []
            response.data.pipe(csv.parse({ delimiter: ',', columns: true }))
              .on('data', item => {
                item.dataset = process.env.dataset
                return promises.push(actions.sendSQSMessage(item))
              })
              .on('end', () => {
                return Promise.all(promises)
              })
              .on('error', error => {
                throw new Error('Error in piping =>', error)
              })
          })
        })
    } catch (error) {
      return console.error('Error in getMaster =>', error)
    }
  },
  async getSingular (stream) {
    const record = stream.Records.find(record => {
      return (record !== undefined)
    })

    if (!record) {
      throw new Error('No record available from stream =>', stream)
    }

    // Renormalise the body into JSON
    record.body = record.body ? JSON.parse(record.body) : null

    try {
      return await actions.retrieve(record.body['register-url'])
        .then(response => {
          const promises = []
          const id = crypto.randomBytes(24).toString('hex')
          const pipe = response.data.pipe(fs.createWriteStream(`/tmp/${id}`))

          pipe.on('finish', () => {
            const responseBody = fs.readFileSync(`/tmp/${id}`)
            const responseChecksum = crypto.createHash('sha256').update(responseBody).digest('hex')

            // Upload headers and response to S3
            const headers = actions.getHeader(response, responseChecksum, record.body.organisation)
            promises.push(actions.uploadToS3(`headers/${actions.getTodaysDate(true)}/${headers.checksum}.json`, headers.body))
            promises.push(actions.uploadToS3(`bodies/${responseChecksum}`, responseBody))

            // Delete SQS Message
            promises.push(actions.deleteSQSMessage(record.receiptHandle))

            return fs.unlinkSync(`/tmp/${id}`)
          })
        })
    } catch (error) {
      return console.error('Error in getSingular =>', error)
    }
  },
  sendSQSMessage (record) {
    return sqs.sendMessage({
      MessageBody: JSON.stringify(record),
      QueueUrl: process.env.sqsurl
    }).promise()
  },
  deleteSQSMessage (receipt) {
    return sqs.deleteMessage({
      QueueUrl: process.env.sqsurl,
      ReceiptHandle: receipt
    }).promise()
  },
  uploadToS3 (key, body) {
    return s3.upload({
      Bucket: process.env.bucket,
      Key: key,
      Body: body,
      ACL: 'public-read'
    }).promise()
  }
}

exports.getMaster = actions.getMaster
exports.getSingular = actions.getSingular
exports.actions = actions

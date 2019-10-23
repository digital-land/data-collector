const AWS = require('aws-sdk')
AWS.config.update({ region: 'eu-west-2' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })

const axios = require('axios')
const crypto = require('crypto')
const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const performance = require('perf_hooks').performance

/* Set axios User-Agent */
axios.defaults.headers.common['User-Agent'] = 'Digital Land data collector'

const actions = {
  getTodaysDate (short = false) {
    const date = (new Date()).toISOString()
    return (short === true) ? date.split('T')[0] : date
  },
  retrieve (url, organisation = null, dataset = null) {
    const id = crypto.randomBytes(24).toString('hex')

    return new Promise(function (resolve, reject) {
      const result = {
        headers: {
          checksum: crypto.createHash('sha256').update(url).digest('hex'),
          data: {
            dataset: dataset,
            datetime: actions.getTodaysDate(),
            elapsed: null,
            url: url,
            organisation: organisation,
            'request-headers': null,
            'response-headers': null
          }
        },
        body: {
          checksum: null,
          data: null
        }
      }

      performance.now()

      return axios.get(url, {
        timeout: 10000,
        responseType: 'stream'
      }).then(function (response) {
        const pipe = response.data.pipe(fs.createWriteStream(`/tmp/${id}`))

        pipe.on('finish', function () {
          result.headers.data['request-headers'] = response.config.headers
          result.headers.data['response-headers'] = response.headers
          result.headers.data.status = actions.mapStatus(response.status)
          result.body.data = fs.readFileSync('/tmp/' + id).toString()
          result.body.checksum = crypto.createHash('sha256').update(result.body.data).digest('hex')

          result.headers.data.elapsed = performance.now().toString()

          fs.unlinkSync(`/tmp/${id}`)

          return resolve(result)
        })
      }).catch(function (error) {
        // If there's an error, we don't want to store the body - just the headers
        if (error.response) {
          result.headers.data['request-headers'] = error.response.config.headers
          result.headers.data['response-headers'] = error.response.headers
          result.headers.data.status = actions.mapStatus(error.response.status)
        } else if (error.request) {
          result.headers.data['request-headers'] = error.config.headers
          result.headers.data.status = actions.mapStatus(error.code)
        } else {
          result.headers.data.status = actions.mapStatus(error.message)
        }

        result.headers.data.elapsed = performance.now().toString()

        return resolve(result)
      })
    })
  },
  mapStatus: function (status) {
    if (status === 'ENOTFOUND') {
      status = 404
    } else if (status === 'ECONNABORTED') {
      status = 408
    } else if (status === 'HPE_INVALID_CONSTANT') {
      status = 'PARSE_ERROR'
    } else if (status === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      status = 'TLS_ERROR'
    }
    return status.toString() || 'UNKNOWN_ERROR'
  },
  async sendSQSMessage (record) {
    return sqs.sendMessage({
      MessageBody: JSON.stringify(record),
      QueueUrl: process.env.sqsurl
    }).promise()
  },
  async deleteSQSMessage (receipt, queue = false) {
    return sqs.deleteMessage({
      QueueUrl: queue || process.env.sqsurl,
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
  },
  getDatasets: async function () {
    try {
      const datasets = await actions.retrieve(process.env.datasetsurl)
      const parsed = parse(datasets.body.data, { delimiter: ',', columns: true })

      const promises = []
      for (const row in parsed) {
        promises.push(actions.sendSQSMessage(parsed[row]))
      }

      return Promise.all(promises)
    } catch (error) {
      return console.error('Error in getDatasets =>', error)
    }
  },
  async getMaster (stream) {
    const record = stream.Records.find(function (record) {
      return (record !== undefined)
    })

    if (!record) {
      throw new Error('No record available from stream =>', stream)
    }

    record.body = record.body ? JSON.parse(record.body) : null

    try {
      if (!record.body['dataset']) {
        throw new Error('No dataset present =>', record)
      }

      let dataset = record.body['dataset']

      // Wrong in CSV
      dataset = 'brownfield-sites'

      const register = await actions.retrieve(`https://raw.githubusercontent.com/digital-land/${dataset}-collection/master/datasets/brownfield-land.csv`)

      const parsed = parse(register.body.data, { delimiter: ',', columns: true }).map(function (row) {
        row.dataset = dataset
        return row
      }).filter(function (row) {
        return row['resource-url']
      })

      const promises = []
      for (const row in parsed) {
        promises.push(actions.sendSQSMessage(parsed[row]))
      }

      promises.push(actions.deleteSQSMessage(record.receiptHandle, process.env.dataset_sqs_url))

      return Promise.all(promises)
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
      if (!record.body['resource-url']) {
        return console.log('No URL present for ' + record.body['organisation'])
      }

      const promises = []
      const register = await actions.retrieve(record.body['resource-url'], record.body['organisation'], record.body['dataset'])

      promises.push(actions.uploadToS3(`headers/test/${actions.getTodaysDate(true)}/${register.headers.checksum}.json`, JSON.stringify(register.headers.data)))

      if (register.body.checksum && register.body.data) {
        promises.push(actions.uploadToS3(`bodies/test/${register.body.checksum}`, register.body.data))
      }

      promises.push(actions.deleteSQSMessage(record.receiptHandle))

      return Promise.all(promises)
    } catch (error) {
      return console.error('Error in getSingular =>', error)
    }
  }
}

exports.getMaster = actions.getMaster
exports.getSingular = actions.getSingular
exports.getDatasets = actions.getDatasets
exports.actions = actions

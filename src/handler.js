const AWS = require('./helper.js')
const axios = require('axios')
const crypto = require('crypto')
const csv = require('csvtojson')
const fs = require('fs')

const tableParams = {
  TableName: 'DataCollector'
}

const actions = {
  async checkIfFilesExist (key) {
    return AWS.S3.headObject({
      Bucket: 'digital-land-data-collector',
      Key: key
    }).promise().then(() => true).catch(() => false)
  },
  generateRandomId () {
    return crypto.randomBytes(24).toString('hex')
  },
  getTodaysDate () {
    return new Date().toISOString().split('T')[0]
  },
  mapPutRequests (item) {
    return {
      PutRequest: {
        Item: {
          organisation: (item.organisation) ? (`${item.organisation.toString()}:${process.env.type}`) : null,
          date: actions.getTodaysDate(),
          'register-url': item['register-url'] || null,
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
  },
  mapStatus (status) {
    if (status === 'ENOTFOUND') {
      return 404
    } else if (status === 'ECONNABORTED') {
      return 408
    } else if (status === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return 'TLS_ERROR'
    } else if (status === 'HPE_INVALID_CONSTANT') {
      return 'PARSE_ERROR'
    }
    return status || 'UNKNOWN_ERROR'
  },
  retrieve (url) {
    const obj = {
      response: null,
      error: false,
      headers: {
        raw: null,
        status: null,
        mime: null
      }
    }

    return axios.get(url, {
      timeout: 5000,
      responseType: 'stream',
      validateStatus () {
        return true // Never throw an error unless there is an error with the request, or Axios
      }
    }).then(response => new Promise((resolve, reject) => {
      const id = actions.generateRandomId()
      const pipe = response.data.pipe(fs.createWriteStream(`/tmp/${id}`))

      pipe.on('finish', () => {
        obj.response = fs.readFileSync(`/tmp/${id}`)
        obj.headers.raw = response.headers
        obj.headers.status = response.status
        fs.unlinkSync(`/tmp/${id}`)
        resolve(obj)
      })
      pipe.on('error', () => {
        obj.error = 'PIPE_ERROR'
        reject(obj)
      })
    })).catch(error => {
      obj.error = true
      obj.response = 'An error occurred, and there was no response.'

      if (error.response) {
        obj.response = error.response.data
        obj.headers.raw = error.response.headers
        obj.headers.status = error.response.status
      } else if (error.request) {
        obj.headers.status = actions.mapStatus(error.code)
      } else {
        obj.headers.status = actions.mapStatus(error.message)
      }

      return obj
    })
  }
}

exports.getMaster = async () => {
  const promises = []
  const params = {
    RequestItems: {}
  }

  if (!process.env.type) {
    throw new Error('getMaster => no type set')
  }

  try {
    const master = await actions.retrieve(`https://raw.githubusercontent.com/digital-land/data-schemas/master/${process.env.type}/register.csv`)
    const json = await csv().fromString(master.response.toString())

    while (json.length) {
      const chunk = Object.assign({}, params)
      chunk.RequestItems[tableParams.TableName] = json.splice(0, 25).map(actions.mapPutRequests)
      promises.push(AWS.Dynamo.batchWrite(chunk).promise())
    }

    return Promise.all(promises)
  } catch (error) {
    throw new Error('getMaster error => ' + JSON.stringify(error, null, 4))
  }
}

exports.getSingular = async stream => {
  const promises = []
  const found = stream.Records.find(item => item.eventName === 'INSERT')

  if (found && found.dynamodb.NewImage['register-url'] && found.dynamodb.NewImage['register-url'].S) {
    const response = await actions.retrieve(found.dynamodb.NewImage['register-url'].S)

    // Uplaod header file
    const headerString = JSON.stringify(response.headers)
    const headerHash = crypto.createHash('sha256').update(headerString).digest('hex')
    const headerKey = `headers/${actions.getTodaysDate()}/${headerHash}.json`

    const headers = AWS.S3.putObject({
      Key: headerKey,
      Body: headerString,
      Bucket: 'digital-land-data-collector'
    }).promise()

    promises.push(headers)

    // Upload bodies
    const bodiesHash = crypto.createHash('sha256').update(response.response).digest('hex')
    const bodyKey = `bodies/${bodiesHash}`
    const bodyExists = await actions.checkIfFilesExist(bodyKey)

    if (!bodyExists) {
      const body = {
        Key: bodyKey,
        Body: response.response,
        Bucket: 'digital-land-data-collector'
      }

      promises.push(AWS.S3.putObject(body).promise())
    }

    // Update DynamoDB record
    const dynamoParams = Object.assign(tableParams, {})
    dynamoParams.Key = {
      date: actions.getTodaysDate(),
      organisation: found.dynamodb.NewImage.organisation.S
    }
    dynamoParams.UpdateExpression = 'set #ref = :ref'
    dynamoParams.ExpressionAttributeValues = {
      ':ref': {
        headers: headerKey,
        validation: null,
        response: {
          original: bodyKey,
          fixed: null
        }
      }
    }
    dynamoParams.ExpressionAttributeNames = {
      '#ref': 'references'
    }

    promises.push(AWS.Dynamo.update(dynamoParams).promise())
  }

  return Promise.all(promises)
}

exports.actions = actions

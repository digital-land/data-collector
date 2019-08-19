const AWS = require('./helper.js')
const axios = require('axios')
const crypto = require('crypto')
const csv = require('csvtojson')
const fs = require('fs')
const mmm = require('mmmagic')
const Magic = mmm.Magic

const tableParams = {
  TableName: 'DataCollector'
}

const actions = {
  getTodaysDate () {
    return new Date().toISOString().split('T')[0]
  },
  async checkIfFilesExist (key) {
    return AWS.S3.headObject({
      Bucket: 'DataCollector',
      Key: key
    }).promise().then(() => true).catch(() => false)
  },
  generateRandomId () {
    return crypto.randomBytes(24).toString('hex')
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
    return null
  },
  async detectMime (file) {
    const magic = new Magic(mmm.MAGIC_MIME_TYPE)
    return new Promise((resolve, reject) => {
      magic.detect(file, (error, result) => {
        if (error) {
          return reject(error)
        }
        return resolve(result)
      })
    })
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
        return true // Never throw an error unless a status code isn't returned
      }
    }).then(response => new Promise((resolve, reject) => {
      const id = actions.generateRandomId()
      const pipe = response.data.pipe(fs.createWriteStream(`./tmp/${id}`))
      pipe.on('finish', async () => {
        const file = fs.readFileSync(`./tmp/${id}`)
        obj.response = file
        obj.headers.raw = response.headers
        obj.headers.status = response.status
        obj.headers.mime = await actions.detectMime(file)
        resolve(obj)
      })
      pipe.on('error', () => {
        obj.error = 'PIPE_ERROR'
        reject(obj)
      })
    })).catch(error => {
      obj.error = true
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

exports.getMaster = async request => {
  request.url = 'https://raw.githubusercontent.com/digital-land/data-schemas/master/brownfield-sites/register.csv'
  request.type = 'brownfield-sites'

  const promises = []
  const params = {
    RequestItems: {}
  }
  const master = await actions.retrieve(request.url)
  const json = await csv().fromString(master.response.toString())

  while (json.length) {
    const chunk = Object.assign({}, params)

    chunk.RequestItems[tableParams.TableName] = json.splice(0, 25).map(item => ({
      PutRequest: {
        Item: {
          organisation: (item.organisation) ? (`${item.organisation.toString()}:${request.type}`) : null,
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
    }))

    promises.push(AWS.Dynamo.batchWrite(chunk).promise())
  }

  return Promise.all(promises)
}

exports.getSingular = async stream => {
  const promises = []
  const found = stream.Records.find(item => item.eventName === 'INSERT')

  if (found && found.dynamodb.NewImage['register-url']) {
    const response = await actions.retrieve(found.dynamodb.NewImage['register-url'])

    // Uplaod header file
    const headerString = JSON.stringify(response.headers)
    const headerHash = crypto.createHash('sha256').update(headerString).digest('hex')
    const headerKey = `headers/${actions.getTodaysDate()}/${headerHash}.json`

    const headers = AWS.S3.putObject({
      Key: headerKey,
      Body: headerString
    }).promise()

    promises.push(headers)

    // Upload bodies
    const bodiesHash = crypto.createHash('sha256').update(response.response).digest('hex')
    const bodyKey = `bodies/${bodiesHash}`
    const bodyExists = await actions.checkIfFilesExist(bodyKey)

    if (!bodyExists) {
      const body = {
        Key: bodyKey,
        Body: response.response
      }

      promises.push(AWS.S3.putObject(body).promise())
    }

    // Update DynamoDB record
    const dynamoParams = Object.assign(tableParams, {})
    dynamoParams.Key = {
      date: actions.getTodaysDate(),
      organisation: `${found.dynamodb.NewImage['organisation'].S}:brownfield-sites`
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

const serverless = require('serverless-http')
const app = require('../../server/src/index')
module.exports.handler = serverless(app)
const serverless = require('serverless-http')

// If the Express app throws while loading (missing env var, bad config), a plain Lambda crash
// shows up in the browser as an empty 502. Catch it, log it, and answer with a readable JSON
// error instead. Set DEBUG_API=true in Netlify to include the message in the response;
// leave it off once things work so nothing internal is exposed.
let handler
let loadError
try {
  // Without `binary`, serverless-http returns image/audio bytes as a UTF-8 string, which corrupts
  // every uploaded picture. These types are base64-encoded for Lambda and decoded by Netlify.
  handler = serverless(require('../../server/src/index'), {
    binary: ['image/*', 'audio/*', 'application/octet-stream', 'application/pdf'],
  })
} catch (e) {
  loadError = e
  console.error('API failed to start:', e)
}

module.exports.handler = async (event, context) => {
  if (loadError) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'API failed to start',
        ...(process.env.DEBUG_API === 'true' && { detail: String(loadError.message) }),
      }),
    }
  }
  return handler(event, context)
}

// True on a real deployment. Netlify/AWS Lambda do not set NODE_ENV for you, so a missing
// NODE_ENV must not silently turn the production safety checks off.
module.exports = {
  isProduction: process.env.NODE_ENV === 'production'
    || Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME),
};

'use strict'

const camelToKebab = require('./camel-to-kebab')

/**
 * @param {object} object - key/value pairs to turn into HTTP headers
 * @returns {object} - HTTP headers
 **/
module.exports = (object) => {
  const output = {}

  Object.keys(object).forEach(key => {
    output[camelToKebab(key)] = object[key]
  })

  return output
}

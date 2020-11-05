'use strict'

const camelToKebab = require('./camel-to-kebab')

/**
 * @param {object} object
 * @returns {object}
 **/
module.exports = (object) => {
  const output = {}

  Object.keys(object).forEach(key => {
    output[camelToKebab(key)] = object[key]
  })

  return output
}

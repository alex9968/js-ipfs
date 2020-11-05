'use strict'

/**
 * @param {string} string
 * @returns {string}
 **/
module.exports = function camelToKebab (string) {
  return string.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

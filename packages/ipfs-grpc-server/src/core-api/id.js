'use strict'

module.exports = function grpcId (ipfs, options = {}) {
  function id (metadata) {
    const opts = {
      ...metadata
    }

    return ipfs.id(opts)
  }

  return id
}

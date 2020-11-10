'use strict'

const { grpc } = require('@improbable-eng/grpc-web')
const transport = require('./grpc/transport')
const toUri = require('multiaddr-to-uri')

grpc.setDefaultTransport(transport())

module.exports = function createClient (opts = {}) {
  opts = opts || {}

  opts.url = toUri(opts.url.replace(/\/ws$/, ''))

  const client = {
    addAll: require('./core-api/add-all')(grpc, opts),
    id: require('./core-api/id')(grpc, opts)
  }

  return client
}

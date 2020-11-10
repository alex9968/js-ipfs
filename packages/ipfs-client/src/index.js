'use strict'

const httpClient = require('ipfs-http-client')
const grpcClient = require('ipfs-grpc-client')
const toUri = require('multiaddr-to-uri')
const debug = require('debug')('ipfs:client')

module.exports = async function createClient (opts = {}) {
  opts = opts || {}

  debug('ws', opts.grpc)
  debug('ht', opts.http)

  opts.grpc = toUri(opts.grpc.replace(/\/ws$/, ''))
  opts.http = toUri(opts.http)

  debug('ws', opts.grpc)
  debug('ht', opts.http)

  const http = httpClient({
    ...opts,
    url: opts.http
  })

  const grpc = grpcClient({
    ...opts,
    url: opts.grpc
  })

  try {
    // call a cheap method to see if gRPC is supported
    await grpc.id()

    // override supported methods, everything else falls back to HTTP
    return {
      ...http,
      ...grpc
    }
  } catch (err) {
    debug(err)
  }

  return http
}

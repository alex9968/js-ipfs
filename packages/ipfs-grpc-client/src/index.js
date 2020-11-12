'use strict'

const { grpc } = require('@improbable-eng/grpc-web')
const transport = require('./grpc/transport')
const multiaddr = require('multiaddr')
const multiAddrToUri = require('multiaddr-to-uri')

grpc.setDefaultTransport(transport())

const protocols = {
  'ws://': 'http://',
  'wss://': 'https://'
}

function normaliseUrl (url) {
  if (multiaddr.isMultiaddr(url)) {
    url = multiAddrToUri(url)
  }

  url = url.toString()

  Object.keys(protocols).forEach(protocol => {
    if (url.startsWith(protocol)) {
      url = protocols[protocol] + url.substring(protocol.length)
    }
  })

  return url
}

module.exports = function createClient (opts = {}) {
  opts = opts || {}
  opts.url = normaliseUrl(opts.url)

  const client = {
    addAll: require('./core-api/add-all')(grpc, opts),
    id: require('./core-api/id')(grpc, opts)
  }

  return client
}

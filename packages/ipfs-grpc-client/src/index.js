
const { grpc } = require('@improbable-eng/grpc-web')
const transport = require('./grpc/transport')
const pushable = require('it-pushable')
const httpClient = require('ipfs-http-client')
const toUri = require('multiaddr-to-uri')

grpc.setDefaultTransport(transport())

const toIterator = (client) => {
  const queue = pushable()

  client.onMessage(message => {
    queue.push(message.toObject())
  })
  client.onEnd((status, message, trailers) => {
    queue.end(status ? new Error(message) : undefined)
  })

  return queue
}

module.exports = function createClient (opts = {}) {
  opts = opts || {}

  console.info('ws', opts.url)
  console.info('ht', opts.httpFallback)

  opts.url = toUri(opts.url.replace(/\/ws$/, ''))
  opts.httpFallback = toUri(opts.httpFallback)

  console.info('ws', opts.url)
  console.info('ht', opts.httpFallback)

  const client = httpClient({
    ...opts,
    url: opts.httpFallback
  })

  // override streaming methods, everything else falls back to HTTP
  client.addAll = require('./core-api/add-all')(grpc, opts)

  return client
}

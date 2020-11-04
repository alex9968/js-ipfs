
const { grpc } = require('@improbable-eng/grpc-web')
const transport = require('./grpc/transport')
const pushable = require('it-pushable')

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

  return {
    addAll: require('./core-api/add-all')(grpc, opts)
  }
}

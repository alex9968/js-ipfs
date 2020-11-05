'use strict'

const pushable = require('it-pushable')
const errCode = require('err-code')

module.exports = function toIterator (client) {
  const queue = pushable()

  client.onMessage(message => {
    queue.push(message.toObject())
  })
  client.onEnd((status, message, trailers) => {
    let err

    if (status) {
      const error = new Error(message)
      err = errCode(error, trailers.get('grpc-code'), {
        stack: trailers.get('grpc-stack') || error.stack,
        status
      })
    }

    queue.end(err)
  })

  return queue
}

'use strict'

const pushable = require('it-pushable')
const { pipe } = require('it-pipe')
const debug = require('debug')('ipfs:grpc-server:add-all')

module.exports = function grpcAdd (ipfs, options = {}) {
  async function add (source, sink, metadata) {
    const opts = {
      ...metadata,
      progress: (bytes = 0, path = '') => {
        sink.push({
          progress: true,
          bytes,
          path
        })
      }
    }

    const streams = []

    try {
      await pipe(
        async function * toInput () {
          for await (const { index, type, path, mode, mtime, mtime_nsecs: mtimeNsecs, content } of source) {
            debug(index, type, path, mode, mtime, mtimeNsecs)
            let mtimeObj

            if (mtime !== 0) {
              mtimeObj = {
                secs: mtime,
                nsecs: undefined
              }

              if (mtimeNsecs !== 0) {
                mtimeObj.nsecs = mtimeNsecs
              }
            }

            if (type === 'DIRECTORY') {
              // directory
              yield {
                path,
                mode: mode !== 0 ? mode : undefined,
                mtime: mtimeObj
              }

              continue
            }

            let stream = streams[index]

            if (!stream) {
              // start of new file
              // @ts-ignore
              stream = streams[index] = pushable()

              debug('yielding file')
              yield {
                path,
                mode: mode !== 0 ? mode : undefined,
                mtime: mtimeObj,
                content: stream
              }
            }

            if (content.length) {
              // file is in progress
              debug('file in progress')
              stream.push(content)
            } else {
              // file is finished
              debug('file ended')
              stream.end()

              streams[index] = null
            }
          }
        },
        async function (source) {
          for await (const result of ipfs.addAll(source, opts)) {
            result.cid = result.cid.toString()

            if (!result.mtime) {
              delete result.mtime
            } else {
              result.mtime_nsecs = result.mtime.nsecs
              result.mtime = result.mtime.secs
            }

            debug('sending', result)
            sink.push(result)
          }

          sink.end()
        }
      )
    } finally {
      // clean up any open streams
      streams.filter(Boolean).forEach(stream => stream.end())
    }
  }

  return add
}

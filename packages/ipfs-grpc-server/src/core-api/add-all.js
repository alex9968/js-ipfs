'use strict'

const pushable = require('it-pushable')
const pipe = require('it-pipe')

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
          for await (const { index, type, path, mode, mtime, mtime_nsecs, content } of source) {
            console.info(index, type, path, mode, mtime, mtime_nsecs)
            let mtimeObj = undefined

            if (mtime !== 0) {
              mtimeObj = {
                secs: mtime
              }

              if (mtime_nsecs !== 0) {
                mtimeObj.nsecs = mtime_nsecs
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
              stream = streams[index] = pushable()

              console.info('yielding file')
              yield {
                path,
                mode: mode !== 0 ? mode : undefined,
                mtime: mtimeObj,
                content: stream
              }
            }

            if (content.length) {
              // file is in progress
              console.info('file in progress')
              stream.push(content)
            } else {
              // file is finished
              console.info('file ended')
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

            console.info('sending', result)
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

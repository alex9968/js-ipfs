'use strict'

const { AddRequest, FileType } = require('ipfs-grpc-protocol/dist/root_pb')
const { Root } = require('ipfs-grpc-protocol/dist/root_pb_service')
const normaliseInput = require('ipfs-core-utils/src/files/normalise-input')
const CID = require('cids')
const toIterator = require('../utils/client-to-iterable')
const withTimeoutOption = require('ipfs-core-utils/src/with-timeout-option')

module.exports = function grpcAddAll (grpc, opts = {}) {
  opts = opts || {}

  /**
   * @type {import('.').Implements<import('ipfs-core/src/components/add-all/index')>}
   */
  async function * addAll (source, options = {}) {
    let error

    const client = grpc.client(Root.addAll, {
      host: opts.url
    })

    client.start(options)

    setTimeout(async () => {
      try {
        let i = 0

        for await (const { path, content, mode, mtime } of normaliseInput(source)) {
          const index = i
          i++

          if (content) {
            // file
            for await (const buf of content) {
              const message = new AddRequest()
              message.setIndex(index)
              message.setType(FileType.FILE)
              message.setPath(path)
              message.setMode(mode)

              if (mtime && mtime.secs != null) {
                message.setMtime(mtime.secs)

                if (mtime.nsecs != null) {
                  message.setMtimeNsecs(mtime.nsecs)
                }
              }

              message.setContent(new Uint8Array(buf, buf.byteOffset, buf.byteLength))

              console.info('send file data')
              client.send(message)
            }

            // signal that the file data has finished
            const message = new AddRequest()
            message.setIndex(index)
            message.setType(FileType.FILE)
            message.setPath(path)

            console.info('send file end')
            client.send(message)

            continue
          } else {
            const message = new AddRequest()
            message.setIndex(index)
            message.setType(FileType.DIRECTORY)
            message.setPath(path)

            if (mtime && mtime.secs != null) {
              message.setMtime(mtime.secs)

              if (mtime.nsecs != null) {
                message.setMtimeNsecs(mtime.nsecs)
              }
            }

            console.info('send dir', index, path)
            client.send(message)
          }
        }
      } catch (err) {
        error = err
      } finally {
        client.finishSend()
      }
    }, 0)

    for await (const result of toIterator(client)) {
      // received progress result
      if (result.progress) {
        if (options.progress) {
          options.progress(result.bytes, result.path)
        }

        continue
      }

      // received file/dir import result
      yield {
        path: result.path,
        cid: new CID(result.cid),
        mode: result.mode,
        mtime: {
          secs: result.mtime,
          nsecs: result.mtimeNsecs
        },
        size: result.size
      }
    }

    if (error) {
      throw error
    }
  }

  return withTimeoutOption(addAll)
}


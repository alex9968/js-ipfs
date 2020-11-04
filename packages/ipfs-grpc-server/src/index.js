
const { Server: WebSocketServer } = require('ws')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const debug = require('debug')('ipfs:grpc-server')
const pushable = require('it-pushable')
const EventEmitter = require('events').EventEmitter
const { BufferList } = require('bl')

const packageDefinition = protoLoader.loadSync(
  require.resolve('ipfs-grpc-protocol/src/root.proto'), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  }
)

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)
const ipfsProto = protoDescriptor.ipfs

const WebsocketSignal = {
  FINISH_SEND: 1
}

const HEADER_SIZE = 5

function sendMessage (ws, handler, message) {
  const response = handler.serialize(message)

  const header = new DataView(new ArrayBuffer(HEADER_SIZE))
  header.setUint32(1, response.byteLength)

  ws.send(
    Buffer.concat([
      new Uint8Array(header.buffer, header.byteOffset, header.byteLength),
      response
    ], header.byteLength + response.byteLength)
  )
}

function sendTrailer (ws, err) {
  const trailers = {
    'grpc-status': err ? 1 : 0,
    'grpc-message': err ? err.message : undefined,
    'grpc-stack': err ? err.stack : undefined,
    'grpc-code': err ? err.code : undefined
  }
  const trailerBuffer = Buffer.from(
    Object.entries(trailers)
      .filter(([key, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n')
  )

  const trailer = new DataView(new ArrayBuffer(HEADER_SIZE))
  trailer.setUint8(0, 0x80)
  trailer.setUint32(1, trailerBuffer.byteLength)

  ws.send(
    Buffer.concat([
      new Uint8Array(trailer.buffer, trailer.byteOffset, trailer.byteLength),
      trailerBuffer
    ], trailer.byteLength + trailerBuffer.byteLength)
  )
}

class GRPCMessages extends EventEmitter {
  constructor (ws, handler) {
    super()

    this._buffer = new BufferList()

    this.source = pushable()
    this.sink = pushable()

    ws.on('message', function onSocketMessage (data) {
      this._buffer.append(data)
      this._readMessage()
    })

    ws.once('end', function onSocketEnd () {
      console.info('socket ended')
      this.source.end()
      this.sink.end()
    })
  }

  _readMessage () {
    if (this._buffer.length === 1 && this._buffer.get(0) === WebsocketSignal.FINISH_SEND) {
      console.info('received end message')
      this.source.end()

      return
    }

    if (this._buffer.length >= HEADER_SIZE) {
      console.info('reading header')

      const header = this._buffer.shallowSlice(1, HEADER_SIZE - 1)
      const length = header.readInt32BE()

      console.info('message was', length, 'bytes long')

      if (this._buffer.length >= HEADER_SIZE + length) {
        this._buffer.consume(HEADER_SIZE)

        const message = this._buffer.shallowSlice(0, length)
        source.push(handler.deserialize(message))
        this._buffer.consume(length)

        this._readMessage()
      }
    }
  }
}

module.exports = async function createServer (ipfs, options = {}) {
  options = options || {}

  const config = await ipfs.config.getAll()
  const grpcAddr = config.Addresses.RPC
  const [ ,, host, , port] = grpcAddr.split('/')

  const server = new grpc.Server()
  server.addService(ipfsProto.Root.service, {
    addAll: require('./core-api/add-all')(ipfs, options)
  })

  debug(`starting ws server on ${host}:${port}`)

  const wss = new WebSocketServer({ host, port })

  wss.on('connection', function connection (ws, request) {
    ws.on('error', error => console.error(`WebSocket Error: ${error.message}`))

    ws.once('message', async function incoming (buf) {
      console.log('req', buf.toString('utf8'))

      const headers = buf.toString('utf8')
        .trim()
        .split('\r\n')
        .map(s => s.split(':'))
        .reduce((acc, curr) => {
          acc[curr[0].trim()] = curr[1].trim()

          return acc
        }, {})

      delete headers['content-type']
      delete headers['x-grpc-web']

      const handler = server.handlers.get(request.url)

      console.info('url', request.url)

      if (!handler) {
        sendTrailer(ws, new Error(`Request path ${request.url} unimplemented`))
        ws.close()
        return
      }

      // send headers
      ws.send(Buffer.from([]))

      switch (handler.type) {
        case 'bidi':
          const source = pushable()
          const sink = pushable()

          ws.on('message', function onSocketMessage (data) {
            if (data.length === 1 && data[0] === WebsocketSignal.FINISH_SEND) {
              source.end()
            } else {
              console.info(data)
              source.push(handler.deserialize(data))
            }
          })

          ws.once('end', function onSocketEnd () {
            console.info('socket ended')
            source.end()
            sink.end()
          })

          handler.func(source, sink, headers)
            .catch(err => {
              sendTrailer(ws, err)
              ws.close()
            })

          for await (const output of sink) {
            sendMessage(ws, handler, output)
          }

          sink.end()
          sendTrailer(ws)
          ws.close()
        break
        default:
          console.warn(`Invalid handler type ${handler.type}`)
          ws.close()
          return
      }
    })
  })

  wss.on('error', error => console.error(`WebSocket Server Error: ${error.message}`))

  return new Promise((resolve) => {
    wss.on('listening', () => {
      resolve({
        stop: () => {
          return new Promise((resolve) => {
            wss.close(() => resolve())
          })
        }
      })
    })
  })
}


const { Server: WebSocketServer } = require('ws')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const debug = require('debug')('ipfs:grpc-server')
const pushable = require('it-pushable')
const EventEmitter = require('events').EventEmitter
const fromHeaders = require('./utils/from-headers')

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
  START_SEND: 0,
  FINISH_SEND: 1
}

const HEADER_SIZE = 5
const TRAILER_BYTES = 128

class GRPCWebsocketMessages extends EventEmitter {
  constructor (ws, handler) {
    super()

    this._ws = ws
    this._handler = handler

    this.source = pushable()
    this.sink = pushable()

    ws.on('message', (data) => {
      const flag = data[0]

      if (flag === WebsocketSignal.FINISH_SEND) {
        console.info('received finish send message')
        this.source.end()

        return
      }

      let offset = 1

      const header = data.slice(offset, HEADER_SIZE + offset)
      const length = header.readInt32BE(1, 4)
      offset += HEADER_SIZE
      const message = data.slice(offset, offset + length)

      if ((header.readUInt8(0) & TRAILER_BYTES) === TRAILER_BYTES) {
        console.info('trailer', message)
      } else {
        console.info('message', message)
        this.source.push(this._handler.deserialize(message))
      }
    })

    ws.once('end', () => {
      console.info('socket ended')
      this.source.end()
      this.sink.end()
    })
  }

  sendMessage (message) {
    const response = this._handler.serialize(message)

    const header = new DataView(new ArrayBuffer(HEADER_SIZE))
    header.setUint32(1, response.byteLength)

    this._ws.send(
      Buffer.concat([
        new Uint8Array(header.buffer, header.byteOffset, header.byteLength),
        response
      ], header.byteLength + response.byteLength)
    )

    this.sendTrailer()
  }

  sendTrailer (err) {
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

    this._ws.send(
      Buffer.concat([
        new Uint8Array(trailer.buffer, trailer.byteOffset, trailer.byteLength),
        trailerBuffer
      ], trailer.byteLength + trailerBuffer.byteLength)
    )
  }

  end () {
    this.source.end()
    this.sink.end()
    this._ws.close()
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
      const messages = new GRPCWebsocketMessages(ws, handler)

      console.info('url', request.url)
      console.info('headers', headers)

      if (!handler) {
        messages.sendTrailer(new Error(`Request path ${request.url} unimplemented`))
        messages.end()
        return
      }

      // send headers
      ws.send(Buffer.from([]))

      switch (handler.type) {
        case 'bidi':
          handler.func(messages.source, messages.sink, fromHeaders(headers))
            .catch(err => {
              messages.sendTrailer(err)
              messages.end()
            })

          for await (const output of messages.sink) {
            messages.sendMessage(output)
          }

          messages.end()
        break
        default:
          console.warn(`Invalid handler type ${handler.type}`)
          messages.end()
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
        },
        multiaddr: `/ip4/${wss.address().address}/tcp/${wss.address().port}/ws`
      })
    })
  })
}

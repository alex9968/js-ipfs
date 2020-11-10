/* eslint-env mocha, browser */
'use strict'

const tests = require('interface-ipfs-core')
const createClient = require('../src')

describe('interface-ipfs-core tests', () => {
  const factory = {
    spawn () {
      return {
        api: createClient({
          url: process.env.GRPC_SERVER,
          httpFallback: process.env.HTTP_SERVER
        })
      }
    },
    clean () {}
  }

  tests.root(factory, {
    skip: [
      {
        name: 'add',
        reason: 'not implemented'
      },
      {
        name: 'should add with only-hash=true',
        reason: 'ipfs.object.get is not implemented'
      },
      {
        name: 'should add a directory with only-hash=true',
        reason: 'ipfs.object.get is not implemented'
      },
      {
        name: 'should add with mtime as hrtime',
        reason: 'process.hrtime is not a function in browser'
      },
      {
        name: 'should add from a URL with only-hash=true',
        reason: 'ipfs.object.get is not implemented'
      },
      {
        name: 'should cat with a Uint8Array multihash',
        reason: 'Passing CID as Uint8Array is not supported'
      },
      {
        name: 'should add from a HTTP URL',
        reason: 'https://github.com/ipfs/js-ipfs/issues/3195'
      },
      {
        name: 'should add from a HTTP URL with redirection',
        reason: 'https://github.com/ipfs/js-ipfs/issues/3195'
      },
      {
        name: 'should add from a URL with only-hash=true',
        reason: 'https://github.com/ipfs/js-ipfs/issues/3195'
      },
      {
        name: 'should add from a URL with wrap-with-directory=true',
        reason: 'https://github.com/ipfs/js-ipfs/issues/3195'
      },
      {
        name: 'should add from a URL with wrap-with-directory=true and URL-escaped file name',
        reason: 'https://github.com/ipfs/js-ipfs/issues/3195'
      },
      {
        name: 'should not add from an invalid url',
        reason: 'https://github.com/ipfs/js-ipfs/issues/3195'
      },
      {
        name: 'should be able to add dir without sharding',
        reason: 'Cannot spawn IPFS with different args'
      },
      {
        name: 'with sharding',
        reason: 'TODO: allow spawning new daemons with different config'
      },
      {
        name: 'get',
        reason: 'Not implemented'
      },
      {
        name: 'refs',
        reason: 'Not implemented'
      },
      {
        name: 'refsLocal',
        reason: 'Not implemented'
      }
    ]
  })
})

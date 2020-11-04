'use strict'

const { createFactory } = require('ipfsd-ctl')

const factory = createFactory({
  type: 'js',
  ipfsHttpModule: require('../ipfs-http-client'),
  ipfsBin: require.resolve('../ipfs/src/cli.js')
})

module.exports = {
  bundlesize: { maxSize: '81kB' },
  karma: {
    files: [{
      pattern: 'node_modules/interface-ipfs-core/test/fixtures/**/*',
      watched: false,
      served: true,
      included: false
    }],
    browserNoActivityTimeout: 210 * 1000,
    singleRun: true
  },
  hooks: {
    pre: async () => {
      const node = await factory.spawn()

      return {
        env: {
          GRPC_SERVER: 'http://127.0.0.1:6938'// `${node.host}:${node.port}` todo: pull this from config
        }
      }
    },
    post: () => factory.clean()
  }
}

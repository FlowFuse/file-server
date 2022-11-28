const fp = require('fastify-plugin')

module.exports = fp(async function (app, opts, done) {
    app.addHook('preHandler', app.checkAuth)
    await app.register(require('./files'), { prefix: '/v1/files', logLevel: app.config.logging.http })
    await app.register(require('./quota'), { prefix: '/v1/quota', logLevel: app.config.logging.http })
    await app.register(require('./context'), { prefix: '/v1/context', logLevel: app.config.logging.http })
    done()
})

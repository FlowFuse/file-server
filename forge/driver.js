const fp = require('fastify-plugin')
const getDriver = require('./drivers/vfs.js')

module.exports = fp(async function (app, opts) {
    const Driver = require('./drivers/' + app.config.driver.type)
    try {
        app.decorate('_driver', new Driver(app))
        app.decorateRequest('vfs', null)
        app.addHook('onRequest', (req, reply, done) => {
            const teamId = req.params.teamId
            const projectId = req.params.projectId
            req.vfs = getDriver(app, app._driver, teamId, projectId)
            done()
        })
    } catch (err) {
        console.log(err)
    }
})

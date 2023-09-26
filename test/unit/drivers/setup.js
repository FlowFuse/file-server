const fs = require('fs')
const { join, isAbsolute, sep: pathSeparator } = require('path')
const canary = 'ROOT_DIR_CANARY'

function resolvePath (teamId, projectId, path) {
    let resolvedPath
    if (path.startsWith(pathSeparator)) {
        resolvedPath = join(canary, teamId, path)
    } else {
        resolvedPath = join(canary, teamId, projectId, path)
    }
    if (resolvedPath.startsWith(canary)) {
        const array = resolvedPath.split(pathSeparator)
        array.shift()
        resolvedPath = array.join(pathSeparator)
        return resolvedPath
    } else {
        throw Error('Invalid Path')
    }
}

module.exports = async function (config = {}, options = {}) {
    const app = {
        config: { ...config },
        options: { ...options },
        log: {
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {}
        },
        cleanUp: function (teamId, projectId) {
            if (app.config.driver.type !== 's3' && (!app.config.driver.options.root || !app.options.rootPath)) {
                throw new Error('app.config.driver.options.root must be set')
            }
            app._driver.delete(teamId, projectId, 'test1.txt')
            app._driver.delete(teamId, projectId, 'test2.txt')
            app._driver.delete(teamId, projectId, 'test3.txt')
        },
        close: function () {
            app.cleanUp(app.options.teamId, app.options.projectId)
        }
    }
    let rootPath
    if (app.config.driver.type !== 's3') {
        if (!app.config.driver.options.root) {
            throw new Error('app.config.driver.options.root must be set')
        }
        if (!isAbsolute(app.config.driver.options.root)) {
            rootPath = join(app.config.home, app.config.driver.options.root)
        } else {
            rootPath = app.config.driver.options.root
        }
        if (app.config.driver.type === 'localfs') {
            fs.mkdirSync(rootPath, { recursive: true })
        }
    }
    app.options.rootPath = rootPath
    const createDriver = require('../../../forge/drivers/' + app.config.driver.type)
    app._driver = createDriver(app)

    app.options.resolvePath = resolvePath
    app.cleanUp(app.options.teamId, app.options.projectId)
    return app
}

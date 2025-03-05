const fs = require('fs')
const fp = require('fastify-plugin')
const path = require('path')
const YAML = require('yaml')

let config = {}

module.exports = {
    init: (opts) => {
        if (opts.config) {
            // A custom config has been passed in. This means we're running
            // programmatically rather than manually. At this stage, that
            // means its our test framework.
            process.env.NODE_ENV = 'development'
            process.env.FLOWFORGE_HOME = process.cwd()
        } else if (!process.env.FLOWFORGE_HOME) {
            if (process.env.NODE_ENV === 'development') {
                process.env.FLOWFORGE_HOME = path.resolve(__dirname, '..')
            } else {
                process.env.FLOWFORGE_HOME = process.cwd()
                if (fs.existsSync('/opt/flowforge-file-storage')) {
                    process.env.FLOWFORGE_HOME = '/opt/flowforge-file-storage'
                } else {
                    process.env.FLOWFORGE_HOME = process.cwd()
                }
            }
        }

        let ffVersion
        if (process.env.npm_package_version) {
            ffVersion = process.env.npm_package_version
            // npm start
        } else {
            // everything else
            const { version } = require(path.join(module.parent.path, '..', 'package.json'))
            ffVersion = version
        }
        try {
            fs.statSync(path.join(__dirname, '..', '..', '.git'))
            ffVersion += '-git'
        } catch (err) {
            // No git directory
        }

        if (opts.config !== undefined) {
            // Programmatically provided config - eg tests
            config = { ...opts.config }
        } else {
            let configFile = path.join(process.env.FLOWFORGE_HOME, '/etc/flowforge-storage.yml')
            if (fs.existsSync(path.join(process.env.FLOWFORGE_HOME, '/etc/flowforge-storage.local.yml'))) {
                configFile = path.join(process.env.FLOWFORGE_HOME, '/etc/flowforge-storage.local.yml')
            }
            try {
                const configFileContent = fs.readFileSync(configFile, 'utf-8')
                config = YAML.parse(configFileContent)
                config.configFile = configFile
            } catch (err) {
                throw new Error(`Failed to read config file ${configFile}: ${err}`)
            }
        }

        config.version = ffVersion
        config.home = process.env.FLOWFORGE_HOME
        config.port = process.env.PORT || config.port || 3001
        config.host = config.host || 'localhost'

        config.version = ffVersion
        const defaultLogging = {
            level: 'info',
            http: 'warn',
            pretty: process.env.NODE_ENV === 'development'
        }
        config.logging = { ...defaultLogging, ...config.logging }

        return config
    },
    attach: fp(async function (app, opts, next) {
        Object.freeze(config)
        app.decorate('config', config)

        if (process.env.NODE_ENV === 'development') {
            app.log.info('Development mode')
        }
        app.log.info(`FlowFuse File Storage v${config.version}`)
        app.log.info(`FlowFuse File Storage running with NodeJS ${process.version}`)
        app.log.info(`FlowFuse File Storage HOME Directory: ${process.env.FLOWFORGE_HOME}`)
        if (!opts.config) {
            app.log.info(`Config File: ${config.configFile}`)
        }

        next()
    })
}

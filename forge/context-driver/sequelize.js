const { Sequelize, DataTypes } = require('sequelize')
const { getObjectProperty, getItemSize } = require('./quotaTools')
const util = require('@node-red/util').util
const path = require('path')

let sequelize, app

module.exports = {
    init: async function (_app) {
        app = _app
        const dbOptions = {
            dialect: app.config.context.options.type || 'sqlite',
            logging: !!app.config.context.options.logging
        }

        if (dbOptions.dialect === 'sqlite') {
            let filename = app.config.context.options.storage || 'context.db'
            if (filename !== ':memory:') {
                if (!path.isAbsolute(filename)) {
                    filename = path.join(app.config.home, 'var', filename)
                }
                dbOptions.storage = filename
                dbOptions.retry = {
                    match: [
                        /SQLITE_BUSY/
                    ],
                    name: 'query',
                    max: 10
                }
                dbOptions.pool = {
                    maxactive: 1,
                    max: 5,
                    min: 0,
                    idle: 2000
                }
            }
        } else if (dbOptions.dialect === 'postgres') {
            dbOptions.host = app.config.context.options.host || 'postgres'
            dbOptions.port = app.config.context.options.port || 5432
            dbOptions.username = app.config.context.options.username
            dbOptions.password = app.config.context.options.password
            dbOptions.database = app.config.context.options.database || 'ff-context'
        }

        sequelize = new Sequelize(dbOptions)

        app.log.info(`FlowForge File Server Sequelize Context connected to ${dbOptions.dialect} on ${dbOptions.host || dbOptions.storage}`)

        const Context = sequelize.define('Context', {
            project: { type: DataTypes.STRING, allowNull: false, unique: 'context-project-scope-unique' },
            scope: { type: DataTypes.STRING, allowNull: false, unique: 'context-project-scope-unique' },
            values: { type: DataTypes.JSON, allowNull: false }
        })
        await sequelize.sync()
        this.Context = Context
    },
    set: async function (projectId, scope, input) {
        const { path } = parseScope(scope)
        await sequelize.transaction({
            type: Sequelize.Transaction.TYPES.IMMEDIATE
        },
        async (t) => {
            const quotaLimit = app.config?.context?.quota || 0
            // if quota is set, check if we are over quota or will be after this update
            if (quotaLimit > 0) {
                // Difficulties implementing this correctly
                // - The final size of data can only be determined after the data is stored.
                //   This is due to the fact that some keys may be deleted and some may be added
                //   and the size of the data is not the same as the size of the keys.
                // This implementation is not ideal, but it is a good approximation and will
                //   prevent the possibility of runaway storage usage.
                let changeSize = 0
                const { path } = parseScope(scope)
                const row = await this.Context.findOne({
                    attributes: ['values'],
                    where: {
                        project: projectId,
                        scope: path
                    }
                })
                for (const element of input) {
                    const currentItem = row ? getObjectProperty(row.values, element.key) : undefined
                    if (currentItem === undefined && element.value !== undefined) {
                        // this is an addition
                        changeSize += getItemSize(element)
                    } else if (currentItem !== undefined && element.value === undefined) {
                        // this is an deletion
                        changeSize -= getItemSize(currentItem)
                    } else {
                        // this is an update
                        changeSize -= getItemSize(currentItem)
                        changeSize += getItemSize(element)
                    }
                }
                const currentSize = await this.quota(projectId)
                if (currentSize + changeSize > quotaLimit) {
                    const err = new Error('Over Quota')
                    err.code = 'over_quota'
                    err.error = err.message
                    err.limit = quotaLimit
                    throw err
                }
            }
            let existing = await this.Context.findOne({
                where: {
                    project: projectId,
                    scope: path
                },
                lock: t.LOCK.UPDATE,
                transaction: t
            })
            if (!existing) {
                existing = await this.Context.create({
                    project: projectId,
                    scope: path,
                    values: {}
                },
                {
                    transaction: t
                })
            }
            for (const i in input) {
                const path = input[i].key
                const value = input[i].value
                util.setMessageProperty(existing.values, path, value)
            }
            existing.changed('values', true)
            await existing.save({ transaction: t })
        })
    },
    get: async function (projectId, scope, keys) {
        const { path } = parseScope(scope)
        const row = await this.Context.findOne({
            attributes: ['values'],
            where: {
                project: projectId,
                scope: path
            }
        })
        const values = []
        if (row) {
            const data = row.values
            keys.forEach(key => {
                try {
                    const value = util.getObjectProperty(data, key)
                    values.push({
                        key,
                        value
                    })
                } catch (err) {
                    if (err.code === 'INVALID_EXPR') {
                        throw err
                    }
                    values.push({
                        key
                    })
                }
            })
        }
        return values
    },
    keys: async function (projectId, scope) {
        const { path } = parseScope(scope)
        const row = await this.Context.findOne({
            attributes: ['values'],
            where: {
                project: projectId,
                scope: path
            }
        })
        if (row) {
            return Object.keys(row.values)
        } else {
            return []
        }
    },
    delete: async function (projectId, scope) {
        const { path } = parseScope(scope)
        const existing = await this.Context.findOne({
            where: {
                project: projectId,
                scope: path
            }
        })
        if (existing) {
            await existing.destroy()
        }
    },
    clean: async function (projectId, activeIds) {
        activeIds = activeIds || []
        const scopesResults = await this.Context.findAll({
            where: {
                project: projectId
            }
        })
        const scopes = scopesResults.map(s => s.scope)
        if (scopes.includes('global')) {
            scopes.splice(scopes.indexOf('global'), 1)
        }
        if (scopes.length === 0) {
            return
        }
        const keepFlows = []
        const keepNodes = []
        for (const id of activeIds) {
            for (const scope of scopes) {
                if (scope.startsWith(`${id}.flow`)) {
                    keepFlows.push(scope)
                } else if (scope.endsWith(`.nodes.${id}`)) {
                    keepNodes.push(scope)
                }
            }
        }

        for (const scope of scopes) {
            if (keepFlows.includes(scope) || keepNodes.includes(scope)) {
                continue
            } else {
                const r = await this.Context.findOne({
                    where: {
                        project: projectId,
                        scope
                    }
                })
                await r.destroy()
            }
        }
    },
    quota: async function (projectId) {
        const scopesResults = await this.Context.findAll({
            where: {
                project: projectId
            }
        })
        let size = 0
        scopesResults.forEach(scope => {
            const strValues = JSON.stringify(scope.values)
            size += strValues.length
        })
        return size
    }
}

/**
 * Parse a scope string into its parts
 * @param {String} scope the scope to parse, passed in from node-red
 */
function parseScope (scope) {
    let type, path
    let flow = null
    if (scope === 'global') {
        type = 'global'
        path = 'global'
    } else if (scope.indexOf(':') > -1) {
        // node context
        const parts = scope.split(':')
        type = 'node'
        scope = '' + parts[0]
        flow = '' + parts[1]
        path = `${flow}.nodes.${scope}`
    } else {
        // flow context
        type = 'flow'
        path = `${scope}.flow`
    }
    return { type, scope, path, flow }
}

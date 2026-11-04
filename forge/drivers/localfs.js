const fs = require('fs')
const { join, isAbsolute, dirname, sep: pathSeparator, parse } = require('path')

// Team and project ids are hashids / uuids; reject anything that is not
// id-safe so it can never be used to build a path outside its own bucket.
const idPattern = /^[A-Za-z0-9_-]+$/

async function readDirSize (dir) {
    if (!fs.existsSync(dir)) {
        return 0
    }
    const files = fs.readdirSync(dir, { withFileTypes: true })
    const paths = files.map(async file => {
        const path = join(dir, file.name)
        if (file.isDirectory()) return await readDirSize(path)

        if (file.isFile()) {
            const { size } = fs.statSync(path)
            return size
        }
        return 0
    })

    return (await Promise.all(paths)).flat(Infinity).reduce((i, size) => i + size, 0)
}

function cleanError (error, path, op) {
    if (error.code === 'ENOENT') {
        const err = new Error(`ENOENT: no such file or directory, ${op || 'stat'} '${path}'`)
        err.code = error.code
        return err
    } else if (error.code === 'EPERM') {
        const err = new Error(`EPERM: operation not permitted, ${op || 'unlink'} '${path}'`)
        err.code = error.code
        return err
    }
    return error
}

module.exports = function (app) {
    let rootPath
    if (!isAbsolute(app.config.driver.options.root)) {
        rootPath = join(app.config.home, app.config.driver.options?.root)
    } else {
        rootPath = app.config.driver.options.root
    }

    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath, { recursive: true })
    }

    app.log.info(`FlowFuse File Storage localfs root Directory: ${rootPath}`)

    function resolvePath (teamId, projectId, path) {
        // Defence in depth: ids are also validated at the auth layer, but never
        // build a path from an id that is not id-safe.
        if (!idPattern.test(String(teamId)) || !idPattern.test(String(projectId))) {
            const err = new Error('Invalid Path')
            err.code = 'ENOTDIR'
            throw err
        }
        let requested = String(path ?? '')
        if (isAbsolute(requested)) {
            const pp = parse(requested)
            const hasWinDrive = /^[a-zA-Z]:/.test(pp.root)
            if (hasWinDrive) {
                requested = requested.replace(/^[a-zA-Z]:/, '')
            }
        }
        // A rooted path stays scoped to the team root (previous behaviour);
        // anything else to the team/project root.
        const base = requested.startsWith(pathSeparator) ? join(teamId) : join(teamId, projectId)
        const relative = requested.replace(/^[\\/]+/, '')
        const resolvedPath = join(base, relative)
        // join() collapses any '..' segments; confine the result to base so a
        // traversal attempt cannot escape the team/project bucket.
        if (resolvedPath !== base && !resolvedPath.startsWith(base + pathSeparator)) {
            const err = new Error('Invalid Path')
            err.code = 'ENOTDIR'
            throw err
        }
        return resolvedPath
    }

    return {
        get rootPath () {
            return rootPath
        },
        resolvePath,
        async ensureDir (teamId, projectId, path) {
            try {
                resolvePath(teamId, projectId, path)
                return true
            } catch (error) {
                throw cleanError(error, path, 'stat')
            }
        },
        async save (teamId, projectId, path, data) {
            const fullPath = join(rootPath, resolvePath(teamId, projectId, path))
            try {
                fs.mkdirSync(dirname(fullPath), {
                    recursive: true
                })
                fs.writeFileSync(fullPath, data)
            } catch (error) {
                throw cleanError(error, path, 'open')
            }
        },

        async append (teamId, projectId, path, data) {
            const fullPath = join(rootPath, resolvePath(teamId, projectId, path))
            if (fs.existsSync(fullPath)) {
                try {
                    fs.mkdirSync(dirname(fullPath), {
                        recursive: true
                    })
                    fs.appendFileSync(fullPath, data)
                } catch (error) {
                    throw cleanError(error, path, 'open')
                }
            } else {
                await this.save(teamId, projectId, path, data)
            }
        },

        async read (teamId, projectId, path) {
            const fullPath = join(rootPath, resolvePath(teamId, projectId, path))
            try {
                return fs.readFileSync(fullPath)
            } catch (error) {
                throw cleanError(error, path, 'open')
            }
        },

        async delete (teamId, projectId, path) {
            const fullPath = join(rootPath, resolvePath(teamId, projectId, path))
            try {
                fs.rmSync(fullPath)
            } catch (error) {
                throw cleanError(error, path, 'unlink')
            }
        },

        async quota (teamId, projectId) {
            return readDirSize(join(rootPath, teamId, projectId))
        }
    }
}

const { join } = require('path')
const { resolvePath } = require('./resolvePath')

const storage = {}

module.exports = function (app) {
    return {
        get rootPath () {
            return ''
        },
        resolvePath,

        async ensureDir (teamId, projectId, path) {
            try {
                resolvePath(teamId, projectId, path)
                return true
            } catch (error) {
                return false
            }
        },

        async save (teamId, projectId, path, data) {
            storage[resolvePath(teamId, projectId, path)] = data
        },

        async append (teamId, projectId, path, data) {
            if (storage[resolvePath(teamId, projectId, path)]) {
                storage[resolvePath(teamId, projectId, path)] += data
            } else {
                storage[resolvePath(teamId, projectId, path)] = data
            }
        },

        async read (teamId, projectId, path) {
            return storage[resolvePath(teamId, projectId, path)]
        },

        async delete (teamId, projectId, path) {
            delete storage[resolvePath(teamId, projectId, path)]
        },

        async quota (teamId, projectId) {
            let used = 0
            Object.keys(storage).forEach(key => {
                if (key.startsWith(join(teamId, projectId))) {
                    used += storage[key].length
                }
            })
            return used
        }
    }
}

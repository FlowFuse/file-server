const nodePath = require('path')

// Team and project ids are hashids / uuids; reject anything that is not
// id-safe so it can never be used to build a path outside its own bucket.
const idPattern = /^[A-Za-z0-9_-]+$/

function invalidPath () {
    const err = new Error('Invalid Path')
    err.code = 'ENOTDIR'
    return err
}

// Core resolver, parameterised on a path implementation so the containment
// rules can be exercised against both posix and win32 semantics in tests.
function resolvePathWith (pathImpl, teamId, projectId, path) {
    const { join, sep } = pathImpl
    // Defence in depth: ids are also validated at the auth layer, but never
    // build a path from an id that is not id-safe.
    if (!idPattern.test(String(teamId)) || !idPattern.test(String(projectId))) {
        throw invalidPath()
    }
    // A leading separator is stripped so an absolute-looking path is appended to
    // the project bucket rather than escaping it.
    const requested = String(path ?? '').replace(/^[\\/]+/, '')
    const base = join(teamId, projectId)
    const resolvedPath = join(base, requested)
    // join() collapses any '..' segments; confine the result to the project
    // bucket so a traversal attempt cannot escape it.
    if (resolvedPath !== base && !resolvedPath.startsWith(base + sep)) {
        throw invalidPath()
    }
    return resolvedPath
}

// Resolve a client-supplied sub-path to a relative <teamId>/<projectId>/... key
// confined to that bucket. Shared by the localfs, s3 and memory drivers so the
// containment rules stay identical across them.
function resolvePath (teamId, projectId, path) {
    return resolvePathWith(nodePath, teamId, projectId, path)
}

module.exports = { resolvePath, resolvePathWith, idPattern }

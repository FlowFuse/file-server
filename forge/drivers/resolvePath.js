const { join, isAbsolute, sep: pathSeparator } = require('path')

// Team and project ids are hashids / uuids; reject anything that is not
// id-safe so it can never be used to build a path outside its own bucket.
const idPattern = /^[A-Za-z0-9_-]+$/

// Resolve a client-supplied sub-path to a relative <teamId>/<projectId>/... key
// confined to that bucket. Shared by the localfs, s3 and memory drivers so the
// containment rules stay identical across them.
function resolvePath (teamId, projectId, path) {
    // Defence in depth: ids are also validated at the auth layer, but never
    // build a path from an id that is not id-safe.
    if (!idPattern.test(String(teamId)) || !idPattern.test(String(projectId))) {
        const err = new Error('Invalid Path')
        err.code = 'ENOTDIR'
        throw err
    }
    const requested = String(path ?? '')
    // The wildcard route only ever yields a relative sub-path, so absolute,
    // rooted and Windows drive/UNC paths are not valid inputs. Reject them
    // rather than stripping and remapping: the old strip turned c:\x into
    // <team>/<project>/c/x, so c:\x, C:/x and x could map to different or
    // colliding keys depending on the host.
    if (isAbsolute(requested) || /^[\\/]/.test(requested) || /^[a-zA-Z]:/.test(requested)) {
        const err = new Error('Invalid Path')
        err.code = 'ENOTDIR'
        throw err
    }
    const base = join(teamId, projectId)
    const resolvedPath = join(base, requested)
    // join() collapses any '..' segments; confine the result to base so a
    // traversal attempt cannot escape the team/project bucket.
    if (resolvedPath !== base && !resolvedPath.startsWith(base + pathSeparator)) {
        const err = new Error('Invalid Path')
        err.code = 'ENOTDIR'
        throw err
    }
    return resolvedPath
}

module.exports = { resolvePath, idPattern }

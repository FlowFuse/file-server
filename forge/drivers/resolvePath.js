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
    const { join, isAbsolute, sep } = pathImpl
    // Defence in depth: ids are also validated at the auth layer, but never
    // build a path from an id that is not id-safe.
    if (!idPattern.test(String(teamId)) || !idPattern.test(String(projectId))) {
        throw invalidPath()
    }
    const requested = String(path ?? '')
    // The wildcard route only ever yields a relative sub-path, so absolute and
    // rooted paths are not valid inputs; reject them rather than remapping.
    // isAbsolute() already covers the host's own rooted forms (and, on Windows,
    // drive-absolute paths). On Windows also reject a drive-letter prefix, which
    // isAbsolute() misses for the drive-relative form (c:foo). A colon or
    // backslash is an ordinary filename character on posix, so those stay
    // accepted there.
    const onWindows = sep === '\\'
    if (isAbsolute(requested) || (onWindows && /^[a-zA-Z]:/.test(requested))) {
        throw invalidPath()
    }
    const base = join(teamId, projectId)
    const resolvedPath = join(base, requested)
    // join() collapses any '..' segments; confine the result to base so a
    // traversal attempt cannot escape the team/project bucket.
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

const should = require('should')
const { join } = require('path')
const { resolvePath } = require('../../../forge/drivers/resolvePath')

describe('shared resolvePath', function () {
    const teamId = 't1'
    const projectId = 'p1'
    const base = join(teamId, projectId)

    it('maps a relative sub-path into the team/project bucket', function () {
        should(resolvePath(teamId, projectId, join('sub', 'file.txt'))).eql(join(base, 'sub', 'file.txt'))
    })
    it('maps an empty path to the bucket root', function () {
        should(resolvePath(teamId, projectId, '')).eql(base)
    })
    it('rejects a traversal', function () {
        should(() => resolvePath(teamId, projectId, join('..', '..', 'etc', 'passwd'))).throw(/Invalid Path/)
    })
    it('rejects a rooted path', function () {
        should(() => resolvePath(teamId, projectId, '/etc/passwd')).throw(/Invalid Path/)
    })
    it('rejects a backslash-rooted path', function () {
        should(() => resolvePath(teamId, projectId, '\\p2\\secret.txt')).throw(/Invalid Path/)
    })
    it('rejects a Windows drive-letter path', function () {
        should(() => resolvePath(teamId, projectId, 'c:\\test\\doc.txt')).throw(/Invalid Path/)
        should(() => resolvePath(teamId, projectId, 'C:/test/doc.txt')).throw(/Invalid Path/)
    })
    it('rejects an id that is not id-safe', function () {
        should(() => resolvePath('..', projectId, 'file.txt')).throw(/Invalid Path/)
        should(() => resolvePath(teamId, 'a/b', 'file.txt')).throw(/Invalid Path/)
    })
})

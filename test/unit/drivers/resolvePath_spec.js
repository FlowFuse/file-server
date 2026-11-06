const should = require('should')
const { posix, win32 } = require('path')
const { resolvePath, resolvePathWith } = require('../../../forge/drivers/resolvePath')

describe('shared resolvePath', function () {
    const teamId = 't1'
    const projectId = 'p1'

    describe('host-independent rules', function () {
        it('maps a relative sub-path into the team/project bucket', function () {
            should(resolvePath(teamId, projectId, 'sub/file.txt')).startWith(require('path').join(teamId, projectId))
        })
        it('maps an empty path to the bucket root', function () {
            should(resolvePath(teamId, projectId, '')).eql(require('path').join(teamId, projectId))
        })
        it('rejects a traversal', function () {
            should(() => resolvePath(teamId, projectId, '../../etc/passwd')).throw(/Invalid Path/)
        })
        it('rejects a forward-slash rooted path', function () {
            should(() => resolvePath(teamId, projectId, '/etc/passwd')).throw(/Invalid Path/)
        })
        it('rejects an id that is not id-safe', function () {
            should(() => resolvePath('..', projectId, 'file.txt')).throw(/Invalid Path/)
            should(() => resolvePath(teamId, 'a/b', 'file.txt')).throw(/Invalid Path/)
        })
    })

    // The drivers use the host's path module, so the drive-letter / backslash
    // rules only apply on a Windows host. Exercise both flavours directly so the
    // behaviour is covered regardless of which OS the tests run on.
    describe('win32 semantics', function () {
        const resolve = (p) => resolvePathWith(win32, teamId, projectId, p)
        it('maps a relative sub-path into the bucket', function () {
            should(resolve('sub/file.txt')).eql('t1\\p1\\sub\\file.txt')
        })
        it('rejects a traversal', function () {
            should(() => resolve('..\\..\\etc\\passwd')).throw(/Invalid Path/)
        })
        it('rejects a drive-absolute path', function () {
            should(() => resolve('c:\\test\\doc.txt')).throw(/Invalid Path/)
            should(() => resolve('C:/test/doc.txt')).throw(/Invalid Path/)
        })
        it('rejects a drive-relative path', function () {
            should(() => resolve('c:test')).throw(/Invalid Path/)
        })
        it('rejects a backslash-rooted path', function () {
            should(() => resolve('\\p2\\secret.txt')).throw(/Invalid Path/)
        })
    })

    describe('posix semantics', function () {
        const resolve = (p) => resolvePathWith(posix, teamId, projectId, p)
        it('maps a relative sub-path into the bucket', function () {
            should(resolve('sub/file.txt')).eql('t1/p1/sub/file.txt')
        })
        it('rejects a traversal', function () {
            should(() => resolve('../../etc/passwd')).throw(/Invalid Path/)
        })
        it('rejects a rooted path', function () {
            should(() => resolve('/etc/passwd')).throw(/Invalid Path/)
        })
        it('accepts a filename containing a colon', function () {
            // A colon is an ordinary filename character on posix, so it must not
            // be mistaken for a Windows drive letter and rejected.
            should(resolve('a:b.txt')).eql('t1/p1/a:b.txt')
        })
        it('accepts a filename containing a backslash', function () {
            // A backslash is an ordinary filename character on posix.
            should(resolve('a\\b.txt')).eql('t1/p1/a\\b.txt')
        })
    })
})

const should = require('should')
const { posix, win32 } = require('path')
const { resolvePath, resolvePathWith } = require('../../../forge/drivers/resolvePath')

describe('shared resolvePath', function () {
    const teamId = 't1'
    const projectId = 'p1'

    describe('host-independent rules', function () {
        it('maps a relative sub-path into the project bucket', function () {
            should(resolvePath(teamId, projectId, 'sub/file.txt')).startWith(require('path').join(teamId, projectId))
        })
        it('maps an empty path to the project root', function () {
            should(resolvePath(teamId, projectId, '')).eql(require('path').join(teamId, projectId))
        })
        it('rejects a traversal out of the project', function () {
            should(() => resolvePath(teamId, projectId, '../../etc/passwd')).throw(/Invalid Path/)
        })
        it('rejects an id that is not id-safe', function () {
            should(() => resolvePath('..', projectId, 'file.txt')).throw(/Invalid Path/)
            should(() => resolvePath(teamId, 'a/b', 'file.txt')).throw(/Invalid Path/)
        })
    })

    // The driver uses the host's path module, so the separator differs by OS.
    // Exercise both flavours directly so the behaviour is covered regardless of
    // which OS the tests run on.
    for (const [name, impl] of [['posix', posix], ['win32', win32]]) {
        describe(name, function () {
            const resolve = (p) => resolvePathWith(impl, teamId, projectId, p)
            const base = impl.join(teamId, projectId)

            it('confines a relative path to the project', function () {
                should(resolve('sub/file.txt')).eql(impl.join(base, 'sub', 'file.txt'))
            })
            it('allows an in-project ".." that stays inside the project', function () {
                should(resolve('a/../b.txt')).eql(impl.join(base, 'b.txt'))
            })
            it('strips a leading separator and appends to the project', function () {
                should(resolve('/data/file.json')).eql(impl.join(base, 'data', 'file.json'))
                should(resolve('/test')).eql(impl.join(base, 'test'))
            })
            it('rejects a traversal that leaves the project', function () {
                should(() => resolve('..')).throw(/Invalid Path/)
                should(() => resolve('../p2/x')).throw(/Invalid Path/)
                should(() => resolve('/../p2/x')).throw(/Invalid Path/)
            })
        })
    }
})

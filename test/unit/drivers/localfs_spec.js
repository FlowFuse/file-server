const should = require('should')
const setup = require('./setup.js')
const fs = require('fs')
const { join, sep: pathSeparator } = require('path')

describe('localfs driver', function () {
    let app
    let teamId = 't1' // eslint-disable-line
    let projectId = 'p1' // eslint-disable-line

    beforeEach(async function () {
        app = await setup({
            home: 'var',
            driver: {
                type: 'localfs',
                options: {
                    root: 'tmp'
                }
            }
        }, {
            teamId,
            projectId
        })
    })

    afterEach(async function () {
        app.close()
    })

    it('creates driver', async function () {
        const driver = app._driver
        should(driver).be.an.Object()
        driver.should.have.a.property('save').and.be.a.Function()
        driver.should.have.a.property('read').and.be.a.Function()
        driver.should.have.a.property('delete').and.be.a.Function()
        driver.should.have.a.property('append').and.be.a.Function()
        driver.should.have.a.property('quota').and.be.a.Function()
    })
    it('resolves a file path', async function () {
        const driver = app._driver
        const fileName = 'test1.txt'
        const fileLocation = join(app.options.rootPath, driver.resolvePath(teamId, projectId, fileName))
        const expectedLocation = `${app.options.rootPath}${pathSeparator}${teamId}${pathSeparator}${projectId}${pathSeparator}${fileName}`
        // perform action
        should(fileLocation).eql(expectedLocation)
    })
    it('saves text file', async function () {
        const driver = app._driver
        const fileName = 'test1.txt'
        const fileLocation = join(app.options.rootPath, driver.resolvePath(teamId, projectId, fileName))

        // pre-verify action
        should(fs.existsSync(fileLocation)).be.false('File should not exist before test')
        // perform action
        await driver.save(teamId, projectId, fileName, 'this is test data')
        // verify action
        should(fs.existsSync(fileLocation)).be.true('File should exist after test')
    })
    it('saves text file in sub path', async function () {
        const driver = app._driver
        const fileName = join('sub1', 'sub2', 'test1.txt')
        const fileLocation = join(app.options.rootPath, driver.resolvePath(teamId, projectId, fileName))
        try {
            fs.rmSync(fileLocation)
        } catch (_error) {
            // ignore
        }
        // pre-verify action
        should(fs.existsSync(fileLocation)).be.false('File should not exist before test')
        // perform action
        await driver.save(teamId, projectId, fileName, 'this is test data')
        // verify action
        should(fs.existsSync(fileLocation)).be.true('File should exist after test')
    })
    it('rejects a traversal in the file path', function () {
        const driver = app._driver
        should(() => driver.resolvePath(teamId, projectId, join('..', '..', 'etc', 'passwd'))).throw(/Invalid Path/)
    })
    it('rejects a teamId that is not id-safe', function () {
        const driver = app._driver
        should(() => driver.resolvePath('..', projectId, 'file.txt')).throw(/Invalid Path/)
    })
    it('rejects a projectId that is not id-safe', function () {
        const driver = app._driver
        should(() => driver.resolvePath(teamId, 'a/b', 'file.txt')).throw(/Invalid Path/)
    })
    it('rejects a rooted path (leading separator)', function () {
        const driver = app._driver
        // The wildcard route only ever yields a relative sub-path; a rooted path
        // is not a valid client input and must be rejected, not remapped.
        should(() => driver.resolvePath(teamId, projectId, `${pathSeparator}etc${pathSeparator}passwd`)).throw(/Invalid Path/)
    })
    it('rejects a rooted path aimed at a sibling project', function () {
        const driver = app._driver
        should(() => driver.resolvePath(teamId, projectId, `${pathSeparator}p2${pathSeparator}secret.txt`)).throw(/Invalid Path/)
    })
    it('rejects a Windows drive-letter path', function () {
        const driver = app._driver
        // Must not be silently mapped to <team>/<project>/c/... (which orphaned
        // data and, on a Windows host, allowed the bucket to be escaped).
        should(() => driver.resolvePath(teamId, projectId, 'c:\\test\\doc.txt')).throw(/Invalid Path/)
    })
    it('accepts an ordinary relative sub-path', function () {
        const driver = app._driver
        const resolved = driver.resolvePath(teamId, projectId, join('sub', 'file.txt'))
        should(resolved).eql(join(teamId, projectId, 'sub', 'file.txt'))
    })
})

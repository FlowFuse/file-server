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
    it('strips a leading separator and appends to the project', function () {
        const driver = app._driver
        // An absolute-looking path is treated as relative to the project bucket.
        const resolved = driver.resolvePath(teamId, projectId, `${pathSeparator}sub${pathSeparator}file.txt`)
        should(resolved).eql(join(teamId, projectId, 'sub', 'file.txt'))
    })
    it('rejects a traversal that leaves the project via a leading separator', function () {
        const driver = app._driver
        should(() => driver.resolvePath(teamId, projectId, `${pathSeparator}..${pathSeparator}p2${pathSeparator}x`)).throw(/Invalid Path/)
    })
    it('accepts a filename containing a colon on this (posix) host', function () {
        if (pathSeparator !== '/') { this.skip() }
        const driver = app._driver
        // A colon is an ordinary filename character on posix, so it must not be
        // mistaken for a Windows drive letter and rejected. The drive-letter
        // rule is host-gated and covered for win32 in resolvePath_spec.
        const resolved = driver.resolvePath(teamId, projectId, 'a:b.txt')
        should(resolved).eql(join(teamId, projectId, 'a:b.txt'))
    })
    it('accepts an ordinary relative sub-path', function () {
        const driver = app._driver
        const resolved = driver.resolvePath(teamId, projectId, join('sub', 'file.txt'))
        should(resolved).eql(join(teamId, projectId, 'sub', 'file.txt'))
    })
})

const should = require('should')
const setup = require('./setup.js')
const path = require('path')
const PACKAGE_ROOT = '../../../'
const FileStorageRequire = file => require(path.join(PACKAGE_ROOT, file))
const getDriver = FileStorageRequire('forge/drivers/vfs')
const fs = require('fs')
const { join, sep: pathSeparator } = require('path')

describe('vfs driver', function () {
    describe('memory driver', function () {
        let app
        let teamId = 't1' // eslint-disable-line
        let projectId = 'p1' // eslint-disable-line
        let vfs
        beforeEach(async function () {
            app = await setup({
                home: 'var',
                driver: {
                    type: 'memory',
                    options: {
                        root: 'tmp'
                    }
                }
            }, {
                teamId,
                projectId
            })
            vfs = getDriver(app, app._driver, teamId, projectId)
        })

        afterEach(async function () {
            app.close()
            vfs = null
        })

        it('creates driver', async function () {
            should(vfs).be.an.Object()
            vfs.should.have.a.property('rootPath')
            vfs.should.have.a.property('resolvePath').and.be.a.Function()
            vfs.should.have.a.property('save').and.be.a.Function()
            vfs.should.have.a.property('read').and.be.a.Function()
            vfs.should.have.a.property('delete').and.be.a.Function()
            vfs.should.have.a.property('append').and.be.a.Function()
            vfs.should.have.a.property('quota').and.be.a.Function()
        })
        it('saves text file', async function () {
            const fileName = 'test1.txt'

            // pre-verify action
            const data1 = await vfs.read(fileName)
            should(data1).be.Undefined()
            // perform action
            await vfs.save(fileName, 'this is a test')
            // verify action
            const data2 = await vfs.read(fileName)
            should(data2).eql('this is a test')
        })
    })
    describe('localfs driver', function () {
        let app
        let teamId = 't1' // eslint-disable-line
        let projectId = 'p1' // eslint-disable-line
        let vfs
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
            vfs = getDriver(app, app._driver, teamId, projectId)
        })

        afterEach(async function () {
            if (app) {
                app.close()
            }
            vfs = null
        })

        it('creates driver', async function () {
            should(vfs).be.an.Object()
            vfs.should.have.a.property('rootPath')
            vfs.should.have.a.property('resolvePath').and.be.a.Function()
            vfs.should.have.a.property('save').and.be.a.Function()
            vfs.should.have.a.property('read').and.be.a.Function()
            vfs.should.have.a.property('delete').and.be.a.Function()
            vfs.should.have.a.property('append').and.be.a.Function()
            vfs.should.have.a.property('quota').and.be.a.Function()
        })
        it('resolves a file path', async function () {
            const fileName = 'test1.txt'
            const fileLocation = join(app.options.rootPath, vfs.resolvePath(teamId, projectId, fileName))
            const expectedLocation = `${app.options.rootPath}${pathSeparator}${teamId}${pathSeparator}${projectId}${pathSeparator}${fileName}`
            // perform action
            should(fileLocation).eql(expectedLocation)
        })
        it('saves text file', async function () {
            const fileName = 'test1.txt'
            const fileLocation = join(app.options.rootPath, vfs.resolvePath(teamId, projectId, fileName))

            // pre-verify action
            should(fs.existsSync(fileLocation)).be.false('File should not exist before test')
            // perform action
            await vfs.save(fileName, 'this is test data')
            // verify action
            should(fs.existsSync(fileLocation)).be.true('File should exist after test')
        })
        it('reads saved text file', async function () {
            const fileName = 'test1.txt'
            const fileLocation = join(app.options.rootPath, vfs.resolvePath(teamId, projectId, fileName))

            // pre-verify action
            should(fs.existsSync(fileLocation)).be.false('File should not exist before test')
            // perform action
            await vfs.save(fileName, 'this is test data to read back')
            // verify action
            const data = await vfs.read(fileName)
            should(data.toString()).eql('this is test data to read back')
        })
        it('saves text file in sub path', async function () {
            const fileName = join('sub1', 'sub2', 'test1.txt')
            const fileLocation = join(app.options.rootPath, vfs.resolvePath(teamId, projectId, fileName))
            try {
                fs.rmSync(fileLocation)
            } catch (_error) {
                // ignore
            }
            // pre-verify action
            should(fs.existsSync(fileLocation)).be.false('File should not exist before test')
            // perform action
            await vfs.save(fileName, 'this is test data')
            // verify action
            should(fs.existsSync(fileLocation)).be.true('File should exist after test')
        })
        it('reads text file in sub path', async function () {
            const fileName = join('sub1', 'sub2', 'test1.txt')
            const fileLocation = join(app.options.rootPath, vfs.resolvePath(teamId, projectId, fileName))
            try {
                fs.rmSync(fileLocation)
            } catch (_error) {
                // ignore
            }
            // pre-verify action
            should(fs.existsSync(fileLocation)).be.false('File should not exist before test')
            // perform action
            await vfs.save(fileName, 'this is more but different test data')
            // verify action
            const data = await vfs.read(fileName)
            should(data.toString()).eql('this is more but different test data')
        })
    })
})

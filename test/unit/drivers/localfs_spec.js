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
})

const should = require('should')
const setup = require('./setup.js')

describe('memory driver', function () {
    let app
    let teamId = 't1' // eslint-disable-line
    let projectId = 'p1' // eslint-disable-line

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
    it('saves text file', async function () {
        const driver = app._driver
        const fileName = 'test1.txt'

        // pre-verify action
        // TODO: Need to be able to either driver.fileStat, driver.exists, or direct access to the storage object to test file does not exist

        // perform action
        await driver.save(teamId, projectId, fileName, 'this is a test')

        // verify action
        // TODO: Need to be able to either driver.fileStat, driver.exists, or direct access to the storage object to test file does not exist
    })
})

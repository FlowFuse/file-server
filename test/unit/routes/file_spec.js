const should = require('should')
const setup = require('../setup')
const util = require('util')

describe('File API', function () {
    fileApiTests({
        driverType: 'memory',
        driverOptions: {},
        appPort: 4111,
        authServerPort: 4112,
        fileQuota: 1000 // set quota to 1K and test we don't exceed it
    })
    fileApiTests({
        driverType: 'localfs',
        driverOptions: {
            root: 'var/root'
        },
        appPort: 4121,
        authServerPort: 4122,
        fileQuota: 1000 // set quota to 1K and test we don't exceed it
    })
    // if (process.env.TEST_S3 !== 'false') {
    //     fileApiTests({
    //         driverType: 's3',
    //         driverOptions: {
    //         },
    //         appPort: 4131,
    //         authServerPort: 4132,
    //         fileQuota: 1000 // set quota to 1K and test we don't exceed it
    //     })
    // }
})

function fileApiTests ({ testName, driverType, driverOptions, appPort, authServerPort, fileQuota } = {}) {
    describe(testName || `${driverType} driver`, function () {
        let app, authServer
        before(async function () {
            app = await setup.setupApp({
                port: appPort,
                base_url: `http://localhost:${authServerPort}`,
                fileDriverType: driverType,
                fileDriverOptions: driverOptions,
                fileQuota: fileQuota || 1000
            })
            if (app.log) {
                app.log.level = 'fatal'
                app.log.error = () => {}
            }
            authServer = setup.authServer({
                port: authServerPort,
                authConfig: [
                    { token: 'test-token-1', projectId: 'test-project-1' },
                    { token: 'test-token-2', projectId: 'test-project-2' },
                    { token: 'test-token-3', projectId: 'test-project-3' }
                ]
            })
        })

        after(async function () {
            if (authServer) {
                const closeAuthServer = util.promisify(authServer.close).bind(authServer)
                await closeAuthServer()
                authServer = null
            }
            if (app) {
                await app.close()
                app = null
            }
        })

        // #region Helper functions
        /**
         * Create/Update a file or ensure a directory exists
         * POST /v1/files/:teamId/:projectId/*
         * @param {null|'append'|'ensureDir'} mode - the mode of operation
         * @param {string} path - the file path
         * @param {Buffer} body - the data to write
         * @param {String} team - The team to write file in (optional, defaults to 'test-team-1')
         * @param {String} project - The project to write file in (optional, defaults to 'test-project-1')
         * @param {String} token - The token to use (optional, defaults to 'test-token-1')
        */
        async function SAVE (mode, path, body, team = 'test-team-1', project = 'test-project-1', token = 'test-token-1') {
            const opts = {
                method: 'POST',
                url: `/v1/files/${team}/${project}/${path}`,
                headers: {
                    'content-type': 'application/octet-stream',
                    authorization: `Bearer ${token}`,
                    ff_mode: mode
                },
                body
            }
            return await app.inject(opts)
        }

        /**
         * Read a file
         * GET /v1/files/:teamId/:projectId/*
         * @param {string} path - the file path
         * @param {String} team - The team to write file in (optional, defaults to 'test-team-1')
         * @param {String} project - The project to set the context in (optional, defaults to 'test-project-1')
         * @param {String} token - The token to use (optional, defaults to 'test-token-1')
        */
        async function READ (path, team = 'test-team-1', project = 'test-project-1', token = 'test-token-1') {
            const opts = {
                method: 'GET',
                url: `/v1/files/${team}/${project}/${path}`,
                headers: {
                    'content-type': 'application/octet-stream',
                    authorization: `Bearer ${token}`
                }
            }
            return await app.inject(opts)
        }

        /**
         * DELETE /v1/files/:teamId/:projectId/*
         * @param {string} path - the file path
         * @param {String} team - The FF team ID (optional, defaults to 'test-team-1')
         * @param {String} project - The project to set the context in (optional, defaults to 'test-project-1')
         * @param {String} token - The token to use (optional, defaults to 'test-token-1')
        */
        async function DELETE (path, team = 'test-team-1', project = 'test-project-1', token = 'test-token-1') {
            const opts = {
                method: 'DELETE',
                url: `/v1/files/${team}/${project}/${path}`,
                headers: {
                    'content-type': 'application/octet-stream',
                    authorization: `Bearer ${token}`
                }
            }
            return await app.inject(opts)
        }

        // #endregion

        describe('Delete API', function () {
            it('Should return 400 when trying to delete a file that does not exist', async function () {
                if (driverType === 'memory') {
                    this.skip() // memory driver does not return 400 for non-existent file
                }
                const response = await DELETE('this_does_not_exist.xxx')
                should(response.statusCode).eql(400)
            })
            it('Should delete file', async function () {
                await SAVE(null, 'file1.txt', Buffer.from('Hello World'))
                const response = await DELETE('file1.txt')
                should(response.statusCode).eql(200)
            })
        })
        describe('Post API', function () {
            beforeEach(async function () {
                await DELETE('file1.txt')
                await DELETE('file2.txt')
            })

            it('Should write a file', async function () {
                const response = await SAVE(null, 'file1.txt', Buffer.from('Hello World'))
                should(response.statusCode).eql(200)
            })
            it('Should append a file', async function () {
                const response = await SAVE('append', 'file1.txt', Buffer.from('Goodbye World'))
                should(response.statusCode).eql(200)
            })
            it('Should Ensure Dir', async function () {
                const response = await SAVE('ensureDir', 'dir1')
                should(response.statusCode).eql(200)
            })
        })
        describe('Get API', function () {
            beforeEach(async function () {
                await DELETE('file1.txt')
                await DELETE('file2.txt')
            })

            it('Should return 404 for non-existing file', async function () {
                const response = await READ('this_does_not_exist.xxx')
                should(response.statusCode).eql(404)
            })
            it('Should read a file', async function () {
                await SAVE(null, 'file1.txt', Buffer.from('Hello World'))
                const response = await READ('file1.txt')
                should(response.statusCode).eql(200)
                response.body.should.eql('Hello World')
            })
        })
        describe('Quota tests ', function () {
            beforeEach(async function () {
                await DELETE('file1.txt')
                await DELETE('file2.txt')
            })
            it('Should fail if quota is exceeded', async function () {
                const response1 = await SAVE(null, 'file1.txt', Buffer.from(Array(1500)).fill(65)) // 1500 "A" characters
                should(response1.statusCode).eql(200)
                const response2 = await SAVE(null, 'file2.txt', Buffer.from(Array(750)).fill(65)) // 750 "A" characters
                should(response2.statusCode).eql(413)
            })
            it.skip('Should allow update/deletion/addition without exceeding quota', async function () {
                // TODO: implement once quota calculation computes the delta

                // Currently, this fails because the quota calculation does not compute the delta of existing files and new/updated files
                // const response1 = await SAVE(null, 'file1.txt', Buffer.from(Array(1500)).fill(65)) // 1500 "A" characters
                // should(response1.statusCode).eql(200)
                // const response2 = await SAVE(null, 'file1.txt', Buffer.from(Array(1000)).fill(66)) // overwrite same file with 1000 "B" characters
                // should(response2.statusCode).eql(200)
            })
        })
        describe('Bleed tests', function () {
            beforeEach(async function () {
                // clean up
            })
            it('Should not be able to read projects files', async function () {
                await SAVE(null, 'file1.txt', Buffer.from('Hello test-team-1, test-project-1'), 'test-team-1', 'test-project-1', 'test-token-1')
                await SAVE(null, 'file1.txt', Buffer.from('Hello test-team-1, test-project-2'), 'test-team-1', 'test-project-2', 'test-token-2')
                const response1 = await READ('file1.txt', 'test-team-1', 'test-project-2', 'test-token-1')
                const response2 = await READ('file1.txt', 'test-team-1', 'test-project-1', 'test-token-2')
                const response3 = await READ('../test-project-2/file1.txt', 'test-team-1', 'test-project-1', 'test-token-1')
                should(response1.statusCode).eql(401)
                should(response2.statusCode).eql(401)
                should(response3.statusCode).eql(401)
            })
            it('Should not be able to read other teams files', async function () {
                await SAVE(null, 'file1.txt', Buffer.from('Hello test-team-1, test-project-1'), 'test-team-1', 'test-project-1', 'test-token-1')
                await SAVE(null, 'file1.txt', Buffer.from('Hello test-team-2, test-project-3'), 'test-team-2', 'test-project-3', 'test-token-3')
                const response1 = await READ('file1.txt', 'test-team-1', 'test-project-2', 'test-token-1')
                const response2 = await READ('file1.txt', 'test-team-1', 'test-project-1', 'test-token-2')
                const response3 = await READ('../test-project-3/file1.txt', 'test-team-1', 'test-project-1', 'test-token-1')
                const response4 = await READ('../test-project-1/file1.txt', 'test-team-2', 'test-project-3', 'test-token-3')
                const response5 = await READ('../../test-team-2/test-project-3/file1.txt', 'test-team-1', 'test-project-1', 'test-token-1')
                const response6 = await READ('../../test-team-1/test-project-1/file1.txt', 'test-team-2', 'test-project-3', 'test-token-3')
                should(response1.statusCode).eql(401)
                should(response2.statusCode).eql(401)
                should(response3.statusCode).eql(401)
                should(response4.statusCode).eql(401)
                should(response5.statusCode).eql(401)
                should(response6.statusCode).eql(401)
            })
        })
    })
}

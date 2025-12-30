const should = require('should')
const setup = require('../setup')

describe('@flowforge file-server', function () {
    let app, authServer
    before(async function () {
        app = await setup.setupApp({
            port: 4001,
            base_url: 'http://localhost:4002'
        })
        authServer = setup.authServer({
            port: 4002,
            authConfig: [
                { token: 'test-token-1', projectId: 'test-project-1' },
                { token: 'test-token-2', projectId: 'test-project-2' }
            ]
        })
    })

    after(async function () {
        const closeAuthServerPromise = function () {
            return new Promise((resolve, reject) => {
                if (!authServer) {
                    resolve()
                    return
                }
                authServer.close((err) => {
                    if (err) reject(err)
                    else resolve()
                })
            })
        }
        if (authServer) {
            await closeAuthServerPromise()
            authServer = null
        }
        if (app) {
            await app.close()
            app = null
        }
    })

    it('Should load file-server application', async function () {
        should(app).be.an.Object()
    })

    it('Should return 401 for unauthenticated request', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-1/global/keys'
        })
        should(response.statusCode).eql(401)
    })

    it('Should return 200 for authenticated request', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-1/global/keys',
            headers: {
                authorization: 'Bearer test-token-1'
            }
        })
        should(response.statusCode).eql(200)
    })

    it('Should return 401 for missing token', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-1/global/keys',
            headers: {
                authorization: 'Bearer'
            }
        })
        should(response.statusCode).eql(401)
    })

    it('Should return 401 for bad token when accessing context', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-1/global/keys',
            headers: {
                authorization: 'Bearer this is not a valid token'
            }
        })
        should(response.statusCode).eql(401)
    })

    it('Should return 401 when trying to use cached to access context on another project', async function () {
        const response1 = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-1/global/keys',
            headers: {
                authorization: 'Bearer test-token-1'
            }
        })
        should(response1.statusCode).eql(200)
        const response2 = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-2/global/keys',
            headers: {
                authorization: 'Bearer test-token-1'
            }
        })
        should(response2.statusCode).eql(401)
    })

    it('Should return 401 for bad token accessing files', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/files/test-team-1/test-project-1/file.txt',
            headers: {
                authorization: 'Bearer this is not a valid token'
            }
        })
        should(response.statusCode).eql(401)
    })

    it('Should return 404 for non-existing file', async function () {
        const response = await app.inject({
            method: 'GET',
            url: '/v1/files/test-team-1/test-project-1/dont-exist.txt',
            headers: {
                authorization: 'Bearer test-token-1'
            }
        })
        should(response.statusCode).eql(404)
    })

    it('Cached token should not permit access to other projects context', async function () {
        // 1st, perform a legal operation to prove it is working & to cache the token
        const response1 = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-1/global/keys',
            headers: {
                authorization: 'Bearer test-token-1'
            }
        })
        should(response1.statusCode).eql(200)

        // now try to use cached token to access a different project
        const response2 = await app.inject({
            method: 'GET',
            url: '/v1/context/test-project-2/global/keys',
            headers: {
                authorization: 'Bearer test-token-1'
            }
        })
        should(response2.statusCode).eql(401) // 401 because cached token is not valid for this project
    })

    it('Cached token should not permit access to other projects files', async function () {
        const response = await app.inject({
            method: 'POST',
            url: '/v1/files/test-team-1/test-project-1/test.txt',
            headers: {
                'content-type': 'application/octet-stream',
                authorization: 'Bearer test-token-1'
            },
            body: 'test'
        })
        should(response.statusCode).eql(200)
        const response2 = await app.inject({
            method: 'GET',
            url: '/v1/files/test-team-1/test-project-2/test.txt',
            headers: {
                'content-type': 'application/octet-stream',
                authorization: 'Bearer test-token-2'
            }
        })
        should(response2.statusCode).eql(404)
    })

    it('Should return 401 deleting file on other project', async function () {
        // 1st access caches token
        const response = await app.inject({
            method: 'POST',
            url: '/v1/files/test-team-1/test-project-1/test.txt',
            headers: {
                'content-type': 'application/octet-stream',
                authorization: 'Bearer test-token-1'
            },
            body: 'test'
        })
        should(response.statusCode).eql(200)
        // 2nd access with same token attempts to delete file on other project
        const response2 = await app.inject({
            method: 'DELETE',
            url: '/v1/files/test-team-1/test-project-2/test.txt',
            headers: {
                'content-type': 'application/octet-stream',
                authorization: 'Bearer test-token-1'
            }
        })
        should(response2.statusCode).eql(401)
    })
})

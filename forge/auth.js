const fp = require('fastify-plugin')
const got = require('got')

const authCache = {}
const ttl = 90 * 1000

// Team and project ids are hashids / uuids. Anything outside this set (a path
// separator, a dot) is never a valid id and is rejected before use in a path.
const idPattern = /^[A-Za-z0-9_-]+$/

module.exports = fp(async function (app, opts) {
    const client = got.extend({
        prefixUrl: `${app.config.base_url}/account/check/project`,
        headers: {
            'user-agent': 'FlowFuse Storage Server',
            'ff-quota': true
        },
        timeout: {
            request: 500
        }
    })

    async function checkToken (projectId, token) {
        const project = await client.get(projectId, {
            headers: {
                authorization: `Bearer ${token}`
            }
        })
        return JSON.parse(project.body)
    }

    async function checkAuth (request, reply) {
        if (request.url === '/metrics' || request.url === '/health') {
            return
        }
        try {
            const token = getAuthToken(request)
            const { teamId, projectId } = request.params
            // Only accept id-safe path segments. This rejects separators and
            // '..' before they can be used to build a storage path.
            if (projectId !== undefined && !idPattern.test(projectId)) {
                throw new Error('Invalid projectId')
            }
            if (teamId !== undefined && !idPattern.test(teamId)) {
                throw new Error('Invalid teamId')
            }
            const cacheOk = checkCache(token, projectId, teamId)
            if (!cacheOk) {
                const tokenResponse = await checkToken(projectId, token)
                if (!tokenResponse) {
                    throw new Error('Invalid token')
                }
                // A token authorises exactly one project. When the route also
                // carries a teamId, it must be that project's team.
                if (teamId !== undefined && tokenResponse.team && tokenResponse.team !== teamId) {
                    throw new Error('Team mismatch')
                }
                request.quota = tokenResponse.quota
                // update cache
                authCache[token] = {
                    ttl: Date.now(),
                    projectId,
                    teamId: tokenResponse.team,
                    quota: tokenResponse.quota
                }
            } else {
                request.quota = authCache[token].quota
            }
        } catch (error) {
            // always send 401 for security reasons
            reply.code(401).send({ code: 'unauthorized', error: 'unauthorized' })
        }
    }

    /**
     * Extract the token from the request.
     * @throws {Error} if the token is not found or the authorization header is invalid
     * @param {Object} request The request object
     * @returns {string} The token
     */
    function getAuthToken (request) {
        if (!request?.headers?.authorization) {
            throw new Error('Missing authorization header')
        }
        const parts = request.headers.authorization.split(' ')
        if (parts.length !== 2) {
            throw new Error('Invalid authorization header')
        }
        if (parts[0] !== 'Bearer') {
            throw new Error('Invalid authorization header')
        }
        if (!parts[1]) {
            throw new Error('Invalid authorization header')
        }
        return parts[1]
    }

    /**
     * Check if the token is in the cache and if it is still valid
     * @param {string} token The token to check
     * @param {string} projectId The projectId to check
     * @returns {boolean} true if the token is valid for the projectId
     */
    function checkCache (token, projectId, teamId) {
        const cacheExists = authCache[token] && authCache[token].projectId && authCache[token].ttl
        let projectMatch = false
        let teamMatch = false
        let ttlOk = false
        if (cacheExists) {
            const cacheEntry = authCache[token]
            // ensure projectId matches the cached projectId
            projectMatch = cacheEntry.projectId === projectId
            // ensure the teamId (when the route carries one) matches the cached team
            teamMatch = teamId === undefined || cacheEntry.teamId === teamId
            // check cache ttl
            ttlOk = (Date.now() - cacheEntry.ttl) < ttl
        }
        const result = cacheExists && projectMatch && teamMatch && ttlOk
        // delete only if expired
        if (!ttlOk && projectMatch) {
            delete authCache[token]
        }
        return result
    }

    app.decorate('checkAuth', checkAuth)
})

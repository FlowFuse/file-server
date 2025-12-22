module.exports = async function (app, opts) {
    app.get('/:teamId/:projectId', async (request, reply) => {
        reply.send({
            used: await request.vfs.quota(request.params.teamId, request.params.projectId)
        })
    })
}

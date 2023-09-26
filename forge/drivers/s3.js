const canary = 'ROOT_DIR_CANARY'
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
const { join, isAbsolute, sep: pathSeparator, parse } = require('path')

function resolvePath (teamId, projectId, path) {
    let resolvedPath
    if (isAbsolute(path)) {
        const pp = parse(path)
        const hasWinDrive = /[a-z|A-Z]:/.test(pp.root)
        if (hasWinDrive) {
            path = path.replace(':', '')
        }
    }
    const minPath = join(canary, teamId, projectId, path) // limit traversal to /teamid/projectId/**
    if (path.startsWith(pathSeparator)) {
        resolvedPath = join(canary, teamId, path)
    } else {
        resolvedPath = join(canary, teamId, projectId, path)
    }
    if (resolvedPath.startsWith(minPath)) {
        const array = resolvedPath.split(pathSeparator)
        array.shift()
        resolvedPath = array.join(pathSeparator)
        return resolvedPath
    } else {
        const err = new Error('Invalid Path')
        err.code = 'ENOTDIR'
        throw err
    }
}

module.exports = function (app) {
    const options = app.config.driver.options
    const bucketID = options.bucket
    delete options.bucket
    const s3 = new S3Client(options)

    return {
        get rootPath () {
            return ''
        },
        resolvePath,
        async ensureDir (teamId, projectId, path) {
            const resolvedPath = resolvePath(teamId, projectId, path)
            await s3.send(new ListObjectsCommand({
                Bucket: bucketID,
                Prefix: resolvedPath
            }))
            return true
        },
        async save (teamId, projectId, path, data) {
            const resolvedPath = resolvePath(teamId, projectId, path)
            await s3.send(new PutObjectCommand({
                Bucket: bucketID,
                Key: resolvedPath,
                Body: data
            }))
        },
        async append (teamId, projectId, path, data) {
            const resolvedPath = resolvePath(teamId, projectId, path)

            try {
                await s3.send(new HeadObjectCommand({
                    Bucket: bucketID,
                    Key: resolvedPath
                }))
                // file exists so load it and append
                try {
                    const file = await s3.send(new GetObjectCommand({
                        Bucket: bucketID,
                        Key: resolvedPath
                    }))
                    const stream = file.Body
                    const body = await (new Promise((resolve, reject) => {
                        const chunks = []
                        stream.on('data', chunk => chunks.push(chunk))
                        stream.once('end', () => resolve(Buffer.concat(chunks)))
                        stream.once('error', reject)
                    }))
                    // I HATE this as it's basically double the file size in memory
                    const newBody = Buffer.concat([body, data])
                    await this.save(teamId, projectId, path, newBody)
                } catch (err) {
                    if (err.type === 'NoSuchKey') {
                        const error = new Error(`ENOENT: no such file or directory, open '${path}'`)
                        error.code = 'ENOENT'
                        throw error
                    } else {
                        throw err
                    }
                }
            } catch (err) {
                await this.save(teamId, projectId, path, data)
            }
        },
        async read (teamId, projectId, path) {
            const resolvedPath = resolvePath(teamId, projectId, path)
            try {
                const file = await s3.send(new GetObjectCommand({
                    Bucket: bucketID,
                    Key: resolvedPath
                }))
                const stream = file.Body
                return new Promise((resolve, reject) => {
                    const chunks = []
                    stream.on('data', chunk => chunks.push(chunk))
                    stream.once('end', () => resolve(Buffer.concat(chunks)))
                    stream.once('error', reject)
                })
            } catch (err) {
                if (err.Code === 'NoSuchKey') {
                    const error = new Error(`ENOENT: no such file or directory, open '${path}'`)
                    error.code = 'ENOENT'
                    throw error
                } else {
                    throw err
                }
            }
        },
        async delete (teamId, projectId, path) {
            const resolvedPath = resolvePath(teamId, projectId, path)
            await s3.send(new HeadObjectCommand({
                Bucket: bucketID,
                Key: resolvedPath
            }))
            await s3.send(new DeleteObjectCommand({
                Bucket: bucketID,
                Key: resolvedPath
            }))
        },
        async quota (teamId, projectId) {
            const objects = await s3.send(new ListObjectsCommand({
                Bucket: bucketID,
                Prefix: join(teamId, projectId)
            }))

            let size = 0
            if (objects.Contents) {
                objects.Contents.forEach(file => {
                    size += file.Size
                })
            }

            return size
        }
    }
}

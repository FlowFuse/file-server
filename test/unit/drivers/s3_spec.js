const should = require('should') // eslint-disable-line
const setup = require('./setup.js')
const {
    S3Client,
    PutObjectCommand, // eslint-disable-line
    GetObjectCommand,
    DeleteObjectCommand, // eslint-disable-line
    ListObjectsCommand, // eslint-disable-line
    HeadObjectCommand // eslint-disable-line
} = require('@aws-sdk/client-s3')

describe('S3 driver', function () {
    let app
    let teamId = 't1' // eslint-disable-line
    let projectId = 'p1' // eslint-disable-line

    const s3client = new S3Client({
        bucket: 'test',
        credentials: {
            accessKeyId: 'minioadmin',
            secretAccessKey: 'minioadmin'
        },
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        region: 'eu-west-1'
    })

    beforeEach(async function () {
        try {
            app = await setup({
                home: 'var',
                driver: {
                    type: 's3',
                    options: {
                        bucket: 'test',
                        credentials: {
                            accessKeyId: 'minioadmin',
                            secretAccessKey: 'minioadmin'
                        },
                        forcePathStyle: true,
                        region: 'eu-west-1',
                        endpoint: 'http://localhost:9000'
                    }
                }
            }, {
                teamId,
                projectId
            })
        } catch (err) {
            console.log(err)
        }
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

        await driver.save(teamId, projectId, fileName, 'this is a test')

        const key = driver.resolvePath(teamId, projectId, fileName)

        const resp = await s3client.send(new GetObjectCommand({
            Bucket: 'test',
            Key: key
        }))

        const body = await resp.Body.transformToString()
        should(body).eql('this is a test')
    })
})

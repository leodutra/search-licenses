const glob = require('glob')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const microjob = require('microjob')
const util = require('util')
const globPromise = util.promisify(glob)

const HtmlTableReporter = require('./src/reporters/html-table-reporter')
const fileWorker = require('./src/workers/file-worker')

const NUM_CPUS = require('os').cpus().length
const MAX_ALLOCATED_CPU = NUM_CPUS > 2 ? NUM_CPUS - 2 : NUM_CPUS

const buildLicenseKey = str => str.trim().toLowerCase().replace(/\W|[aeiouwy]/gm, '')

const globFiles = async (pattern, options) =>
    globPromise(pattern, options)
        .then(files => files.filter(x => fs.lstatSync(x).isFile()))

const mergeByLicense = fileMetadataArray =>
    Object.values(
        Object.fromEntries(
            fileMetadataArray
                .reduce(
                    (licenseMap, fileMeta) => {
                        fileMeta.licenses.forEach(license => {
                            const key = buildLicenseKey(license)
                            if (licenseMap.has(key)) {
                                licenseMap.get(key).files.push(fileMeta.filepath)
                            } else {
                                licenseMap.set(key, { license, files: [fileMeta.filepath] })
                            }
                        })
                        return licenseMap
                    },
                    new Map()
                )
                .entries()
        )
    )

async function processFiles(files, maxWorkers = MAX_ALLOCATED_CPU) {
    try {
        await microjob.start({ maxWorkers })
        const processFile = async filepath => await microjob.job(fileWorker, { data: filepath })
        return mergeByLicense(await Promise.all(files.map(processFile)))
    }
    catch (error) {
        console.error(error)
        throw error
    }
    finally {
        await microjob.stop()
    }
}

async function writeResults(filePath, data) {
    if (!filePath) throw new TypeError(`Missing filePath for ${writeResults.name}`)
    const resultsPath = path.resolve(process.cwd(), filePath)
    console.log('\nResults reported on', resultsPath)
    fs.writeFileSync(resultsPath, data)
}

module.exports = {
    MAX_ALLOCATED_CPU,
    globFiles,
    HtmlTableReporter,
    processFiles,
    writeResults,
}
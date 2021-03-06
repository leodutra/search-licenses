const glob = require('glob')
const fs = require('fs')
const microjob = require('microjob')
const util = require('util')
const globPromise = util.promisify(glob)

const fileLicensesWorker = require('../workers/file-licenses-worker')

const NUM_CPUS = require('os').cpus().length
const DEF_ALLOCATED_CPU = NUM_CPUS > 2 ? NUM_CPUS - 2 : NUM_CPUS

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

const parallelProcessing = microjob => files =>
    Promise.all(
        files.map(
            filepath => microjob.job(fileLicensesWorker, { data: filepath })
        )
    )

async function processFiles (files, maxWorkers = DEF_ALLOCATED_CPU) {
    try {
        await microjob.start({ maxWorkers })
        return mergeByLicense(
            await parallelProcessing(microjob)(files)
        )
    } catch (error) {
        console.error(error)
        throw error
    } finally {
        await microjob.stop()
    }
}

module.exports = {
    DEF_ALLOCATED_CPU,
    globFiles,
    processFiles,
    licenseRegex: require('./license-regex'),
    searchLicenses: require('./search-licenses')
}

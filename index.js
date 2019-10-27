const glob = require('glob')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const microjob = require('microjob')
const HtmlTableReporter = require('./src/reporters/html-table-reporter')
const fileWorker = require('./src/workers/file-worker')

const defGlobOptions = { nocase: true }

const numCPUs = require('os').cpus().length
const allocatedCPU = numCPUs > 2 ? numCPUs - 2 : numCPUs

module.exports = async function main(inputGlob, options) {
    const startTime = Date.now()   
    console.log('Finding files...')
    const files = await matchFiles(inputGlob, { ...defGlobOptions, ...options })  
    console.log(`Found ${files.length} files.`)
    const licenses = await processFiles(files)
    await writeResults('licenses-table-report.html', HtmlTableReporter.report(licenses))
    console.log(`Processed ${files.length} files.`)
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds.`)
}

async function processFiles(files) {
    let results = null
    try {
        await microjob.start({maxWorkers: allocatedCPU})
        results = (
            await Promise.all(
                files.map(async file => await microjob.job(fileWorker, { data: file }))
            )
        ).reduce((curr, x) => x ? _.merge(curr, x) : curr, {})
    }
    catch(error) {
        console.error(error)
    }
    finally {
        await microjob.stop()
    }
    return results
}

async function matchFiles(pattern, options) {
    return new Promise((resolve, reject) => 
        glob(pattern, options, (err, files) => err === null
            ? resolve(files.filter(x => fs.lstatSync(x).isFile()))
            : reject(err)
        )
    )
}

async function writeResults(filePath, data) {
    if (!filePath) throw new TypeError(`Missing filePath for ${writeResults.name}`)
    const resultsPath = path.resolve(process.cwd(), filePath)
    console.log('\nResults reported on', resultsPath)
    fs.writeFileSync(resultsPath, data)
}
#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

const {
    globFiles,
    HtmlTableReporter,
    processFiles
} = require('./index')

const cli = require('commander')

cli
    .version('0.0.1')
    .usage('<inputGlob>')
    .description('Searches for licenses in source files and output findings on a "results.html"')

cli.parse(process.argv)

const defaultGlobOptions = { nocase: true }

async function main (inputGlob, options) {
    const startTime = Date.now()
    console.log('Finding files...')
    const files = await globFiles(inputGlob, { ...defaultGlobOptions, ...options })
    console.log(`Found ${files.length} files.`)
    const licenses = await processFiles(files)
    await writeResults('licenses-table-report.html', HtmlTableReporter.report(licenses))
    console.log(`Processed ${files.length} files.`)
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds.`)
}
main(cli.args[0])

async function writeResults (filePath, data) {
    if (!filePath) throw new TypeError(`Missing filePath for ${writeResults.name}`)
    const resultsPath = path.resolve(process.cwd(), filePath)
    console.log('\nResults reported on', resultsPath)
    fs.writeFileSync(resultsPath, data)
}

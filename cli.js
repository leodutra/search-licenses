#!/usr/bin/env node

const {
    globFiles,
    HtmlTableReporter,
    processFiles,
    writeResults,
} = require('./index');

const cli = require('commander');

cli
    .version('0.0.1')
    .usage('<inputGlob>')
    .description('Searches for licenses in source files and output findings on a "results.html"')

cli.parse(process.argv);

const defaultGlobOptions = { nocase: true }

async function main(inputGlob, options) {
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
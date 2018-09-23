const glob = require('glob')
const extract = require('extract-comments')
const fs = require('fs')
const path = require('path')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const _ = require('lodash')

if (!cluster.isMaster) {
    console.log(`Worker ${process.pid} created`)
    process.on('message', async function(message) {
        console.log(`Worker ${process.pid} is processing...`)
        process.send(await proccessFiles(message));
        console.log(`Worker ${process.pid} finished`)
        process.exit(0)
    })
}

module.exports = async function searchLicenses(inputGlob, options) {
    if (!cluster.isMaster) return
    console.log('Finding files...')
    const files = await matchFiles(inputGlob, options)  
    const licenses = await parallelSearch(files)
    const tableRows = []
    Object.keys(licenses).sort().forEach(key => {
        tableRows.push([
            licenses[key].files.join('<br>'),
            keywordsToHTMLBold(toHTML(licenses[key].license))
        ])
    })
    await writeResults(buildHTML(['Files', 'License'], tableRows))
}

async function parallelSearch(files) {
    console.log(`Master ${process.pid} is running`)
    return new Promise((resolve, reject) => {
        const numChunks = files.length < numCPUs ? 1 : numCPUs
        let licenses = {}
        let lastIndex = 0
        let responseCount = 0
        try {
            for (let i = 0; i < numChunks; i++) {
                const worker = cluster.fork()
                worker.on('message', message => {
                    licenses = _.merge(licenses, message)
                    if (++responseCount === numChunks) {
                        resolve(licenses)
                    }
                })
                const chunkSize = calculateChunkSize(files.length, i)
                worker.send(files.slice(lastIndex, lastIndex + chunkSize))
                lastIndex = chunkSize
            }
        }
        catch(err) {
            reject(err)
        }
    })
}

function calculateChunkSize(numUnits, chunkNumber) {
    return ((numUnits / numCPUs) >> 0) + 
        (chunkNumber === 0 ? numUnits % numCPUs : 0)
}

async function proccessFiles(files) {
    const licenses = {}
    await Promise.all(
        files.sort().map(async file => {
            console.log(`Processing ${file} (PID ${process.pid})`)
            const data = await readFile(file, 'utf8')
            searchLicenseComments(data).forEach(license => {
                const key = buildLicenseKey(license)
                if (licenses[key] == null) {
                    licenses[key] = { license: license, files: [] }
                }
                licenses[key].files.push(file) 
            })
        })
    )
    return licenses
}

function searchLicenseComments(str) {
    return extract(str)
        .map(x => x.raw)
        .filter(x => x.match(/v?\d+?(?:\.\d+?){2}|copy\s*?right|license|rights\s+?reserved|warrant|liabilit|™|®|\(C\)/gim))
}

function toHTML(str) {
    return str.replace(/</gm, '&lt;')
            .replace(/>/gm, '&gt;')
            .replace(/r?\n/g, '<br>')
}

function buildLicenseKey(str) {
    return str.replace(/\r?\n/gm, ' ').replace(/\s+/g, ' ').trim()
}

function keywordsToHTMLBold(str) {
    return str.replace(/v?\d+?(?:\.\d+?){2}|(copy\s*?right|license|rights\s+?reserved|warrant|liabilit)\w*|™|®|\(C\)/gim, function(x) {
        return `<b style="background-color: yellow">${x}</b>`
    })
}

function buildHTML(tableHeaders, tableRows) {
    return `
        <!DOCTYPE html>
        <head><title>Search license results</title></head>
        <body>
            <table border="1">
                <thead>
                    <tr>
                        ${mapToHTMLTags('th', tableHeaders)}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows.map(tr => `
                        <tr>
                            ${mapToHTMLTags('td', tr)}
                        </tr>
                    `).join('\n')}
                </tbody>
            </table>
        </body>
    `
}

function mapToHTMLTags(tagName, contents) {
    return contents.map(inner => `<${tagName}>${inner}</${tagName}>`).join('\n')
}

async function matchFiles(pattern, options) {
    return new Promise((resolve, reject) => 
        glob(pattern, options, (err, files) => err === null ? resolve(files) : reject(err))
    )
}

async function readFile(fileName, type) {
    return new Promise((resolve, reject) => 
        fs.readFile(fileName, type, (err, data) => err ? reject(err) : resolve(data))
    )
}

async function writeResults(data) {
    const resultsPath = path.resolve(process.cwd(), 'search-results.html')
    console.log('\nResults reported on', resultsPath)
    fs.writeFileSync(resultsPath, data)
}
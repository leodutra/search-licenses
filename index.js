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
        console.log(`Worker ${process.pid} is terminating`)
        process.exit(0)
    })
}

module.exports = async function searchLicenses(inputGlob, options) {
    if (!cluster.isMaster) return 
    console.log('Finding files...')
    const files = await matchFiles(inputGlob, options)  
    const licenses = await parallelSearch(files.sort())
    const tableRows = []
    Object.keys(licenses).sort(sortByCleanText).forEach(key => {
        tableRows.push([
            licenses[key].files.join('<br>'),
            keywordsToHTMLBold(toHTML(licenses[key].license))
        ])
    })
    await writeResults(buildHTML(['Files', 'License'], tableRows))
}

function sortByCleanText(a, b) {
    a = a.replace(/\W+/gm, '').toLowerCase()
    b = b.replace(/\W+/gm, '').toLowerCase()
    return a < b ? -1 : a > b ? 1 : 0
}

async function parallelSearch(files) {
    console.log(`Master ${process.pid} is running`)
    return new Promise((resolve, reject) => {
        const numChunks = files.length < numCPUs ? files.length : numCPUs
        let licenses = {}
        let lastIndex = 0
        let responseCount = 0
        console.log(`Master will start ${numChunks} workers...`)
        try {
            for (let i = 0; i < numChunks; i++) {
                const worker = cluster.fork()
                worker.on('message', message => {
                    licenses = _.merge(licenses, message)
                    if (++responseCount === numChunks) {
                        resolve(licenses)
                    }
                })
                const chunkSize = calculateChunkSize(files.length, numChunks, i)
                worker.send(files.slice(lastIndex, lastIndex + chunkSize))
                lastIndex = chunkSize
            }
        }
        catch(err) {
            reject(err)
        }
    })
}

function calculateChunkSize(numUnits, numChunks, chunkNumber) {
    return ((numUnits / numChunks) >> 0) + 
        (chunkNumber === 0 ? numUnits % numChunks : 0)
}

async function proccessFiles(files) {
    const licenses = {}
    await Promise.all(
        files.map(async file => {
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
    const result = []
    const regex = /v?\d+?(?:\.\d+?){2}|copy\s*?right|license|rights\s+?reserved|warrant|liabilit|™|®|\(C\)/gim
    const comments = extract(str)
    for(let i = 0, l = comments.length; i < l; i++) {
        regex.lastIndex = 0
        if (comments[i].raw.match(regex)) {
            result.push(comments[i].raw)
        }
    }
    return result
}


const htmlSubstitutions = {
    '<': '&lt;',
    '>': '&lt;',
    '\r\n': '<br>',
    '\n': '<br>'
}
function toHTML(str) {   
    return str.replace(/(?:<|>|\r?\n)/gm, x => htmlSubstitutions[x])
}

function buildLicenseKey(str) {
    return str.replace(/(?:\s+|\r?\n)/gm, ' ').trim()
}

function keywordsToHTMLBold(str) {
    return str.replace(/v?\d+?(?:\.\d+?){2}|(copy\s*?right|license|rights\s+?reserved|warrant|liabilit)\w*|™|®|\(C\)/gim, 
        x => `<b style="background-color: yellow">${x}</b>`
    )
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

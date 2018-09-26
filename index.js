const glob = require('glob')
const extract = require('extract-comments')
const fs = require('fs')
const path = require('path')
const cluster = require('cluster')
const _ = require('lodash')

const numCPUs = require('os').cpus().length
const allocatedCPU = numCPUs > 2 ? numCPUs - 2 : numCPUs

const licenseMatchers = [
    // ref: https://en.wikipedia.org/wiki/Comparison_of_free_and_open-source_software_licenses
    'v?\\d+(?:\\.\\d+){2,}',
    'copy\\s*?right\\w*',
    'license\\w*',
    '(?:all)?\\s+?rights\\s+?reserved\\w*',
    '\\(C\\)',
    'warrant\\w+',
    '™',
    '®',
    'MIT',
    'BSD',
    '[AL]?GPL',
    'Unlicense',
    'Permissive',
    'Copylefted',
    'Public\\s+Domain',
    'ISC',
    'CC-BY',
    'Creative\\s+Commons',
    'CeCILL',
    'WTFPL',
    'With\\s+restrictions',
    'Free\\s+Software',
    'Open\\s+Source',
    'Free\\s+License'
]
const licenseRegex = new RegExp(`\\b(?:${licenseMatchers.join('|')})\\b`, 'gim')

if (!cluster.isMaster) {
    console.log(`Worker ${process.pid} started.`)
    process.on('message', async function(message) {
        console.log(`Worker ${process.pid} received ${message.length} files. Processing...`)
        process.send(await proccessFiles(message));
        console.log(`Worker ${process.pid} is terminating. Processed ${message.length} files.`)
        process.exit(0)
    })
}

module.exports = async function searchLicenses(inputGlob, options) {
    if (!cluster.isMaster) return 
    let startTime = Date.now()
    console.log('Finding files...')
    const files = await matchFiles(inputGlob, options)  
    console.log(`Found ${files.length} files.`)
    const licenses = await parallelSearch(files)
    const tableRows = []
    Object.keys(licenses).sort(sortByCleanText).forEach(key => {
        tableRows.push([
            licenses[key].files.sort().join('<br>'),
            keywordsToHTMLBold(toHTML(licenses[key].license))
        ])
    })
    await writeResults(buildHTML(['Files', 'License'], tableRows))
    console.log(`Processed ${files.length} files.`)
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds.`)
}

function sortByCleanText(a, b) {
    a = a.replace(/\W+/gm, '').toLowerCase()
    b = b.replace(/\W+/gm, '').toLowerCase()
    return a < b ? -1 : a > b ? 1 : 0
}

async function parallelSearch(files) {
    console.log(`Master ${process.pid} is running`)
    return new Promise((resolve, reject) => {
        const numChunks = files.length < allocatedCPU ? files.length : allocatedCPU  
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
                const chunkSize = calculateChunkSize(files.length, numChunks, i === 0)
                const nextLastIndex = lastIndex + chunkSize
                worker.send(files.slice(lastIndex, nextLastIndex))
                console.log(
                    `Worker ${worker.process.pid} will process chunk from ${lastIndex} to ${nextLastIndex - 1}`,
                    `(${nextLastIndex - lastIndex} files).`
                )
                lastIndex = nextLastIndex
            }
        }
        catch(err) {
            reject(err)
        }
    })
}

function calculateChunkSize(numUnits, numChunks, addRemainder) {
    return ((numUnits / numChunks) >> 0) + (addRemainder ? numUnits % numChunks : 0)
}

async function proccessFiles(files) {
    const licenses = {}
    await Promise.all(
        files.map(async file => {
            const data = await readFile(file, 'utf8')
            console.log(`Worker ${process.pid} is processing ${file}    `)
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
    return extract(str).reduce((result, comment) => {
        licenseRegex.lastIndex = 0
        if (comment.raw.match(licenseRegex)) {
            result.push(sanitizeLicense(comment.raw))
        }
        return result
    }, [])
}

function sanitizeLicense(str) {
    return str.replace(/^\s*?\*+\s?/gim, '\n').replace(/^[@#=-\s]+$/gim, '').trim()
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
    licenseRegex.lastIndex = 0
    return str.replace(licenseRegex, 
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
        glob(pattern, options, (err, files) => err === null
            ? resolve(files.filter(x => fs.lstatSync(x).isFile()))
            : reject(err)
        )
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

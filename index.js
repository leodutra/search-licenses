const glob = require('glob')
const extract = require('extract-comments')
const fs = require('fs')
const path = require('path')
const cluster = require('cluster')
const _ = require('lodash')
const HtmlTableReporter = require('./src/reporters/html-table-reporter')

const defGlobOptions = { nocase: true }

const numCPUs = require('os').cpus().length
const allocatedCPU = numCPUs > 2 ? numCPUs - 2 : numCPUs

const licenseRegex = require('./license-regex')

module.exports = async function main(inputGlob, options) {
    if (!cluster.isMaster) return 
    let startTime = Date.now()
    console.log('Finding files...')
    const files = await matchFiles(inputGlob, { ...defGlobOptions, ...options })  
    console.log(`Found ${files.length} files.`)
    const licenses = await processFiles(files)
    await writeResults('licenses-table-report.html', HtmlTableReporter.report(licenses))
    console.log(`Processed ${files.length} files.`)
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds.`)
}

async function processFiles(files) {
    console.log(`Master ${process.pid} is running`)
    return new Promise(resolve => {
        const queue = files.slice() // clone
        let results = {}
        let doneCount = 0
        let readyCount = 0
        console.log(`Master will start ${allocatedCPU} workers...`)
        const workers = []
        for (let i = 0; i < allocatedCPU; i++) {
            const worker = cluster.fork()
            const workerId = i
            worker.on('message', ({ status, data }) => {
                switch(status) {
                    case 'done':
                        if (data) {
                            results = _.merge(results, data)
                        }
                        if (++doneCount === files.length) {
                            resolve(results)
                        }
                        worker.send({ workerId, data: queue.pop() })
                        break
                    case 'ready':
                        if (++readyCount === allocatedCPU) {
                            workers.forEach((x, i) => x.send({ workerId, data: queue.pop() }))
                        }
                        break
                }              
            })
            workers.push(worker)
        }
    })
}

if (cluster.isWorker) {
    console.log(`Worker is starting...`)
    let first = true 
    process.on('message', async function({ workerId, data }) {
        try {
            if (first) {
                console.log(`Worker ${workerId} started.`)
                first = false
            }
            if (data) {
                console.log(`Worker ${workerId} is processing ${data}`)
                process.send({
                    workerId,
                    status: 'done',
                    data: await doWorkerProcess(data)
                })
            }
            else {
                console.log(`Worker ${workerId} is terminating.`)
                process.exit(0)
            }
        }
        catch(err) {
            console.error(err)
        }
    })
    process.send({ status: 'ready' })
}

async function doWorkerProcess(file) {
    const data = await readFile(file, 'utf8')
    const licenses = {}
    
    function addLicense(license) {
        const key = buildLicenseKey(license)
        if (licenses[key] == null) {
            licenses[key] = { license: license, files: [] }
        }
        licenses[key].files.push(file) 
    }
    
    extractJavaScriptLicenseComments(data).forEach(addLicense) 
    extractASPXLicenseComments(data).forEach(addLicense) 
    extractVBLicenseComments(data).forEach(addLicense) 

    return licenses 
}




function extractJavaScriptLicenseComments(str) {
    return filterLicenseComments(extract(str).map(comment => comment.raw))
}

function extractASPXLicenseComments(str) {
    const comments = []
    regexMultiMatch(str, /<%--([^-]+?)--%>/gim, comment => comments.push(comment))
    regexMultiMatch(str, /@\*([^*]+?)\*@/gim, comment => comments.push(comment))
    return filterLicenseComments(comments)
}

function extractVBLicenseComments(str) {
    const comments = []
    regexMultiMatch(str, /^\s*\bREM\b(.+)$/gim, comment => comments.push(comment))
    regexMultiMatch(str, /^\s*'([^']+)$/gim, comment => comments.push(comment))
    return filterLicenseComments(comments)
}

function filterLicenseComments(comments) {
    const result = []
    comments.forEach(comment => {
        const licenseData = extractLicenseFromComment(comment)
        if (licenseData) {
            result.push(licenseData)
        }
    })
    return result
}

function extractLicenseFromComment(comment) {
    licenseRegex.lastIndex = 0
    const match = comment.match(licenseRegex)
    return match ? sanitizeLicense(comment) : null
}

function regexMultiMatch(str, regex, fn) {
    // clone for no regex.lastIndex problems
    var regexClone = new RegExp(
        regex.source, 
        regex.flags || (regex.global ? 'g' : '') + (regex.ignoreCase ? 'i' : '') + (regex.multiline ? 'm' : '')
    )
    var match = regexClone.exec(str)
    if (match) {
        fn.apply(null, match)
    }
    if (regex.global) {
        while((match = regexClone.exec(str))) {
            fn.apply(null, match)
        }
    }
}

function sanitizeLicense(str) {
    return str.replace(/^\s*?\*+\s?/gim, '\n').replace(/^[@#=-\s]+$/gim, '').trim()
}



function buildLicenseKey(str) {
    return str.replace(/(?:\s+|\r?\n)/gm, ' ').trim()
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

async function writeResults(filePath, data) {
    if (!filePath) throw new TypeError(`Missing filePath for ${writeResults.name}`)
    const resultsPath = path.resolve(process.cwd(), filePath)
    console.log('\nResults reported on', resultsPath)
    fs.writeFileSync(resultsPath, data)
}
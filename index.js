const glob = require('glob')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const microjob = require('microjob')
const HtmlTableReporter = require('./src/reporters/html-table-reporter')

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

async function fileWorker(file) {
    console.log(`Processing file: ${file}`)
    const fsPromises = require('fs').promises
    const extract = require('extract-comments')
    const licenseRegex = require('./license-regex')
    
    const data = await fsPromises.readFile(file, 'utf8')
    const licenses = {}
    const comments = [
        ...extractJavaScriptLicenseComments(data),
        ...extractASPXLicenseComments(data),
        ...extractVBLicenseComments(data) 
    ]
    if (comments.length === 0) return null
    for(let i = 0, l = comments.length; i < l; i++) {
        const key = buildLicenseKey(comments[i])
        if (licenses[key] == null) {
            licenses[key] = { license: comments[i], files: [] }
        }
        licenses[key].files.push(file) 
    }
    return licenses 

    
    function extractJavaScriptLicenseComments(str) {
        return filterLicenseComments(
            extract(str).map(comment => comment.raw)
        )
    }

    function extractASPXLicenseComments(str) {
        const comments = []
        matchPattern(str, /<%--([^-]+?)--%>/gim).forEach(match => comments.push(match[0]))
        matchPattern(str, /@\*([^*]+?)\*@/gim).forEach(match => comments.push(match[0]))
        return filterLicenseComments(comments)
    }

    function extractVBLicenseComments(str) {
        const comments = []
        matchPattern(str, /^\s*\bREM\b(.+)$/gim).forEach(match => comments.push(match[0]))
        matchPattern(str, /^\s*'([^']+)$/gim).forEach(match => comments.push(match[0]))
        return filterLicenseComments(comments)
    }

    function filterLicenseComments(comments) {
        const result = []
        for(let i = 0, l = comments.length; i < l; i++) {
            const licenseData = extractLicenseFromComment(comments[i])
            if (licenseData) {
                result.push(licenseData)
            }
        }
        return result
    }

    function extractLicenseFromComment(comment) {
        licenseRegex.lastIndex = 0
        return comment.match(licenseRegex)
            ? sanitizeLicense(comment)
            : null
    }

    function matchPattern(str, regexp, fn) {
        const regexpClone = new RegExp(
            regexp.source,
            regexp.flags ||
                (regexp.global ? 'g' : '') +
                (regexp.ignoreCase ? 'i' : '') +
                (regexp.multiline ? 'm' : '') +
                (regexp.dotAll ? 's' : '') +
                (regexp.unicode ? 'u' : '') +
                (regexp.sticky ? 'y' : '')
        )
        regexpClone.lastIndex = 0
        const matches = []
        let match
        if (regexpClone.global) { 
            while(match = regexpClone.exec(str)) {
                matches.push(match)
            }
        }
        else {
            if (match = regexpClone.exec(str)) {
                matches.push(match)
            }
        }
        return matches
    }

    function sanitizeLicense(str) {
        return str.replace(/^\s*?\*+\s?/gim, '\n')
            .replace(/^[@#=-\s]+$/gim, '')
            .trim()
    }


    function buildLicenseKey(str) {
        return str.replace(/(?:\s+|\r?\n)/gm, '\u0020').trim()
    }
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
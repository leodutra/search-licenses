const glob = require('glob')
const extract = require('extract-comments')
const fs = require('fs')
const path = require('path')

module.exports = async function searchLicenses(inputGlob, options) {
    const files = await matchFiles(inputGlob, options)
    const licenses = {}    
    console.log('searching', files.join('\nsearching '))
    await Promise.all(
        files.sort().map(async file => {
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
    const tableRows = []
    Object.keys(licenses).sort().forEach(key => {
        tableRows.push([
            licenses[key].files.join('<br>'),
            toHTML(licenses[key].license)
        ])
    })
    await writeResults(buildHTML(['Files', 'License'], tableRows))
}

function searchLicenseComments(str) {
    return extract(str)
        .map(x => x.raw)
        .filter(x => x.match(/v?\d+?(?:\.\d+?){2}|copy\s*?right|license|rights\s+?reserved|warrant|liabilit|™|®|\(C\)/gim))
}

function toHTML(str) {
    return keywordsToHTMLBold(
        str.replace(/</gm, '&lt;')
           .replace(/>/gm, '&gt;')
           .replace(/r?\n/g, '<br>')
    )
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
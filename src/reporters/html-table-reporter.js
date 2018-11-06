
const _ = require('lodash')
const licenseRegex = require('../../license-regex')

module.exports = class HtmlTableReporter {
    static report(data) {
        return buildHTML(data)
    }
}

function buildHTML(licenses) {
    const tableRows = []
    Object.keys(licenses).sort(sortByCleanText).forEach(key => {
        tableRows.push([
            licenses[key].files.sort().join('<br>'),
            keywordsToHTMLBold(toHTML(licenses[key].license))
        ])
    })
    return `
        <!DOCTYPE html>
        <head><title>Search license results</title></head>
        <style>
            table {
                border-collapse: collapse;
            }
            
            table, th, td {
                border: 1px solid #AAAAAA;
            }

            tr:hover {
                background: #f0f0f5;
            }
        </style>
        <body>
            <table border="1">
                <thead>
                    <tr>
                        <th>Files</th>
                        <th>License</th>
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

function mapToHTMLTags(tagName, contents = []) {
    if (!tagName) throw new TypeError(`Missing tagName for ${mapToHTMLTags.name}`)
    return contents.map(inner => `<${tagName} style="vertical-align: top">${inner}</${tagName}>`).join('\n')
}

function toHTML(str) {   
    if (!str) return str
    const htmlSubstitutions = {
        '<': '&lt;',
        '>': '&lt;',
        '\r\n': '<br>',
        '\n': '<br>'
    }
    return str.replace(
        new RegExp(Object.keys(htmlSubstitutions).join('|'), 'gim'), 
        x => htmlSubstitutions[x]
    )
}

function sortByCleanText(a, b) {
    a = a.replace(/\W+/gm, '').toLowerCase()
    b = b.replace(/\W+/gm, '').toLowerCase()
    return a < b ? -1 : a > b ? 1 : 0
}

function keywordsToHTMLBold(str) {
    licenseRegex.lastIndex = 0
    return str.replace(licenseRegex,
        x => `<b style="background-color: yellow">${x}</b>`
    )
}
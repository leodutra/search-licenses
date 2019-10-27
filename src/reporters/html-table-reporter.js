const _ = require('lodash')
const licenseRegex = require('../lib/license-regex')

module.exports = class HtmlTableReporter {
    static report(data) {
        return buildHTML(data)
    }
}

function buildHTML(licenses) {
    const tableRows = []
    Object.getOwnPropertyNames(licenses || {}).sort(sortByCleanText).forEach(key => {
        tableRows.push([
            licenses[key].files.sort().join('<br>'),
            keywordsToHTMLBold(toHTML(removeBlankLines(licenses[key].license)))
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
                    ${tableRows.map(cells => `
                        <tr>
                            <td style="vertical-align: top">${cells[0]}</td>
                            <td style="vertical-align: top; font-size: 11px">${cells[1]}</td>
                        </tr>
                    `).join('\n') || '<tr><td colspan="2">No license was found.</td></tr>'}
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
    return str.replace(licenseRegex, x => 
        `<b style="background-color: yellow">${x}</b>`
    )
}

function removeBlankLines(text) {
    return text.replace(/(\r?\n)+/gm, '$1')
}
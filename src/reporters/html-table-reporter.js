const licenseRegex = require('../lib/license-regex')

module.exports = class HtmlTableReporter {
    static report (data) {
        return buildHTML(data)
    }
}

const sortByLicenseProp = (a, b) => {
    a = a.license.replace(/\W+/gm, '').toLowerCase()
    b = b.license.replace(/\W+/gm, '').toLowerCase()
    return a < b ? -1 : a > b ? 1 : 0
}

const removeBlankLines = text => text.replace(/(\r?\n)+/gm, '$1')

const keywordsToHTMLBold = str =>
    str.replace(licenseRegex(), x => `<b style="background-color: yellow">${x}</b>`)

const toHTML = (() => {
    const htmlSubstitutions = {
        '<': '&lt;',
        '>': '&lt;',
        '\r\n': '<br>',
        '\n': '<br>'
    }
    return str => str && str.replace(
        new RegExp(Object.keys(htmlSubstitutions).join('|'), 'gim'),
        x => htmlSubstitutions[x]
    )
})()

function buildHTML (licenses) {
    const tableRows = licenses
        .sort(sortByLicenseProp)
        .reduce((rows, licenseMeta) =>
            rows.concat([
                [
                    licenseMeta.files.sort().join('<br>'),
                    keywordsToHTMLBold(toHTML(removeBlankLines(licenseMeta.license)))
                ]
            ]),
        []
        )
    // return console.log(tableRows)
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
                        <th>Possible License</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows.map(cells => `
                        <tr>
                            <td style="vertical-align: top; font-family: monospace">${cells[0]}</td>
                            <td style="vertical-align: top; font-family: monospace">${cells[1]}</td>
                        </tr>
                    `).join('\n') || '<tr><td colspan="2">No license was found.</td></tr>'}
                </tbody>
            </table>
        </body>
    `
}

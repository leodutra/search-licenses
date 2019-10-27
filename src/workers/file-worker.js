module.exports = async function fileWorker(file) {
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
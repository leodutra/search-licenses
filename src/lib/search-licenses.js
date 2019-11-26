const extract = require('extract-comments')
const licenseRegex = require('./license-regex')

const extractJavaScriptComments = str => extract(str).map(comment => comment.raw)
const extractLicenseFromComment = comment =>
    comment.match(licenseRegex()) && sanitizeLicense(comment)

const sanitizeLicense = str =>
    str.replace(/^\s*?\*+\s?/gim, '\n')
        .replace(/^[@#=-\s]+$/gim, '')
        .trim()

module.exports = function searchLicenses (text) {
    let comments = [
        ...extractJavaScriptComments(text),
        ...extractASPXComments(text),
        ...extractVBComments(text)
    ]
    if (comments.length === 0) {
        comments = [text]
    }
    return comments
        .map(extractLicenseFromComment)
        .filter(x => x)
}

function extractASPXComments (str) {
    const comments = []
    matchPattern(str, /<%--([^-]+?)--%>/gim).forEach(match => comments.push(match[0]))
    matchPattern(str, /@\*([^*]+?)\*@/gim).forEach(match => comments.push(match[0]))
    return comments
}

function extractVBComments (str) {
    const comments = []
    matchPattern(str, /^\s*\bREM\b(.+)$/gim).forEach(match => comments.push(match[0]))
    matchPattern(str, /^\s*'([^']+)$/gim).forEach(match => comments.push(match[0]))
    return comments
}

function matchPattern (str, regexp, fn) {
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
        while ((match = regexpClone.exec(str))) {
            matches.push(match)
        }
    } else {
        if ((match = regexpClone.exec(str))) {
            matches.push(match)
        }
    }
    return matches
}

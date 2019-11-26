const {
    DEF_ALLOCATED_CPU,
    globFiles,
    licenseRegex,
    processFiles,
    searchLicenses
} = require('./src/lib')

module.exports = {
    DEF_ALLOCATED_CPU,
    globFiles,
    licenseRegex,
    processFiles,
    searchLicenses,
    HtmlTableReporter: require('./src/reporters/html-table-reporter')
}

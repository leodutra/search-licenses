module.exports = async function fileWorker(filepath) {
    console.log(`Processing file: ${filepath}`)
    const searchLicenses = require('./src/lib/search-licenses')
    return {
        filepath, 
        licenses: searchLicenses(
            await require('fs').promises.readFile(filepath, 'utf8')
        ),
    }
}
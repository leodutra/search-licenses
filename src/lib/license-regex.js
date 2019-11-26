// Keep this in an independent module

const licenseMatchers = [
    // ref: https://en.wikipedia.org/wiki/Comparison_of_free_and_open-source_software_licenses
    'v?\\d+(?:\\.\\d+){2,}',
    'copy\\s*?right\\w*',
    'license\\w*',
    '(?:all)?\\s+?rights\\s+?reserved\\w*',
    '\\(C\\)',
    'warrant\\w+',
    '™',
    '®',
    'MIT',
    'BSD',
    '[AL]?GPL',
    'Unlicense',
    'Permissive',
    'Copylefted',
    'Public\\s+Domain',
    'ISC',
    'CC-BY',
    'Creative\\s+Commons',
    'CeCILL',
    'WTFPL',
    'With\\s+restrictions',
    'Free\\s+Software',
    'Open\\s+Source',
    'Free\\s+License'
]

const source = `\\b(?:${licenseMatchers.join('|')})\\b`

module.exports = () => new RegExp(source, 'gim')

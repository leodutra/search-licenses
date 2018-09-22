#!/usr/bin/env node

const searchLicenses = require('./index');

const cli = require('commander');

cli
  .version('0.0.1')
  .usage('<inputGlob>')
  .description('Searches for licenses in source files and output findings on a "results.html"')

cli.parse(process.argv);


searchLicenses(cli.args[0])

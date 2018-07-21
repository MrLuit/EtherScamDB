const fs = require('fs-extra');
const debug = require('debug')('config');

if (!fs.existsSync('./config/config.js')) {
    fs.copySync('./config/config.example.js', './config/config.js');
    debug('Config file was copied. Please update with correct values');
    process.exit();
} else {
	module.exports = require('../../config/config');
}
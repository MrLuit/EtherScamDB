const fs = require('fs-extra');
const path = require('path');
const debug = require('debug')('config');

if (!fs.existsSync(path.join(__dirname,'../../config/config.js'))) {
    fs.copySync(path.join(__dirname,'../../config/config.example.js'), path.join(__dirname,'../../config/config.js'));
    debug('Config file was copied. Please update with correct values');
    process.exit();
} else {
	module.exports = require('../../config/config');
}
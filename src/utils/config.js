const fs = require('fs');
const debug = require('debug')('config');

if (!fs.existsSync('./config.json')) {
	module.exports = {
		port: 5111,
		manual: false
	}
} else {
	const config = JSON.parse(fs.readFileSync('./config.json','utf8'));
	config.manual = true;
	module.exports = config;
}
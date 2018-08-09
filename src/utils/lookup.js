const request = require('request');
const config = require('./config');
const debug = require('debug')('lookup');
const Bottleneck = require('bottleneck');

const limiter = new Bottleneck({
	minTime: config.lookups.HTTP.minTime,
	maxConcurrent: config.lookups.HTTP.maxConcurrent
});

module.exports.lookup = limiter.wrap(url => {
	return new Promise(resolve => {
		debug('Requesting ' + url + '...');
		request({
			url: url,
			timeout: config.lookups.HTTP.timeoutAfter,
			followAllRedirects: true,
			maxRedirects: 5
		}, (err, response, body) => {
			if(err) resolve(undefined);
			else resolve(response);
		});
	});
});

module.exports.getURLScan = (url) => {
	return new Promise((resolve, reject) => {
		request('https://urlscan.io/api/v1/search/?q=domain%3A' + url, { json: true }, (err, response, body) => {
			if(err) {
				reject(err);
			} else {
				resolve(body.data)
			}
		});
	});
}
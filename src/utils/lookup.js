const request = require('request');
const config = require('./config');
const {parse} = require('url');
const dns = require('dns');
const debug = require('debug')('lookup');
const Bottleneck = require('bottleneck');

let options = {
	minTime: 100,
	maxConcurrent: 20,
	timeoutAfter: 30*1000
};

if('httpRequests' in config) options = config.httpRequests;

const limiter = new Bottleneck({
	minTime: options.minTime,
	maxConcurrent: options.maxConcurrent
});

module.exports.lookup = limiter.wrap(url => {
	return new Promise(resolve => {
		debug('Requesting ' + url + '...');
		request({
			url: url,
			timeout: options.timeoutAfter,
			followAllRedirects: true,
			maxRedirects: 5
		}, (err, response, body) => {
			if(err) resolve(undefined);
			else resolve(response);
		});
	});
});

module.exports.getIP = (url) => {
	return new Promise(resolve => {
		const {hostname} = parse(url);
		dns.lookup(hostname, (error, address) => {
			if(error) resolve(undefined);
			else resolve(address);
		});
	});
}

module.exports.getNameservers = (url) => {
	return new Promise(resolve => {
		const {hostname} = parse(url);
		dns.resolveNs(hostname, (error, addresses) => {
			if(error) resolve(undefined);
			else resolve(addresses);
		});
	});
}
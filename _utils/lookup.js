const request = require('request');
const config = require('../config.js');
const debug = require('debug')('lookup');
const Bottleneck = require('bottleneck');

let options = {
	minTime: 100,
	maxConcurrent: 20,
	timeoutAfter: 30*1000
};

if('httpRequests' in config) {
	options = config.httpRequests;
}

const limiter = new Bottleneck({
	minTime: options.minTime,
	maxConcurrent: options.maxConcurrent
});

const lookup = limiter.wrap(url => {
	return new Promise((resolve, reject) => {
		debug('Requesting ' + url + '...');
		request({
			url: url,
			timeout: options.timeoutAfter,
			followAllRedirects: true,
			maxRedirects: 5
		}, (err, response, body) => {
			if(err) {
				resolve(undefined);
			} else {
				resolve(response);
			}
		});
	});
});

module.exports.lookup = (async (url) => {
	const result = await lookup(url);
	return result;
});

module.exports.weblookup = class weblookup {
  lookup (input) {
    return new Promise(function(resolve, reject) {
      var result = request(input,
      {timeout: 30*1000}, function(e, response, body) {
        if(e || !([200, 301, 302].includes(response.statusCode))) {
          resolve(e)
        }
        else if(!e && response.statusCode == 200){
          resolve(JSON.parse(body))
        }
      });
    });
  }
}
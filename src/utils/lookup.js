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

module.exports.getGoogleSafeBrowsing = (url) => {
	return new Promise((resolve,reject) => {
		request({
			uri: 'https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' + config.apiKeys.Google_SafeBrowsing,
			method: 'POST',
			json: {
				client: {
					clientId: "Ethereum Scam Database",
					clientVersion: "3.0.0"
				},
				threatInfo: {
					threatTypes: ["THREAT_TYPE_UNSPECIFIED", "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
					platformTypes: ["ANY_PLATFORM"],
					threatEntryTypes: ["THREAT_ENTRY_TYPE_UNSPECIFIED", "URL", "EXECUTABLE"],
					threatEntries: [{
						url: url
					}]
				}
			}
		}, (err, response, body) => {
			if(err) {
				reject(err);
			} else if(response.statusCode != 200) {
				reject("Google SafeBrowsing returned an invalid status code");
			} else if(body && body.matches && body.matches[0]) {
				resolve(body.matches[0]);
			} else {
				resolve(false);
			}
		});
	});
}

module.exports.getVirusTotal = (url) => {
	return new Promise((resolve,reject) => {
		request({
			uri: 'https://www.virustotal.com/vtapi/v2/url/report?apikey=' + config.VirusTotal_API_Key + '&resource=http://' + url,
			json: true
		}, (err, response, body) => {
			if(err) {
				reject(err);
			} else if(response.statusCode != 200) {
				reject("VirusTotal returned an invalid status code");
			} else if(body.response_code == 0) {
				reject("VirusTotal returned an invalid internal status code");
			} else {
				resolve(body);
			}
		});
	});
}
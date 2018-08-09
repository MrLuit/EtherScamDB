const fs = require('fs');
const debug = require('debug')('config');

if (!fs.existsSync('./config.json')) {
	module.exports = {
		manual: false,
		port: 5111,
		interval: {
			cacheExpiration: -1,
			cacheRenewCheck: -1,
			databasePersist: -1
		},
		apiKeys: {
			Google_SafeBrowsing: undefined,
			Github_WebHook: undefined,
			VirusTotal: undefined,
			URLScan: undefined,
			AbuseIPDB: undefined
		},
		autoPull: {
			enabled: false,
			interval: -1,
			repository: {
				author: "MrLuit",
				name: "EtherScamDB",
				branch: "master"
			}
		},
		lookups: {
			IP: {
				enabled: false
			},
			DNS: {
				enabled: false
			},
			HTTP: {
				enabled: false,
				minTime: -1,
				maxConcurrent: -1,
				timeoutAfter: -1
			}
		}
	}
} else {
	const config = JSON.parse(fs.readFileSync('./config.json','utf8'));
	config.manual = true;
	module.exports = config;
}
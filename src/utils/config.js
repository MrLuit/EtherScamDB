const fs = require('fs');
const debug = require('debug')('config');

if (!fs.existsSync('./config.json')) {
	module.exports = {
		manual: false,
		port: 5111,
		interval: {
			cacheExpiration: 999999999999999,
			cacheRenewCheck: 999999999999999,
			databasePersist: 999999999999999
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
			interval: 999999999999999,
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
				minTime: 999999999999999,
				maxConcurrent: 0,
				timeoutAfter: 999999999999999
			}
		}
	}
} else {
	const config = JSON.parse(fs.readFileSync('./config.json','utf8'));
	config.manual = true;
	module.exports = config;
}
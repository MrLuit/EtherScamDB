const fs = require('fs');
const dns = require('graceful-dns');
const debug = require('debug')('config');

if (!fs.existsSync('./config.json')) {
	module.exports = {
		manual: false,
		announcement: null,
		port: 5111,
		interval: {
			cacheExpiration: -1,
			cacheRenewCheck: -1,
			databasePersist: -1
		},
		apiKeys: {
			Google_SafeBrowsing: undefined,
			Github_WebHook: undefined,
			VirusTotal: undefined
		},
		autoPull: { enabled: false },
		lookups: {
			DNS: {
				IP: { enabled: false },
				NS: { enabled: false }
			},
			HTTP: { enabled: false }
		}
	}
} else {
	const config = JSON.parse(fs.readFileSync('./config.json','utf8'));
	config.manual = true;
	if(!config.apiKeys.Google_SafeBrowsing) debug("Warning: No Google SafeBrowsing API key found");
	if(!config.apiKeys.VirusTotal) debug("Warning: No VirusTotal API key found");
	if(config.lookups.DNS.servers.length > 0) dns.setServers(config.lookups.DNS.servers);
	module.exports = config;
}
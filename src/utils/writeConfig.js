const fs = require('fs-extra');

module.exports = async (options) => {
	let httpMinTime = null;
	let httpMaxConcurrent = null;
	let httpTimeoutAfter = null;
	
	if(options['http-bottleneck'] == 'fast') {
		httpMinTime = 0; 
		httpMaxConcurrent = 200;
	} else if(options['http-bottleneck'] == 'regular') {
		httpMinTime = 100;
		httpMaxConcurrent = 20;
	} else if(options['http-bottleneck'] == 'slow') {
		httpMinTime = 500;
		httpMaxConcurrent = 5;
	}
	
	if(options['http-timeout'] == 'highly-accurate') httpTimeoutAfter = null;
	else if(options['http-timeout'] == 'accurate') httpTimeoutAfter = 15*1000;
	else if(options['http-timeout'] == 'less-accurate') httpTimeoutAfter = 5*1000;
	
	const config = {
		port: parseInt(options.port),
		interval: {
			cacheExpiration: 1000 * 60 * parseInt(options['cache-expiration']),
			cacheRenewCheck: 1000 * 60 * parseInt(options['cache-renewal']),
			databasePersist: 1000 * parseInt(options['database-persist'])
		},
		apiKeys: {
			Google_SafeBrowsing: options['google-safebrowsing'] || null,
			Github_WebHook: null,
			VirusTotal: options.virustotal || null,
			URLScan: options.urlscan || null,
			AbuseIPDB: options.abuseipdb || null
		},
		autoPull: {
			enabled: (options.pull == "on"),
			interval: 1000 * 60 * 2,
			repository: {
				author: "MrLuit",
				name: "EtherScamDB",
				branch: "master"
			}
		},
		lookups: {
			IP: {
				enabled: (options.mode === "safe" || options.mode == "full")
			},
			DNS: {
				enabled: (options.mode === "safe" || options.mode == "full")
			},
			HTTP: {
				enabled: (options.mode == "full"),
				minTime: httpMinTime,
				maxConcurrent: httpMaxConcurrent,
				timeoutAfter: httpTimeoutAfter
			}
		}
	}
	await fs.writeJson('./config.json',config,{ spaces: 4 });
}
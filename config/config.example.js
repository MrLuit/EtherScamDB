module.exports = {
    port: 5111,
	interval: {
		cacheExpiration: 1000 * 60 * 60 * 2,
		cacheRenewCheck: 1000 * 60 * 5,
		databasePersist: 1000 * 60 * 1
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
		interval: 1000 * 60 * 2,
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
			minTime: 100,
			maxConcurrent: 200,
			timeoutAfter: 10 * 1000
		}
	}
}
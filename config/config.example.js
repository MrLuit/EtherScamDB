module.exports = {
    port: 8080,
    cache_refreshing_interval: 1000 * 60 * 30,
    Google_SafeBrowsing_API_Key: null,
    Github_Hook_Secret: null,
    VirusTotal_API_Key: null,
    Urlscan_API_Key: null,
    AbuseIPDB_API_Key: null,
    repository: {
        author: "MrLuit",
        name: "EtherScamDB",
        branch: "master"
    },
	httpRequests: {
		minTime: 100,
		maxConcurrent: 20,
		timeoutAfter: 30*1000
	}
};

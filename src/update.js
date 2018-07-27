process.env.UV_THREADPOOL_SIZE = 128;
const debug = require('debug')('update');
const progress = require('cli-progress');
//const dns = require('./_utils/dns');
//const url = require('url');
//const yaml = require('js-yaml');
//const fs = require('fs');
const Scam = require('./_utils/scam.class');
//const createDictionary = require('./_utils/dictionary');
const db = require('./_utils/db');

(async () => {
	debug("Updating scams...");
	const scams = await db.all("SELECT * FROM domains WHERE type='scam'");
	
	const bar = new progress.Bar({ format: '[{bar}] {percentage}% | {value}/{total} scams ' }, progress.Presets.shades_classic);
	bar.start(scams.length, 0);
	
	await Promise.all(scams.map(scam => new Scam(scam)).map(async scam => {
		const ip = await scam.getIP();
		const nameservers = await scam.getNameservers();
		const status = await scam.getStatus();
		
		await db.run("UPDATE domains SET status=?,ip=?,nameservers=?,updated=? WHERE type='scam' AND id=?",[status,ip,nameservers,Date.now(),scam.id]);
		
		bar.increment();
		return scam;
	}));
	
	/*const verifiedEntries = rawVerified.sort((a, b) => a.name - b.name);
	const scamDictionary = createDictionary(scams);
	const verifiedDictionary = createDictionary(verifiedEntries);
	const cache = {
		scams: scams,
		legiturls: verifiedEntries,
		blacklist: [...scams.map(scam => url.parse(scam.url).hostname.replace('www.','')),...scams.map(scam => 'www.' + url.parse(scam.url).hostname.replace('www.','')),...Object.keys(scamDictionary.ip)],
		addresses: scamDictionary.addresses,
		whitelistaddresses: verifiedDictionary.addresses,
		ips: scamDictionary.ip,
		whitelist: [...verifiedEntries.map(entry => url.parse(entry.url).hostname.replace('www.','')),...verifiedEntries.map(entry => 'www.' + url.parse(entry.url).hostname.replace('www.',''))],
		inactives: scams.filter(scam => scam.status !== 'Active'),
		actives: scams.filter(scam => scam.status === 'Active'),
		updated: Date.now()
	}*/
	
	bar.stop();
	debug("Done!");
})();
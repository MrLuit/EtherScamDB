process.env.UV_THREADPOOL_SIZE = 128;
const debug = require('debug')('update');
const path = require('path');
const Scam = require('../classes/scam.class');
const serialijse = require("serialijse");
const fs = require('../utils/fs');
const config = require('../utils/config');

serialijse.declarePersistable(Scam);
if(!process.send) throw new Error("This script can only run as a child process");

process.on('disconnect', process.exit(1));

(async () => {
	const cacheExists = await fs.fileExists('./cache.db');
	if(!cacheExists) throw new Error("No cache file found");
	const cacheFile = await fs.readFile('./cache.db');

	debug("Updating scams...");

	await Promise.all(serialijse.deserialize(cacheFile).scams.sort((a,b) => b.id-a.id).filter(scam => scam.howRecent() > config.interval.cacheExpiration).map(async scam => {
		let ip;
		let nameservers;
		if(config.lookups.HTTP.enabled) await scam.getStatus();
		if(config.lookups.IP.enabled) ip = await scam.getIP();
		if(config.lookups.DNS.enabled) nameservers = await scam.getNameservers();
		
		process.send({ id: scam.id, ip: ip || undefined, nameservers: nameservers || undefined, status: scam.status || undefined, statusCode: scam.statusCode || undefined, updated: Date.now() });
	}));
	
	debug("Done updating!");
})();
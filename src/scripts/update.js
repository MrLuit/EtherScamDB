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
	const cacheExists = await fs.fileExists(path.join(__dirname,'../../_data/cache.db'));
	if(!cacheExists) throw new Error("No cache file found");
	const cacheFile = await fs.readFile(path.join(__dirname,'../../_data/cache.db'));

	debug("Updating scams...");

	await Promise.all(serialijse.deserialize(cacheFile).scams.sort((a,b) => b.id-a.id).filter(scam => scam.howRecent() > config.cache_refreshing_interval).map(async scam => {
		await scam.getStatus();
		const ip = await scam.getIP();
		const nameservers = await scam.getNameservers();
		
		process.send({ id: scam.id, ip: ip, nameservers: nameservers, status: scam.status, statusCode: scam.statusCode, updated: Date.now() });
	}));
	
	debug("Done updating!");
})();
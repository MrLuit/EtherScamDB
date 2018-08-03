process.env.UV_THREADPOOL_SIZE = 128;
const debug = require('debug')('update');
const progress = require('cli-progress');
const Scam = require('./classes/scam.class');
const db = require('./utils/db');

(async () => {
	debug("Updating scams...");
	const scams = await db.all("SELECT * FROM domains WHERE type='scam'");
	
	const bar = new progress.Bar({ format: '[{bar}] {percentage}% | {value}/{total} scams ' }, progress.Presets.shades_classic);
	bar.start(scams.length, 0);
	
	await Promise.all(scams.map(scam => new Scam(scam)).map(async scam => {
		const ip = await scam.getIP();
		const nameservers = await scam.getNameservers();
		await scam.getStatus();
		
		await db.run("UPDATE domains SET status=?,ip=?,nameservers=?,statusCode=?,updated=? WHERE type='scam' AND id=?",[scam.status,ip,nameservers,scam.statusCode,Date.now(),scam.id]);
		
		bar.increment();
		return scam;
	}));
	
	bar.stop();
	debug("Done updating!");
})();
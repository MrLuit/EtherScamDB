const yaml = require('js-yaml');
const fs = require('fs');
const db = require('./utils/db');

let resolved = 0;

(async () => {
	await db.init();
	
	const verified = yaml.safeLoad(fs.readFileSync('_data/legit_urls.yaml'));
	const scams = yaml.safeLoad(fs.readFileSync('_data/scams.yaml'));
	
	setInterval(() => process.send({ done: resolved, total: (verified.length+scams.length) }),500);
	
	await Promise.all(verified.map(async verified => {
		if(!('featured' in verified)) verified.featured = false;
		await db.run("INSERT OR REPLACE INTO domains VALUES (?,'verified',?,?,?,null,null,null,null,null,null,?,'0')",[verified.id,verified.name,verified.url,verified.featured+0,verified.description]);
		await Promise.all((verified.addresses || []).map(address => db.run("INSERT OR REPLACE INTO addresses VALUES (?,'verified',?)",[verified.id,address])));
		resolved++;
	}));
	
	await Promise.all(scams.map(async scam => {
		const exists = await db.get("SELECT * FROM domains WHERE type='scam' AND id=?",[scam.id]);
		if(!exists) {
			await db.run("INSERT OR REPLACE INTO domains VALUES (?,'scam',?,?,0,null,null,null,null,?,?,?,'0')",[scam.id,scam.name,scam.url,scam.category,scam.subcategory,scam.description]);
		} else {
			await db.run("UPDATE domains SET name=?,url=?,status=null,ip=null,nameservers=null,category=?,subcategory=?,description=?,updated='0' WHERE id=?",[scam.name,scam.url,scam.category,scam.subcategory,scam.description,scam.id]);
		}
		await Promise.all((scam.addresses || []).map(address => db.run("INSERT OR REPLACE INTO addresses VALUES (?,'scam',?)",[scam.id,address])));
		resolved++;
	}));
	
	process.send({ done: resolved, total: (verified.length+scams.length) }, () => process.exit());
})();
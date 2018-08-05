const fs = require('./fs');
const yaml = require('js-yaml');
const url = require('url');
const serialijse = require("serialijse");
const createDictionary = require('./dictionary');
const Scam = require('../classes/scam.class');

serialijse.declarePersistable(Scam);

const db = {
	scams: [],
	verified: [],
	index: {
		featured: [],
		blacklist: [],
		whitelist: [],
		whitelistAddresses: [],
		addresses: [],
		ips: [],
		inactives: [],
		actives: []
	}
};

const readEntries = async () => {
	const scamsFile = await fs.readFile('_data/scams.yaml');
	const verifiedFile = await fs.readFile('_data/legit_urls.yaml');
	const cacheExists = await fs.fileExists('_data/cache.db');
	if(!cacheExists) {
		yaml.safeLoad(scamsFile).map(entry => new Scam(entry)).forEach(entry => db.scams.push(entry));
		yaml.safeLoad(verifiedFile).forEach(entry => db.verified.push(entry));
	} else {
		const cacheFile = await fs.readFile('_data/cache.db');
		Object.assign(db,serialijse.deserialize(cacheFile));
		yaml.safeLoad(scamsFile).filter(entry => !db.scams.find(scam => scam.id == entry.id)).map(entry => new Scam(entry)).forEach(entry => db.scams.push(entry));
		yaml.safeLoad(verifiedFile).filter(entry => !db.verified.find(verified => verified.id == entry.id)).forEach(entry => db.verified.push(entry));
	}
}

const updateIndex = async () => {
	const scamDictionary = createDictionary(db.scams);
	const verifiedDictionary = createDictionary(db.verified);
	
	db.index.featured = db.verified.filter(entry => entry.featured);
	db.index.blacklist = [...db.scams.map(entry => entry.getHostname().replace('www.','')),...db.scams.map(entry => entry.getHostname().replace('www.','')),...Object.keys(scamDictionary.ip)];
	db.index.whitelist = [...db.verified.map(entry => url.parse(entry.url).hostname.replace('www.','')),...db.verified.map(entry => 'www.' + url.parse(entry.url).hostname.replace('www.',''))];
	db.index.whitelistAddresses = verifiedDictionary.addresses;
	db.index.addresses = scamDictionary.addresses;
	db.index.ips = scamDictionary.ip;
	db.index.inactives = db.scams.filter(scam => scam.status !== 'Active');
	db.index.actives = db.scams.filter(scam => scam.status === 'Active');
}

module.exports.init = async () => {
	await readEntries();
	await updateIndex();
	await fs.writeFile('_data/cache.db',serialijse.serialize(db));
}

module.exports.read = () => db;
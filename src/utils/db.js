const fs = require('./fs');
const yaml = require('js-yaml');
const url = require('url');
const path = require('path');
const serialijse = require("serialijse");
const createDictionary = require('./dictionary');
const Scam = require('../classes/scam.class');
const debug = require('debug')('db');

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
	debug("Reading entries...");
	const scamsFile = await fs.readFile(path.join(__dirname, '../../_data/scams.yaml'));
	const verifiedFile = await fs.readFile(path.join(__dirname, '../../_data/legit_urls.yaml'));
	const cacheExists = await fs.fileExists('./cache.db');
	if(!cacheExists) {
		yaml.safeLoad(scamsFile).map(entry => new Scam(entry)).forEach(entry => db.scams.push(entry));
		yaml.safeLoad(verifiedFile).forEach(entry => db.verified.push(entry));
	} else {
		const cacheFile = await fs.readFile('./cache.db');
		Object.assign(db,serialijse.deserialize(cacheFile));
		yaml.safeLoad(scamsFile).filter(entry => !db.scams.find(scam => scam.id == entry.id)).map(entry => new Scam(entry)).forEach(entry => db.scams.push(entry));
		yaml.safeLoad(verifiedFile).filter(entry => !db.verified.find(verified => verified.id == entry.id)).forEach(entry => db.verified.push(entry));
	}
}

const updateIndex = async () => {
	debug("Updating index...");
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

const exitHandler = () => {
	console.log("Cleaning up...");
	fs.writeFileSync('./cache.db',serialijse.serialize(db));
	console.log("Exited.");
}

module.exports.init = async () => {
	await readEntries();
	await updateIndex();
	await module.exports.persist();
	setTimeout(module.exports.persist,5*60*1000);
	process.stdin.resume();
	process.once('beforeExit', exitHandler);
	process.once('SIGINT', exitHandler);
	process.once('SIGTERM', exitHandler);
}

module.exports.read = () => db;

module.exports.write = (id,data) => {
	const scam = db.scams.find(scam => scam.id == id);
	Object.keys(data).forEach(key => scam[key] = data[key]);
	updateIndex();
}

module.exports.persist = async () => {
	debug("Persisting cache...");
	await fs.writeFile('./cache.db',serialijse.serialize(db));
}

module.exports.exitHandler = exitHandler;
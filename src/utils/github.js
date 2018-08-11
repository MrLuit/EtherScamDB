const request = require('request');
const download = require('download');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');
const debug = require('debug')('github');

const pullDataFiles = async () => {
	debug("Pulling data files...");
	await download("https://raw.githubusercontent.com/" + config.autoPull.repository.author + "/" + config.autoPull.repository.name + "/" + config.autoPull.repository.branch + "/_data/scams.yaml", "_data");
	await download("https://raw.githubusercontent.com/" + config.autoPull.repository.author + "/" + config.autoPull.repository.name + "/" + config.autoPull.repository.branch + "/_data/legit_urls.yaml", "_data");
	await download("https://raw.githubusercontent.com/" + config.autoPull.repository.author + "/" + config.autoPull.repository.name + "/" + config.autoPull.repository.branch + "/_data/twitter.json", "_data");
	debug("Done");
}

module.exports.webhook = async (req,res) => {
	if(!config.apiKeys.Github_WebHook) {
		debug("Warning: Incoming Github Webhook attempt - no secret found in config");
		res.status(403).end();
	} else if(!('x-hub-signature' in req.headers)) {
		debug("Warning: Incoming Github Webhook attempt without x-hub-signature header");
		res.status(403).end();
	} else {
		const githubSig = Buffer.from(req.headers['x-hub-signature']);
		const localSig = Buffer.from("sha1=" + crypto.createHmac("sha1", config.apiKeys.Github_WebHook).update(req.rawBody).digest("hex"));
		if(crypto.timingSafeEqual(githubSig,localSig)) {
			debug("Valid incoming Github webhook!");
				await pullDataFiles();
				await db.readEntries();
				await db.updateIndex();
				await db.persist();
			res.status(200).end();
		} else {
			debug("Warning: Invalid Github webhook attempt");
			res.status(403).end();
		}
	}
}

module.exports.pullData = async () => {
	await pullDataFiles();
	await db.readEntries();
	await db.updateIndex();
	await db.persist();
}
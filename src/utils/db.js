const dblite = require('dblite');
const debug = require('debug')('db');
const db = dblite('./cache.db');

module.exports.init = (async () => {
	await this.run("CREATE TABLE IF NOT EXISTS domains (id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL, featured INTEGER, status TEXT, ip TEXT, nameservers TEXT, statusCode INTEGER, category TEXT, subcategory TEXT, description TEXT, updated TIMESTAMP, PRIMARY KEY(id,type))");
	await this.run("CREATE TABLE IF NOT EXISTS addresses (id TEXT NOT NULL, type TEXT NOT NULL, address TEXT NOT NULL, PRIMARY KEY(id,address))");
});

module.exports.get = (query,arguments = []) => {
	return new Promise((resolve,reject) => {
		debug("GET " + query + " " + JSON.stringify(arguments));
		db.query(query, arguments, function(error,rows) {
			if(error) {
				debug(error);
				reject(error);
			} else {
				resolve(rows[0] || undefined);
			}
		});
	});
}

module.exports.all = (query,arguments = []) => {
	return new Promise((resolve,reject) => {
		debug("ALL " + query + " " + JSON.stringify(arguments));
		db.query(query, arguments, function(error,rows) {
			if(error) {
				debug(error);
				reject(error);
			} else {
				resolve(rows);
			}
		});
	});
}

module.exports.run = (query,arguments = []) => {
	return new Promise((resolve,reject) => {
		debug("RUN " + query + " " + JSON.stringify(arguments));
		db.query(query, arguments, function(error) {
			if(error) {
				debug(error);
				reject(error);
			} else {
				resolve();
			}
		});
	});
}
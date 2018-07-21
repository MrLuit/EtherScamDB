const sqlite3 = require('sqlite3');
const debug = require('debug')('sqlite3');

const db = new sqlite3.Database('./cache.db');

module.exports.init = (async () => {
	await this.run("CREATE TABLE IF NOT EXISTS scams (id TEXT NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL, status TEXT, ip TEXT, nameservers TEXT, category TEXT, subcategory TEXT, description TEXT, updated TIMESTAMP, PRIMARY KEY(id))");
	await this.run("CREATE TABLE IF NOT EXISTS verified_urls (id TEXT NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL, featured INTEGER, description TEXT, PRIMARY KEY(id))");
	//await this.run("CREATE TABLE IF NOT EXISTS addresses (id TEXT NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL, featured INTEGER, description TEXT, PRIMARY KEY(id))");
});

module.exports.get = (query,arguments = []) => {
	return new Promise((resolve,reject) => {
		debug("GET " + query + " " + JSON.stringify(arguments));
		db.get(query, arguments, function(error,row) {
			if(error) {
				debug(error);
				reject(error);
			} else {
				resolve(row);
			}
		});
	});
}

module.exports.all = (query,arguments = []) => {
	return new Promise((resolve,reject) => {
		debug("ALL " + query + " " + JSON.stringify(arguments));
		db.all(query, arguments, function(error,rows) {
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
		db.run(query, arguments, function(error) {
			if(error) {
				debug(error);
				reject(error);
			} else {
				resolve(this.changes);
			}
		});
	});
}
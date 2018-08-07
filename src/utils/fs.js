const fs = require('fs');
const debug = require('debug')('fs');

module.exports.readFile = (path) => {
	return new Promise((resolve,reject) => {
		debug("Reading file %s",path);
		fs.readFile(path, 'utf8', (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

module.exports.writeFile = (path,content) => {
	return new Promise((resolve,reject) => {
		debug("Writing to file %s",path);
		fs.writeFile(path, content, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

module.exports.writeFileSync = fs.writeFileSync;

module.exports.fileExists = (path) => {
	return new Promise((resolve,reject) => {
		debug("Checking if file %s exists",path);
		fs.access(path, fs.F_OK, err => {
			resolve(!err);
		});
	});	
}
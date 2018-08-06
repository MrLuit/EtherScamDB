const fs = require('fs');

module.exports.readFile = (path) => {
	return new Promise((resolve,reject) => {
		fs.readFile(path, 'utf8', (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

module.exports.writeFile = (path,content) => {
	return new Promise((resolve,reject) => {
		fs.writeFile(path, content, (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

module.exports.writeFileSync = fs.writeFileSync;

module.exports.fileExists = (path) => {
	return new Promise((resolve,reject) => {
		fs.access(path, fs.F_OK, err => {
			resolve(!err);
		});
	});	
}
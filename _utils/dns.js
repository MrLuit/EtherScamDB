const url = require('url');
const dns = require('dns');

module.exports.getIP = (lookupURL) => {
	return new Promise((resolve,reject) => {
		const {hostname} = url.parse(lookupURL);
		dns.lookup(hostname, (error, address) => {
			if(error) {
				resolve(undefined);
			} else {
				resolve(address);
			}
		});
	});
}

module.exports.getNameservers = (lookupURL) => {
	return new Promise((resolve,reject) => {
		const {hostname} = url.parse(lookupURL);
		dns.resolveNs(hostname, (error, addresses) => {
			if(error) {
				resolve(undefined);
			} else {
				resolve(addresses);
			}
		});
	});
}
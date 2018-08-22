const {parse} = require('url');
const dns = require('graceful-dns');
const {lookup,getURLScan} = require('../utils/lookup');

module.exports = class Scam {
	constructor(scamObject = {}) {
		if(scamObject.url) {
			this.name = parse(scamObject.url).hostname.replace("www.", "");
			this.url = scamObject.url;
		}
		if(scamObject.category) this.category = scamObject.category;
		if(scamObject.subcategory) this.subcategory = scamObject.subcategory;
		if(scamObject.description) this.description = scamObject.description;
		if(scamObject.addresses) this.addresses = scamObject.addresses;
	}

	async lookup() {
		return lookup(this.url);
	}

	getHostname() {
		return parse(this.url).hostname;
	}

	async getIP() {
		this.ip = await dns.getIP(this.url);
		return this.ip;
	}

	async getNameservers() {
		this.nameservers = await dns.getNS(this.url);
		return this.nameservers;
	}

	async getStatus() {
		const result = await this.lookup();

		if(result && result.statusCode) this.statusCode = result.statusCode;
		else this.statusCode = -1;

		if(!result) {
			this.status = 'Offline';
		} else if(result && result.request && result.request.uri && result.request.uri.path && result.request.uri.path == '/cgi-sys/suspendedpage.cgi') {
            this.status = 'Suspended';
		} else if(result && (result.body == '' || (result.request && result.request.uri && result.request.uri.path && result.request.uri.path == '/cgi-sys/defaultwebpage.cgi'))) {
			this.status = 'Inactive';
		} else if (result && this.subcategory && this.subcategory == 'MyEtherWallet') {
			const isMEW = await lookup('http://' + parse(this.url).hostname.replace("www.", "") + '/js/etherwallet-static.min.js');
			if(isMEW) {
				this.status = 'Active';
			} else {
				this.status = 'Inactive';
			}
		}  else if (result && this.subcategory && this.subcategory == 'MyCrypto') {
			const isMYC = await lookup('http://' + parse(this.url).hostname.replace("www.", "") + '/js/mycrypto-static.min.js');
			if(isMYC) {
				this.status = 'Active';
			} else {
				this.status = 'Inactive';
			}
		} else {
			this.status = 'Active';
		}

		return this.status;
	}

	getURLScan() {
		return getURLScan(this.getHostname());
	}

	howRecent() {
		return Date.now()-(this.updated || 0);
	}
}

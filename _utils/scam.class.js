const dns = require('./dns');
const url = require('url');
const {lookup} = require('./lookup');

module.exports = class Scam {
	constructor(scamObject) {
		this.id = scamObject.id;
		this.name = scamObject.name;
		this.url = scamObject.url;
		
		if(scamObject.category) this.category = scamObject.category;
		if(scamObject.subcategory) this.subcategory = scamObject.subcategory;
		if(scamObject.description) this.description = scamObject.description;
		if(scamObject.addresses) this.addresses = scamObject.addresses;
	}
	
	lookup() {
		return lookup(this.url);
	}
	
	getHostname() {
		return url.parse(this.url).hostname;
	}
	
	getIP() {
		return dns.getIP(this.url);
	}
	
	getNameservers() {
		return dns.getNameservers(this.url);
	}
	
	async getStatus() {
		const result = this.lookup();
		if(!result) {
			return 'Offline';
		} else if(result && result.request && result.request.uri && result.request.uri.path && result.request.uri.path == '/cgi-sys/suspendedpage.cgi') {
            return 'Suspended';
		} else if(result && result.body == '') {
			return 'Inactive';
		} else if (result && this.subcategory && this.subcategory == 'MyEtherWallet') {
			const isMEW = await lookup('http://' + url.parse(this.url).hostname.replace("www.", "") + '/js/etherwallet-static.min.js');
			if(isMEW) {
				return 'Active';
			} else {
				return 'Inactive';
			}
		}  else if (result && this.subcategory && this.subcategory == 'MyCrypto') {
			const isMYC = await lookup('http://' + url.parse(this.url).hostname.replace("www.", "") + '/js/mycrypto-static.min.js');
			if(isMYC) {
				return 'Active';
			} else {
				return 'Inactive';
			}
		} else {
			return 'Active';
		}
	}
}
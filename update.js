const dns = require('dns');
const url = require('url');
const yaml = require('js-yaml');
const fs = require('fs');
const request = require("request");
const shuffle = require('shuffle-array');
const config = require('./config');

let scams = yaml.safeLoad(fs.readFileSync('_data/scams.yaml'));
let urlscan_timeout = 0;
let scams_checked = 0;
let requests_pending = 0;
let new_cache = {
    'scams': [],
    'legiturls': [],
    'blacklist': [],
    'addresses': {},
    'ips': {},
    'whitelist': [],
    'updated': (new Date()).getTime()
};

if (!fs.existsSync('_cache')) {
    fs.mkdirSync('_cache');
}

yaml.safeLoad(fs.readFileSync('_data/legit_urls.yaml')).sort(function(a, b) {
    return a.name - b.name;
}).forEach(function(legit_url) {
    new_cache.legiturls.push(legit_url);
    new_cache.whitelist.push(url.parse(legit_url.url).hostname.replace("www.", ""));
    new_cache.whitelist.push('www.' + url.parse(legit_url.url).hostname.replace("www.", ""));
});
setInterval(function() {
    console.log(scams_checked + '/' + scams.length + ' (' + requests_pending + ' requests pending)');
}, 1000);
scams.forEach(function(scam, index) {
    if ('url' in scam) {
        if (!scam.url.includes('http://') && !scam.url.includes('https://')) {
            console.log('Warning! Entry ' + scam.id + ' has no protocol (http or https) specified. Please update!');
            scam.url = 'http://' + scam.url;
        }
        var scam_details = new_cache.scams[new_cache.scams.push(scam) - 1];
        new_cache.blacklist.push(url.parse(scam.url).hostname.replace("www.", ""));
        new_cache.blacklist.push('www.' + url.parse(scam.url).hostname.replace("www.", ""));
        dns.lookup(url.parse(scam.url).hostname, (err, address, family) => {
            if (!err) {
                scam_details.ip = address;
            }
            dns.resolveNs(url.parse(scam.url).hostname, (err, addresses) => {
                if (!err) {
                    scam_details.nameservers = addresses;
                }
                requests_pending++;
                var r = request(scam.url, {timeout: 5*60*1000}, function(e, response, body) {
                    requests_pending--;
                    if (e || !([200, 301, 302].includes(response.statusCode))) {
                        scam_details.status = 'Offline';
                    } else if (r.uri.href.indexOf('cgi-sys/suspendedpage.cgi') !== -1) {
                        scam_details.status = 'Suspended';
                    } else {
                        if ('subcategory' in scam && scam.subcategory == 'MyEtherWallet') {
                            requests_pending++;
                            request('http://' + url.parse(scam.url).hostname.replace("www.", "") + '/js/etherwallet-static.min.js', {timeout: 5*60*1000}, function(e, response, body) {
                                requests_pending--;
                                if (!e && response.statusCode == 200) {
                                    scam_details.status = 'Active';
                                } else {
                                    scam_details.status = 'Inactive';
                                }
                            });
                        } else if ('subcategory' in scam && scam.subcategory == 'MyCrypto') {
                            requests_pending++;
                            request('http://' + url.parse(scam.url).hostname.replace("www.", "") + '/js/mycrypto-static.min.js', {timeout: 5*60*1000}, function(e, response, body) {
                                requests_pending--;
                                if (!e && response.statusCode == 200) {
                                    scam_details.status = 'Active';
                                } else {
                                    scam_details.status = 'Inactive';
                                }
                            });
                        } else if (body == '') {
                            scam_details.status = 'Inactive';
                        } else {
                            scam_details.status = 'Active';
                        }
                    }
                    /*if(scam_details.status != 'Offline' && 'Urlscan_API_Key' in config) {
                    	urlscan_timeout++;
                    	setTimeout(function() {
                    		request('https://urlscan.io/api/v1/scan/', { method: 'POST', json: { 'url': scam.url, 'public': 'off' }, headers: { 'API-Key': config.Urlscan_API_Key }}, function(err,response,body) {
                    			if(err || response.statusCode != 200) {
                    				console.log(err);
                    				console.log('Status code: ' + response.statusCode);
                    			} else if(body.message != 'Submission successful' || !('api' in body)) {
                    				console.log(body.message);
                    			} else {
                    				setTimeout(function() {
                    					request(body.api, { method: 'POST', json: { 'url': scam.api, 'public': 'off' }, headers: { 'API-Key': config.Urlscan_API_Key }}, function(err,response,body) {
                    						if(err || response.statusCode != 200) {
                    							console.log(err);
                    							console.log('Status code: ' + response.statusCode);
                    						} else {
                    							console.log(body);
                    						}
                    					});
                    				}, 2000);
                    			}
                    		});
                    	}, urlscan_timeout * 8000);
                    }*/
                    if ('ip' in scam_details) {
                        if (!(scam_details.ip in new_cache.ips)) {
                            new_cache.ips[scam_details.ip] = [];
                        }
                        new_cache.ips[scam_details.ip] = scam_details;
                    }
                    if ('addresses' in scam_details) {
                        scam_details.addresses.forEach(function(address) {
                            if (!(address in new_cache.addresses)) {
                                new_cache.addresses[address] = [];
                            }
                            new_cache.addresses[address] = scam_details;
                        });
                    }
					scams_checked++;
					if(index == (scams.length-1)) {
						var done_interval = setInterval(function() {
							if (requests_pending == 0) {
								clearInterval(done_interval);
								Object.keys(new_cache.ips).forEach(function(ip) {
									new_cache.blacklist.push(ip);
								});
								fs.writeFileSync("_cache/cache.json", JSON.stringify(new_cache));
								console.log("Done");
								process.abort();
							}
						}, 500);
					}
                });
            });
        });
    } else {
        console.log("Fatal error: Scam without URL found (" + scam.id + ")");
        process.abort();
    }
});
const dns = require('dns');
const url = require('url');
const yaml = require('js-yaml');
const fs = require('fs');
const request = require("request");
const shuffle = require('shuffle-array');

let scams = yaml.safeLoad(fs.readFileSync('_data/scams.yaml'));
let i = 0;
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
scams.forEach(function(scam, index) {
    if ('url' in scam) {
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
                var r = request(scam.url, function(e, response, body) {
                    i++;
                    if ((e || response.statusCode != 200) && (!('status' in scam_details) || scam_details.status != "Offline")) {
                        scam_details.status = 'Offline';
                    } else if (r.uri.href.indexOf('cgi-sys/suspendedpage.cgi') !== -1 && (!('status' in scam_details) || scam_details.status != "Suspended")) {
                        scam_details.status = 'Suspended';
                    } else if ((!('status' in scam_details) || scam_details.status != "Active") && !e && response.statusCode == 200 && r.uri.href.indexOf('cgi-sys/suspendedpage.cgi') === -1) {
                        scam_details.status = 'Active';
                    }
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
                    if (i == scams.length - 1) {
                        Object.keys(new_cache.ips).forEach(function(ip) {
                            new_cache.blacklist.push(ip);
                        });
                        fs.writeFile("_cache/cache.json", JSON.stringify(new_cache), function() {
                            //urlscan(new_cache);
                        });
                    }
                });
            });
        });
    } else if (i == scams.length - 1) {
        fs.writeFile("_cache/cache.json", JSON.stringify(new_cache), function() {
            //urlscan(new_cache);
        });
    } else {
        i++;
    }
});

/* WIP: function urlscan(new_cache) {
    var timeout = 0;
    shuffle(new_cache.scams).forEach(function(scam) {
        if ('url' in scam && 'status' in scam && (scam.status == "Active" || scam.status == "Suspended")) {
            timeout++;
            setTimeout(function() {
                request('https://urlscan.io/api/v1/scan/', { method: 'POST', json: { 'url': scam.url, 'public': 'off' }, headers: { 'API-Key': 'x' }}, function(err,response,body) {
					if(err || response.statusCode != 200) {
						console.log(err);
						console.log('Status code: ' + response.statusCode);
					} else if(body.message != 'Submission successful' || !('api' in body)) {
						console.log(body.message);
					} else {
						setTimeout(function() {
							request(body.api, { method: 'POST', json: { 'url': scam.api, 'public': 'off' }, headers: { 'API-Key': 'ac990d71-dc66-4b07-b971-4514840afc14' }}, function(err,response,body) {
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
            }, timeout * 8000);
        }
    });
}*/ 
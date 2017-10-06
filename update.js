const dns = require('dns');
const url = require('url');
const yaml = require('js-yaml');
const fs = require('fs');
const request = require("request");
const puppeteer = require('puppeteer');

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

                        //Take a screenshot of the active site if there isn't a screenshot already
                        if(fs.existsSync('_static/screenshots/'+ scam.id +'-thumb.png') === false) {
                            (async() => {
                                const browser = await puppeteer.launch();
                                console.log("Taking screenshot");
                                const page = await browser.newPage();
                                await page.goto(scam.url,{waitUntil:'networkidle'});
                                await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36");
                                page.setViewport({
                                    'width': 1024,
                                    'height': 768
                                });
                                await page.screenshot({path: '_static/screenshots/' + scam.id + '-full.png', fullPage: true});
                                await page.screenshot({path: '_static/screenshots/' + scam.id + '-thumb.png', fullPage: false});
                                await browser.close();
                            })();
                        }
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
                        fs.writeFileSync("_data/cache.json", JSON.stringify(new_cache));
                    }
                });
            });
        });
    } else if (i == scams.length - 1) {
        fs.writeFileSync("_data/cache.json", JSON.stringify(new_cache));
    } else {
        i++;
    }
});
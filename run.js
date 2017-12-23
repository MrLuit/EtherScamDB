'use strict';

const fs = require('fs-extra');
const express = require('express');
const dateFormat = require('dateformat');
const bodyParser = require('body-parser');
const url = require('url');
const spawn = require('child_process').spawn;
const download = require('download-file');
const rimraf = require('rimraf');
const metamaskBlocked = require('eth-phishing-detect');
const request = require('request');
const app = express();
const default_template = fs.readFileSync('./_layouts/default.html', 'utf8');
let cache;
checkConfig();
const config = require('./config');

/* See if there's an up-to-date cache, otherwise run `update.js` to create one. */
function getCache(callback = false) {
    if (!fs.existsSync('_cache/cache.json')) {
        console.log("No cache file found. Creating one...");
        if (callback) {
            spawn('node', ['update.js']);
            let checkDone = setInterval(function() {
                if (fs.existsSync('_cache/cache.json')) {
                    cache = JSON.parse(fs.readFileSync('_cache/cache.json'));
                    clearInterval(checkDone);
                    console.log("Successfully updated cache!");
                    callback();
                }
            }, 1000);
        } else {
            spawn('node', ['update.js']);
        }
    } else if (!cache) {
        cache = JSON.parse(fs.readFileSync('_cache/cache.json'));
        if (callback) {
            callback();
        }
    } else if ((new Date().getTime() - cache.updated) < config.cache_refreshing_interval) {
        return cache;
    } else if ((new Date().getTime() - cache.updated) >= config.cache_refreshing_interval) {
        spawn('node', ['update.js']);
        return cache;
    }
}

/* Generate an abuse report for a scam domain */
function generateAbuseReport(scam) {
    let abusereport = "";
    abusereport += "I would like to inform you of suspicious activities at the domain " + url.parse(scam.url).hostname;
    if ('ip' in scam) {
        abusereport += " located at IP address " + scam['ip'] + ".";
    } else {
        abusereport += ".";
    }
    if ('subcategory' in scam && scam.subcategory == "MyEtherWallet") {
        abusereport += "The domain is impersonating MyEtherWallet.com, a website where people can create Ethereum wallets (a cryptocurrency like Bitcoin).";
    } else if ('subcategory' in scam && scam.subcategory == "Classic Ether Wallet") {
        abusereport += "The domain is impersonating classicetherwallet.com, a website where people can create Ethereum Classic wallets (a cryptocurrency like Bitcoin).";
    } else if ('category' in scam && scam.category == "Fake ICO") {
        abusereport += "The domain is impersonating a website where an ICO is being held (initial coin offering, like an initial public offering but it's for cryptocurrencies).";
    }
    if ('category' in scam && scam.category == "Phishing") {
        abusereport += "\r\n\r\nThe attackers wish to steal funds by using phishing to get the victim's private keys (passwords to a wallet) and using them to send funds to their own wallets.";
    } else if ('category' in scam && scam.category == "Fake ICO") {
        abusereport += "\r\n\r\nThe attackers wish to steal funds by cloning the real website and changing the ethereum address so people will send funds to the attackers' address instead of the real address.";
    }
    abusereport += "\r\n\r\nPlease shut down this domain so further attacks will be prevented.";
    return abusereport;
}

/*  Copy config.example.js to config.js, if it does not exist yet */
function checkConfig() {
    if (!fs.existsSync('config.js')) {
        fs.copySync('config.example.js', 'config.js');
		console.log('Config file was copied. Please update with correct values');
		process.abort();
    }
}

/* Start the web server */
function startWebServer() {
    app.use(express.static('_static')); // Serve all static pages first
	
	app.use('/screenshot', express.static('_cache/screenshots/')); // Serve all screenshots
	
	app.use(bodyParser.json()); // to support JSON-encoded bodies

    app.get('/(/|index.html)?', function(req, res) { // Serve index.html
        res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/index.html', 'utf8')));
    });

    app.get('/search/', function(req, res) { // Serve /search/
        let table = "";
        getCache().legiturls.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        }).forEach(function(url) {
            if ('featured' in url && url.featured) {
                if (fs.existsSync("_static/img/" + url.name.toLowerCase().replace(' ', '') + ".png")) {
                    table += "<tr><td><img class='icon' src='/img/" + url.name.toLowerCase().replace(' ', '') + ".png'>" + url.name + "</td><td><a target='_blank' href='" + url.url + "'>" + url.url + "</a></td></tr>";
                } else {
                    console.log("Warning: No verified icon was found for " + url.name);
                    table += "<tr><td>" + url.name + "</td><td><a target='_blank' href='" + url.url + "'>" + url.url + "</a></td></tr>";
                }
            }
        });
        var template = fs.readFileSync('./_layouts/search.html', 'utf8').replace('{{ trusted.table }}', table);
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/faq/', function(req, res) { // Serve /faq/
        res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/faq.html', 'utf8')));
    });

    app.get('/report/:type?/', function(req, res) { // Serve /report/, /report/domain/, and /report/address/
        if (!req.params.type) {
            res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/report.html', 'utf8')));
        } else if (req.params.type == "address") {
            res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/reportaddress.html', 'utf8')));
        } else if (req.params.type == "domain") {
            res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/reportdomain.html', 'utf8')));
        } else {
            res.sendStatus(404);
        }
    });

    app.get('/scams/:page?/:sorting?/', function(req, res) { // Serve /scams/
        const MAX_RESULTS_PER_PAGE = 30;
        let template = fs.readFileSync('./_layouts/scams.html', 'utf8');
        if (!req.params.sorting || req.params.sorting == 'latest') {
            var scams = getCache().scams.sort(function(a, b) {
                return b.id - a.id;
            });
        } else if (req.params.sorting == 'oldest') {
            var scams = getCache().scams.sort(function(a, b) {
                return a.id - b.id;
            });
        } else if (req.params.sorting == 'status') {
            template = template.replace("{{ sorting.status }}", "sorted descending");
            var scams = getCache().scams.sort(function(a, b) {
                if ('status' in a && 'status' in b) {
                    if (a.status == 'Active' && b.status != 'Active' || a.status == 'Suspended' && b.status == 'Offline') {
                        return -1;
                    } else if (a.status == b.status) {
                        return 0;
                    } else {
                        return 1;
                    }
                } else {
                    return 1;
                }
            });
        } else if (req.params.sorting == 'category') {
            template = template.replace("{{ sorting.category }}", "sorted descending");
            var scams = getCache().scams.sort(function(a, b) {
                if ('category' in a && 'category' in b) {
                    return a.category.localeCompare(b.category);
                } else {
                    return -1;
                }
            });
        } else if (req.params.sorting == 'subcategory') {
            template = template.replace("{{ sorting.subcategory }}", "sorted descending");
            var scams = getCache().scams.sort(function(a, b) {
                if ('subcategory' in a && 'subcategory' in b) {
                    return a.subcategory.localeCompare(b.subcategory);
                } else {
                    return -1;
                }
            });
        } else if (req.params.sorting == 'title') {
            template = template.replace("{{ sorting.title }}", "sorted descending");
            var scams = getCache().scams.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });
        } else {
            res.status(404).send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/404.html', 'utf8')));
        }

        template = template.replace("{{ sorting.category }}", "");
        template = template.replace("{{ sorting.subcategory }}", "");
        template = template.replace("{{ sorting.status }}", "");
        template = template.replace("{{ sorting.title }}", "");

        let addresses = {};

        var intActiveScams = 0;
        var intInactiveScams = 0;

        scams.forEach(function(scam, index) {
            if ('addresses' in scam) {
                scams[index].addresses.forEach(function(address) {
                    addresses[address] = true;
                });
            }

            if ('status' in scam) {
                if (scam.status === 'Active') {
                    ++intActiveScams;
                } else {
                    ++intInactiveScams;
                }
            }
        });

        template = template.replace("{{ scams.total }}", scams.length.toLocaleString('en-US'));
        template = template.replace("{{ scams.active }}", intActiveScams.toLocaleString('en-US'));
        template = template.replace("{{ addresses.total }}", Object.keys(addresses).length.toLocaleString('en-US'));
        template = template.replace("{{ scams.inactive }}", intInactiveScams.toLocaleString('en-US'));

        var table = "";
        if (req.params.page == "all") {
            var max = scams.length - 1; //0-based indexing
            var start = 0;
        } else if (!isNaN(parseInt(req.params.page))) {
            var max = (req.params.page * MAX_RESULTS_PER_PAGE) + MAX_RESULTS_PER_PAGE;
            var start = req.params.page * MAX_RESULTS_PER_PAGE;
        } else {
            var max = MAX_RESULTS_PER_PAGE;
            var start = 0;
        }
        for (var i = start; i <= max; i++) {
            if (scams.hasOwnProperty(i) === false) {
                continue;
            }
            if ('status' in scams[i]) {
                if (scams[i].status == "Active") {
                    var status = "<td class='offline'><i class='warning sign icon'></i> Active</td>";
                } else if (scams[i].status == "Offline") {
                    var status = "<td class='activ'><i class='checkmark icon'></i> Offline</td>";
                } else if (scams[i].status == "Suspended") {
                    var status = "<td class='suspended'><i class='remove icon'></i> Suspended</td>";
                }
            } else {
                var status = "<td>None</td>";
            }
            if ('category' in scams[i]) {
                switch (scams[i].category) {
                    case "Phishing":
                        var category = '<i class="address book icon"></i> Phishing';
                        break;
                    case "Scamming":
                        var category = '<i class="payment icon"></i> Scamming';
                        break;
                    case "Fake ICO":
                        var category = '<i class="dollar icon"></i> Fake ICO';
                        break;
                    default:
                        var category = scams[i].category;
                }
            } else {
                var category = '<i class="remove icon"></i> None';
            }
            if ('subcategory' in scams[i]) {
                if (scams[i].subcategory.toLowerCase() == "wallets") {
                    var subcategory = '<i class="credit card alternative icon"></i> ' + scams[i].subcategory;
                } else if (fs.existsSync("_static/img/" + scams[i].subcategory.toLowerCase().replace(/\s/g, '') + ".png")) {
                    var subcategory = "<img src='/img/" + scams[i].subcategory.toLowerCase().replace(/\s/g, '') + ".png' class='subcategoryicon'> " + scams[i].subcategory;
                } else {
                    console.log("Warning: No subcategory icon was found for " + scams[i].subcategory);
                    var subcategory = scams[i].subcategory;
                }
            } else {
                var subcategory = '<i class="remove icon"></i> None';
            }
            table += "<tr><td>" + category + "</td><td>" + subcategory + "</td>" + status + "<td>" + scams[i].name + "</td><td class='center'><a href='/scam/" + scams[i].id + "'><i class='search icon'></i></a></td></tr>";
        }
        template = template.replace("{{ scams.table }}", table);

        if (req.params.page !== "all") {
            var intCurrentPage = 0;
            if (Number.parseInt(req.params.page) > 0) {
                intCurrentPage = req.params.page;
            }
            var strPagination = "";
            if (intCurrentPage == 0) {
                var arrLoop = [1, 6];
            } else if (intCurrentPage == 1) {
                var arrLoop = [0, 5];
            } else if (intCurrentPage == 2) {
                var arrLoop = [-1, 4];
            } else {
                var arrLoop = [-2, 3];
            }
            for (var i = arrLoop[0]; i < arrLoop[1]; i++) {
                var intPageNumber = (Number(intCurrentPage) + Number(i));
                var strItemClass = "item";
                var strHref = "/scams/" + intPageNumber + "/";
                if (req.params.sorting) {
                    strHref += req.params.sorting + "/";
                }
                if ((intPageNumber > (scams.length) / MAX_RESULTS_PER_PAGE) || (intPageNumber < 1)) {
                    strItemClass = "disabled item";
                    strHref = "#";
                } else if (intCurrentPage == intPageNumber) {
                    strItemClass = "active item";
                }
                strPagination += "<a href='" + strHref + "' class='" + strItemClass + "'>" + intPageNumber + "</a>";
            }
            if (intCurrentPage > 3) {
                if (req.params.sorting) {
                    strPagination = "<a class='item' href='/scams/1/" + req.params.sorting + "'><i class='angle double left icon'></i></a>" + strPagination;
                } else {
                    strPagination = "<a class='item' href='/scams/1/" + req.params.sorting + "'><i class='angle double left icon'></i></a>" + strPagination;
                }
            }
            if (intCurrentPage < Math.ceil(scams.length / MAX_RESULTS_PER_PAGE) - 3) {
                if (req.params.sorting) {
                    strPagination += "<a class='item' href='/scams/" + (Math.ceil(scams.length / MAX_RESULTS_PER_PAGE) - 1) + "/" + req.params.sorting + "'><i class='angle double right icon'></i></a>";
                } else {
                    strPagination += "<a class='item' href='/scams/" + (Math.ceil(scams.length / MAX_RESULTS_PER_PAGE) - 1) + "'><i class='angle double right icon'></i></a>";
                }
            }
        } else {
            strPagination = "";
        }
        template = template.replace("{{ scams.pagination }}", "<div class='ui pagination menu'>" + strPagination + "</div>");
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/scam/:id/', function(req, res) { // Serve /scam/<id>/
        let scam = getCache().scams.find(function(scam) {
            return scam.id == req.params.id;
        });
        let template = fs.readFileSync('./_layouts/scam.html', 'utf8');
        var actions_text = "";
        template = template.replace("{{ scam.id }}", scam.id);
        template = template.replace("{{ scam.name }}", scam.name);

        if ('category' in scam) {
            if ('subcategory' in scam) {
                template = template.replace("{{ scam.category }}", '<b>Category</b>: ' + scam.category + ' - ' + scam.subcategory + '<BR>');
            } else {
                template = template.replace("{{ scam.category }}", '<b>Category</b>: ' + scam.category + '<BR>');
            }
        } else {
            template = template.replace("{{ scam." + name + " }}", '');
        }
        if ('status' in scam) {
            template = template.replace("{{ scam.status }}", '<b>Status</b>: <span class="class_' + scam.status.toLowerCase() + '">' + scam.status + '</span><BR>');
        } else {
            template = template.replace("{{ scam.status }}", '');
        }
        if ('description' in scam) {
            template = template.replace("{{ scam.description }}", '<b>Description</b>: ' + scam.description + '<BR>');
        } else {
            template = template.replace("{{ scam.description }}", '');
        }
        if ('nameservers' in scam) {
            var nameservers_text = '';
            scam.nameservers.forEach(function(nameserver) {
                nameservers_text += '<div class="ui item">' + nameserver + '</div>';
            });
            template = template.replace("{{ scam.nameservers }}", '<b>Nameservers</b>: <div class="ui bulleted list">' + nameservers_text + '</div>');
        } else {
            template = template.replace("{{ scam.nameservers }}", '');
        }
        if ('addresses' in scam) {
            var addresses_text = '';
            scam.addresses.forEach(function(address) {
                addresses_text += '<div class="ui item"><a href="/address/' + address + '">' + address + '</a></div>';
            });
            template = template.replace("{{ scam.addresses }}", '<b>Related addresses</b>: <div class="ui bulleted list">' + addresses_text + '</div>');
        } else {
            template = template.replace("{{ scam.addresses }}", '');
        }
        if ('ip' in scam) {
            template = template.replace("{{ scam.ip }}", '<b>IP</b>: <a href="/ip/' + scam.ip + '">' + scam.ip + '</a><BR>');
        } else {
            template = template.replace("{{ scam.ip }}", '');
        }
        if ('url' in scam) {
            template = template.replace("{{ scam.abusereport }}", generateAbuseReport(scam));
            actions_text += '<button id="gen" class="ui icon secondary button"><i class="setting icon"></i> Abuse Report</button>';
            actions_text += '<a target="_blank" href="http://web.archive.org/web/*/' + url.parse(scam.url).hostname + '" class="ui icon secondary button"><i class="archive icon"></i> Archive</a>';
            template = template.replace("{{ scam.url }}", '<b>URL</b>: <a id="url" target="_blank" href="/redirect/' + encodeURIComponent(scam.url) + '">' + scam.url + '</a><BR>');
            template = template.replace("{{ scam.googlethreat }}", "<b>Google Safe Browsing</b>: {{ scam.googlethreat }}<BR>");
            template = template.replace("{{ scam.metamask }}", "<b>MetaMask Status:</b> " + (metamaskBlocked(url.parse(scam.url).hostname) ? "<span style='color:green'>Blocked</span>" : "<span style='color:red'>Not Blocked</span>") + "<br />");
			if('status' in scam && scam.status != 'Offline' && fs.existsSync('_cache/screenshots/' + scam.id + '.png')) {
				template = template.replace("{{ scam.screenshot }}",'<h3>Screenshot</h3><img src="/screenshot/' + scam.id + '.png">');
			} else {
				template = template.replace("{{ scam.screenshot }}",'');
			}
	   } else {
            template = template.replace("{{ scam.googlethreat }}", '');
			template = template.replace("{{ scam.screenshot }}",'');
        }
        actions_text += '<a target="_blank" href="https://github.com/' + config.repository.author + '/' + config.repository.name + '/blob/' + config.repository.branch + '/_data/scams.yaml" class="ui icon secondary button"><i class="write alternate icon"></i> Improve</a><button id="share" class="ui icon secondary button"><i class="share alternate icon"></i> Share</button>';
        template = template.replace("{{ scam.actions }}", '<div id="actions" class="eight wide column">' + actions_text + '</div>');
		if('Google_SafeBrowsing_API_Key' in config && config.Google_SafeBrowsing_API_Key) {
			var options = {
				uri: 'https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' + config.Google_SafeBrowsing_API_Key,
				method: 'POST',
				json: {
					client: {
						clientId: "Ethereum Scam Database",
						clientVersion: "1.0.0"
					},
					threatInfo: {
						threatTypes: ["THREAT_TYPE_UNSPECIFIED", "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
						platformTypes: ["ANY_PLATFORM"],
						threatEntryTypes: ["THREAT_ENTRY_TYPE_UNSPECIFIED", "URL", "EXECUTABLE"],
						threatEntries: [{
							"url": scam.url
						}]
					}
				}
			};
			request(options, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if('matches' in body && 0 in body.matches) {
						template = template.replace("{{ scam.googlethreat }}","<span class='class_offline'>Blocked for " + body.matches[0]['threatType'] + '</span>');
					} else {
						template = template.replace("{{ scam.googlethreat }}","<span class='class_active'>Not Blocked</span> <a target='_blank' href='https://safebrowsing.google.com/safebrowsing/report_phish/'><i class='warning sign icon'></i></a>");
					}
				}
				res.send(default_template.replace('{{ content }}', template));
			});
		} else {
			console.log("Warning: No Google Safe Browsing API key found");
			res.send(default_template.replace('{{ content }}', template));
		}
    });

    app.get('/ip/:ip/', function(req, res) { // Serve /ip/<ip>/
        let template = fs.readFileSync('./_layouts/ip.html', 'utf8');
        template = template.replace("{{ ip.ip }}", req.params.ip);
        var related = '';
        getCache().scams.filter(function(obj) {
            return obj.ip === req.params.ip;
        }).forEach(function(value) {
            related += "<div class='item'><a href='/scam/" + value.id + "/'>" + value.name + "</div>";
        });
        template = template.replace("{{ ip.scams }}", '<div class="ui bulleted list">' + related + '</div>');
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/address/:address/', function(req, res) { // Serve /address/<address>/
        let template = fs.readFileSync('./_layouts/address.html', 'utf8');
        template = template.replace("{{ address.address }}", req.params.address);
        var related = '';
        getCache().scams.filter(function(obj) {
            if ('addresses' in obj) {
                return obj.addresses.includes(req.params.address);
            } else {
                return false;
            }
        }).forEach(function(value) {
            related += "<div class='item'><a href='/scam/" + value.id + "/'>" + value.name + "</div>";
        });
        template = template.replace("{{ address.scams }}", '<div class="ui bulleted list">' + related + '</div>');
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/redirect/:url/', function(req, res) { // Serve /redirect/<url>/
        let template = fs.readFileSync('./_layouts/redirect.html', 'utf8').replace(/{{ redirect.domain }}/g, req.params.url);
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/api/:type/:domain?/', function(req, res) { // Serve /api/<type>/
		res.header('Access-Control-Allow-Origin', '*');
        if (req.params.type == "scams") {
            res.send(JSON.stringify({
                success: true,
                result: getCache().scams
            }));
        } else if (req.params.type == "addresses") {
            res.send(JSON.stringify({
                success: true,
                result: getCache().addresses
            }));
        } else if (req.params.type == "ips") {
            res.send(JSON.stringify({
                success: true,
                result: getCache().ips
            }));
        } else if (req.params.type == "verified") {
            res.send(JSON.stringify({
                success: true,
                result: getCache().legiturls
            }));
        } else if (req.params.type == "blacklist") {
            res.send(JSON.stringify(getCache().blacklist, null, 2));
        } else if (req.params.type == "whitelist") {
            res.send(JSON.stringify(getCache().whitelist, null, 2));
        } else if (req.params.type == "check" && req.params.domain) {
            //They can search for an address or domain.
            if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.domain)) {
                Object.keys(getCache().addresses).forEach(function(address, index) {
                    //They searched for an address
                    if (req.params.domain == address) {
                        res.send(JSON.stringify({
                            success: true,
                            result: 'blocked',
                            type: 'address',
                            entries: getCache().scams.filter(function(scam) {
                                if ('addresses' in scam) {
                                    return (scam.addresses.includes(req.params.domain));
                                } else {
                                    return false;
                                }
                            })
                        }));
                    }
                });
            } else {
                //They searched for a domain or an ip address
                if (getCache().whitelist.includes(url.parse(req.params.domain).hostname) || getCache().whitelist.includes(req.params.domain)) {
                    res.send(JSON.stringify({
                        success: true,
                        input: url.parse(req.params.domain).hostname || req.params.domain,
                        result: 'verified'
                    }));
                } else if (getCache().blacklist.includes(url.parse(req.params.domain).hostname) || getCache().blacklist.includes(req.params.domain.replace(/(^\w+:|^)\/\//, ''))) {
                    if (/^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(req.params.domain.replace(/(^\w+:|^)\/\//, ''))) {
                        //They searched for an ip address
                        res.send(JSON.stringify({
                            success: true,
                            input: req.params.domain.replace(/(^\w+:|^)\/\//, ''),
                            result: 'blocked',
                            type: 'ip',
                            entries: getCache().scams.filter(function(scam) {
                                return (url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain || scam.ip == req.params.domain.replace(/(^\w+:|^)\/\//, ''));
                            }) || false
                        }));
                    } else {
                        //They searched for a domain
                        res.send(JSON.stringify({
                            success: true,
                            input: url.parse(req.params.domain).hostname || req.params.domain,
                            result: 'blocked',
                            type: 'domain',
                            entries: getCache().scams.filter(function(scam) {
                                return (url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain);
                            }) || false
                        }));
                    }
                } else {
                    res.send(JSON.stringify({
                        success: true,
                        result: 'neutral'
                    }));
                }
            }
        } else if (req.params.type == "abusereport" && req.params.domain) {
            var results = getCache().scams.filter(function(scam) {
                return (url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain);
            }) || false;
            if (results.length == 0) {
                res.send(JSON.stringify({
                    success: false,
                    error: "URL wasn't found"
                }));
            } else {
                res.send(JSON.stringify({
                    success: true,
                    result: generateAbuseReport(results[0])
                }));
            }
        } else {
            res.send(JSON.stringify({
                success: false,
                error: 'Unknown API type'
            }));
        }
    });
	
	app.get('/update/', function(req, res) { // New github update?
		if('hook' in req.body && 'config' in req.body.hook && 'secret' in req.body.hook.config && 'Github_Hook_Secret' in config && config.Github_Hook_Secret && config.Github_Hook_Secret == req.body.hook.config.secret) {
			download("https://raw.githubusercontent.com/" + config.repository.author + "/" + config.repository.name + "/" + config.repository.branch + "/_data/scams.yaml", { directory: "_data/", filename: "scams.yaml" }, function(err){
				if (err) throw err;
				download("https://raw.githubusercontent.com/" + config.repository.author + "/" + config.repository.name + "/" + config.repository.branch + "/_data/legit_urls.yaml", { directory: "_data/", filename: "legit_urls.yaml" }, function(err){
					if (err) throw err;
						res.status(200).end();
						spawn('node', ['update.js']);
					});
			});
		} else {
			res.status(500).end();
			console.log('Failed update attempt');
		}
    });

    app.get('*', function(req, res) { // Serve all other pages as 404
        res.status(404).send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/404.html', 'utf8')));
    });

    app.listen(config.port, function() { // Listen on port (defined in config)
        console.log('Content served on http://localhost:' + config.port);
    });
}

if (2 in process.argv) {
    if (process.argv[2] == "--clean") {
        rimraf('_cache', function() {
            console.log("Cleared cache");
        });
    } else if (process.argv[2] == "--update") {
        if (fs.existsSync("_cache/cache.json") && cache) {
            spawn('node', ['update.js']);
        } else {
            console.log("Another update is already in progress...");
        }
    } else {
        console.log("Unsupported flag: " + process.argv[2]);
    }
} else {
    /* Update the local cache using the external cache every 60 seconds */
    setInterval(function() {
        if (fs.existsSync('_cache/cache.json')) {
            fs.readFile('_cache/cache.json', function(err, data) {
                cache = JSON.parse(data);
            });
        }
    }, 60000);
    getCache(function() {
        startWebServer();
    });
}
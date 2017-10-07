'use strict';

const fs = require('fs');
const express = require('express');
const dateFormat = require('dateformat');
const url = require('url');
const spawn = require('child_process').spawn;
const metamaskBlocked = require('eth-phishing-detect');
const app = express();
const default_template = fs.readFileSync('./_layouts/default.html', 'utf8');
let cache;

/* See if there's an up-to-date cache, otherwise run `update.js` to create one. */
function getCache(callback = false) {
    if (!fs.existsSync('_data/cache.json')) {
        console.log("No cache file found. Creating one...");
        if (callback) {
            spawn('node', ['update.js']);
            let checkDone = setInterval(function() {
                if (fs.existsSync('_data/cache.json')) {
                    cache = JSON.parse(fs.readFileSync('_data/cache.json'));
                    clearInterval(checkDone);
                    console.log("Successfully updated cache!");
                    callback();
                }
            }, 1000);
        } else {
            spawn('node', ['update.js']);
        }
    } else if (!cache) {
        cache = JSON.parse(fs.readFileSync('_data/cache.json'));
        if (callback) {
            callback();
        }
    } else if ((new Date().getTime() - cache.updated) < 1000 * 60 * 60 * 2) {
        return cache;
    } else if ((new Date().getTime() - cache.updated) >= 1000 * 60 * 60 * 2) {
        spawn('node', ['update.js']);
        return cache;
    }
}

/* Generate an abuse report for a scam domain */
function generateAbuseReport(scam) {
    let abusereport = "";
    abusereport += "I would like to inform you of suspicious activities at the domain " + url.parse(scam['url']).hostname;
    if ('ip' in scam) {
        abusereport += " located at IP address " + scam['ip'] + ".";
    } else {
        abusereport += ".";
    }
    if ('subcategory' in scam && scam['subcategory'] == "MyEtherWallet") {
        abusereport += "The domain is impersonating MyEtherWallet.com, a website where people can create Ethereum wallets (a cryptocurrency like Bitcoin).";
    } else if ('subcategory' in scam && scam['subcategory'] == "Classic Ether Wallet") {
        abusereport += "The domain is impersonating classicetherwallet.com, a website where people can create Ethereum Classic wallets (a cryptocurrency like Bitcoin).";
    } else if ('category' in scam && scam['category'] == "Fake ICO") {
        abusereport += "The domain is impersonating a website where an ICO is being held (initial coin offering, like an initial public offering but it's for cryptocurrencies).";
    }
    if ('category' in scam && scam['category'] == "Phishing") {
        abusereport += "\r\n\r\nThe attackers wish to steal funds by using phishing to get the victim's private keys (passwords to a wallet) and using them to send funds to their own wallets.";
    } else if ('category' in scam && scam['category'] == "Fake ICO") {
        abusereport += "\r\n\r\nThe attackers wish to steal funds by cloning the real website and changing the ethereum address so people will send funds to the attackers' address instead of the real address.";
    }
    abusereport += "\r\n\r\nPlease shut down this domain so further attacks will be prevented.";
    return abusereport;
}

/* Start the web server */
function startWebServer() {
    app.use(express.static('_static')); // Serve all static pages first

    app.get('/(/|index.html)?', function(req, res) { // Serve index.html
        res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/index.html', 'utf8')));
    });

    app.get('/search/', function(req, res) { // Serve /search/
        let table = "";
        getCache().legiturls.sort(function(a, b) {
            return a.name - b.name;
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
		if(!req.params.sorting || req.params.sorting == 'latest') {
			var scams = getCache().scams.sort(function(a,b) { return b.id-a.id; });
		} else if(req.params.sorting == 'oldest') {
			var scams = getCache().scams.sort(function(a,b) { return a.id-b.id; });
		} else if(req.params.sorting == 'status') {
			var scams = getCache().scams.sort(function(a,b) {
				if('status' in a && 'status' in b) {
					if(a.status == 'Active' && b.status != 'Active' || a.status == 'Suspended' && b.status == 'Offline')  {
						return -1;
					} else if(a.status == b.status) {
						return 0;
					} else {
						return 1;
					}
				} else {
					return 1;
				}
			});
		} else if(req.params.sorting == 'category') {
			var scams = getCache().scams.sort(function(a,b) {
				if('category' in a && 'category' in b) {
					console.log(a.id + ' ' + a.category + ' ' + b.category + ' ' + a.category.localeCompare(b.category));
					return a.category.localeCompare(b.category);
				} else {
					return -1;
				}
			});
		}
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
				if(req.params.sorting) {
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
        } else {
            strPagination = "";
        }
        template = template.replace("{{ scams.pagination }}", "<div class='ui pagination menu'>" + strPagination + "</div>");
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/scam/:id/', function(req, res) { // Serve /scam/<id>/
		let scam = getCache().scams.find(function(scam) { return scam.id == req.params.id; });
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
            template = template.replace("{{ scam.url }}", '<b>URL</b>: <a id="url" target="_blank" href="/redirect/' + encodeURIComponent(scam.url) + '">' + scam.url + '</a><BR>');
            template = template.replace("{{ scam.googlethreat }}", "<b>Google Safe Browsing</b>: <span id='googleblocked'>loading...</span><BR>");
            template = template.replace("{{ scam.metamask }}", "<b>MetaMask Status:</b> "+(metamaskBlocked(url.parse(scam.url).hostname)?"<span style='color:green'>Blocked</span>":"<span style='color:red'>Not Blocked</span>")+"<br />");
			actions_text += '<a target="_blank" href="http://web.archive.org/web/*/"' + scam.url + ' class="ui icon secondary button"><i class="archive icon"></i> Archive</a>';
        } else {
            template = template.replace("{{ scam.googlethreat }}", '');
        }
		if(actions_text != "") {
			template = template.replace("{{ scam.actions }}", '<div id="actions" class="eight wide column">' + actions_text + '</div>');
		} else {
			template = template.replace("{{ scam.actions }}", '');
		}
        res.send(default_template.replace('{{ content }}', template));
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
            if(/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.domain)) {
                Object.keys(getCache().addresses).forEach(function(address, index) {
                    //They searched for an address
                    if (req.params.domain == address) {
                        res.send(JSON.stringify({
                            success: true,
                            result: 'blocked',
                            type: 'address',
                            entries: getCache().scams.filter(function (scam) {
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
				} else if (getCache().blacklist.includes(url.parse(req.params.domain).hostname) || getCache().blacklist.includes(req.params.domain.replace(/(^\w+:|^)\/\//,''))) {
					if(/^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(req.params.domain.replace(/(^\w+:|^)\/\//,''))) {
						//They searched for an ip address
						res.send(JSON.stringify({
							success: true,
							input: req.params.domain.replace(/(^\w+:|^)\/\//,''),
							result: 'blocked',
							type: 'ip',
							entries: getCache().scams.filter(function(scam) {
								return (url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url == req.params.domain || scam.ip == req.params.domain.replace(/(^\w+:|^)\/\//,''));
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
								return (url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url == req.params.domain || scam.ip == req.params.domain.replace(/(^\w+:|^)\/\//,''));
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
		} else if(req.params.type == "abusereport") {
			res.send(JSON.stringify({
				success: true,
				result: generateAbuseReport(getCache().scams.find(function(scam) { return (scam.url == req.params.domain); }))
			}));
        } else {
            res.send(JSON.stringify({
                success: false,
                error: 'Unknown API type'
            }));
        }
    });

    app.get('*', function(req, res) { // Serve all other pages as 404
        res.status(404).send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/404.html', 'utf8')));
    });

    app.listen(8080, function() { // Listen on port 8080
        console.log('Content served on http://localhost:8080');
    });
}

if (2 in process.argv) {
    if (process.argv[2] == "--clean") {
        fs.unlinkSync('_data/cache.json');
		console.log("Cleared cache");
	} else if(process.argv[2] == "--update") {
		if(fs.existsSync("_data/cache.json") && cache) {
			spawn('node', ['update.js']);
		} else {
			console.log("Another update is already in progress...");
		}
    } else if (process.argv[2] == "--archive") {
		var timeout = 0;
		console.log("Sending all pages to archive.org...");
		fs.readFile("./_site/data/scams.json", function(err, data) {
			data = shuffle(JSON.parse(data));
			data.forEach(function(val, key) {
				if ('url' in data[key] && 'status' in data[key] && data[key]['status'][0]['status'] == "Active") {
					timeout++;
					setTimeout(function() {
						request("https://web.archive.org/save/" + data[key]['url'], function(e, response) {
                            console.log("Archived " + data[key]['url']);
						});
					}, timeout * 10000);
				}
			});
		});
    } else {
        console.log("Unsupported flag: " + process.argv[2]);
    }
} else {
	setInterval(function() {
		if (fs.existsSync('_data/cache.json')) {
			fs.readFile('_data/cache.json', function(err, data) {
				cache = JSON.parse(data);
			});
		}
	}, 60000);
    getCache(function() {
		startWebServer();
	});
}
'use strict';

const fs = require('fs');
const express = require('express');
const dateFormat = require('dateformat');
const url = require('url');
const spawn = require('child_process').spawn;
const app = express();
const default_template = fs.readFileSync('./_layouts/default.html', 'utf8');
let cache;

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
			},1000);
        } else {
            spawn('node', ['update.js']);
        }
	} else if(!cache) {
		cache = JSON.parse(fs.readFileSync('_data/cache.json'));
		if(callback) {
			callback();
		}
    } else if ((new Date()).getTime() - cache.updated < 1000 * 60 * 60 * 2) {
        return cache;
    } else if ((new Date()).getTime() - cache.updated >= 1000 * 60 * 60 * 2) {
		spawn('node', ['update.js']);
        return cache;
    }
}

function startWebServer() {
    app.use(express.static('_static'))

    app.get('/(/|index.html)?', function(req, res) {
        res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/index.html', 'utf8')));
    });

    app.get('/search/', function(req, res) {
        let table = "";
        getCache().legiturls.forEach(function(url) {
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

    app.get('/faq/', function(req, res) {
        res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/faq.html', 'utf8')));
    });

    app.get('/redirect/:domain/', function(req, res) {
        var template = fs.readFileSync('./_layouts/redirect.html', 'utf8').replace(/{{ redirect.url }}/g, req.params.domain);
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/report/:type?/', function(req, res) {
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

    app.get('/scams/:page?/:sorting?/', function(req, res) {
            let template = fs.readFileSync('./_layouts/scams.html', 'utf8');
			let scams = getCache().scams;
            template = template.replace("{{ scams.total }}", scams.length);
            template = template.replace("{{ scams.active }}", 0);
            let addresses = {};
            scams.forEach(function(scam, index) {
                if ('addresses' in scam) {
                    scams[index].addresses.forEach(function(address) {
                        addresses[address] = true;
                    });
                }
            });
            template = template.replace("{{ addresses.total }}", Object.keys(addresses).length);
            template = template.replace("{{ scams.inactive }}", 0);
            var table = "";
			if(req.params.page == "all") {
				var max = scams.length;
				var start = 0;
			} else if(!isNaN(parseInt(req.params.page))) {
				var max = (req.params.page*30)+30;
				var start = req.params.page*30;
			} else {
				var max = 30;
				var start = 0;
			}
            for (var i = start; i <= max; i++) {
				if('status' in scams[i]) {
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
			var pagination = "";
			if (req.params.page == 0) {
                                    var loop = [1, 6];
                                } else if (req.params.page == 1) {
                                    var loop = [0, 5];
                                } else {
                                    var loop = [-1, 4];
                                }
                                for (var i = loop[0]; i < loop[1]; i++) {
                                    var item_class = "item";
                                    var href = "/scams/" + (req.params.page + i) + "/";
                                    if ((req.params.page + i) > (scams.length)/30 || (req.params.page + i) < 1) {
                                        item_class = "disabled item";
                                        href = "#";
                                    } else if (i == 1) {
                                        item_class = "active item";
                                    }
                                    pagination += "<a href='" + href + "' class='" + item_class + "'>" + (req.params.page + i) + "</a>";
                                }
            template = template.replace("{{ scams.pagination }}", "<div class='ui pagination menu'>" + pagination + "</div>");
            res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/scam/:id/', function(req, res) {
		let scam = getCache().scams_by_id[req.params.id];
		let template = fs.readFileSync('./_layouts/scam.html', 'utf8');
		/*['id','url','category','description','status','ip','nameservers','addresses'].forEach(function(name) {
			if(name in scam) {
				template = template.replace("{{ scam." + name + " }}",scam[name]);
			} else {
				template = template.replace("{{ scam." + name + " }}",'');
			}
		});*/
		template = template.replace("{{ scam.id }}",scam.id);
		template = template.replace("{{ scam.name }}",scam.name);
		if('category' in scam) {
			if('subcategory' in scam) {
				template = template.replace("{{ scam.category }}",'<b>Category</b>: ' + scam.category + ' - ' + scam.subcategory + '<BR>');
			} else {
				template = template.replace("{{ scam.category }}",'<b>Category</b>: ' + scam.category + '<BR>');
			}
		} else {
			template = template.replace("{{ scam." + name + " }}",'');
		}
		if('description' in scam) {
			template = template.replace("{{ scam.description }}",'<b>Description</b>: ' + scam.description + '<BR>');
		} else {
			template = template.replace("{{ scam.description }}",'');
		}
		if('ip' in scam) {
			template = template.replace("{{ scam.ip }}",'<b>IP</b>: ' + scam.ip + '<BR>');
		} else {
			template = template.replace("{{ scam.ip }}",'');
		}
		if('url' in scam) {
			template = template.replace("{{ scam.url }}",'<b>URL</b>: <a id="url" target="_blank" href="/redirect/?url=' + encodeURIComponent(scam.url) + '">' + scam.url + '</a><BR>');
			template = template.replace("{{ scam.googlethreat }}","<b>Google Safe Browsing</b>: <span id='googleblocked'>loading...</span><BR>");
		} else {
			template = template.replace("{{ scam.googlethreat }}",'');
		}
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/ip/:ip/', function(req, res) {
        let template = fs.readFileSync('./_layouts/ip.html', 'utf8').replace("{{ ip.ip }}", req.params.ip);
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/address/:address/', function(req, res) {
        let template = fs.readFileSync('./_layouts/address.html', 'utf8').replace(/{{ address.address }}/g, req.params.address);
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/api/:type/:domain?/', function(req, res) {
        if (req.params.type == "scams") {
            res.send(JSON.stringify({
                success: true,
                result: getCache().scams
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
			if (getCache().whitelist.includes(url.parse(req.params.domain).hostname) || getCache().whitelist.includes(req.params.domain)) {
				res.send(JSON.stringify({
					success: true,
					result: 'verified'
				}));
			} else if (getCache().blacklist.includes(url.parse(req.params.domain).hostname)|| getCache().blacklist.includes(req.params.domain)) {
				res.send(JSON.stringify({
					success: true,
					result: 'blocked',
					id: getCache().scams.find(function(scam) { if(url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url == req.params.domain || true) { return scam.id; } }) || false
				}));
			} else {
				res.send(JSON.stringify({
					success: true,
					result: 'neutral'
				}));
			}
        } else {
            res.send(JSON.stringify({
                success: false,
                error: 'Unknown API type'
            }));
        }
    });

    app.listen(8080, function() {
        console.log('Content served on http://localhost:8080');
    });
}

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
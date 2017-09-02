'use strict';

/* Import libraries and assign constants */
const url = require('url');
const yaml = require('js-yaml');
const fs = require('graceful-fs');
const dateFormat = require('dateformat');
const dns = require('dns');
const request = require("request")
const connect = require('connect');
const serveStatic = require('serve-static');
const htmlmin = require('htmlmin');
const startTime = (new Date()).getTime();
const data = yaml.safeLoad(fs.readFileSync('./_data/scams.yaml'));
const legiturls = yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml'));
const template = fs.readFileSync('./_layouts/default.html', 'utf8');

/* Assign variables */
let port = 8080; // Port that will be used for `--serve`
let minify = false; // Minifying content can take some time to do but will improve serving content
let job = false;
let total = 0;

/* Shuffle for functions that make lots of http requests */
function shuffle(a) {
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
    return a;
}

/* Delete folder and contents for --clean */
var deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

/* --clean function */
function clean() {
    console.log("Cleaning...");
    deleteFolderRecursive("_site");
    console.log("Project cleaned.");
}

/* Compile archive.yaml */
function compile_archive() {
    console.log("Compiling archive file...");
    let archive = {};
    fs.readFile("./_data/archive_compiled.yaml", 'utf8', function(err, old_archive) {
        if (!err && typeof old_archive !== 'undefined') {
            var old_archive = yaml.safeLoad(old_archive);
        }
        shuffle(Object.keys(data)).forEach(function(key) {
            archive[data[key]['id']] = {};
            if (typeof old_archive !== 'undefined' && data[key]['id'] in old_archive) {
                if ('status' in old_archive[data[key]['id']]) {
                    archive[data[key]['id']]['status'] = old_archive[data[key]['id']]['status'];
                }
                if ('nameservers' in old_archive[data[key]['id']]) {
                    archive[data[key]['id']]['nameservers'] = old_archive[data[key]['id']]['nameservers'];
                }
                if ('ip' in old_archive[data[key]['id']]) {
                    archive[data[key]['id']]['ip'] = old_archive[data[key]['id']]['ip'];
                }
            }
            if (!('status' in archive[data[key]['id']]) && !('status' in data[key]) && job != "update") {
                archive[data[key]['id']]['status'] = [{
                    "time": (new Date()).getTime(),
                    "status": "Unknown"
                }];
            } else if (!('status' in archive[data[key]['id']]) && !('status' in data[key]) && job == "update") {
                archive[data[key]['id']]['status'] = [];
            } else if (!('status' in archive[data[key]['id']]) && 'status' in data[key]) {
                archive[data[key]['id']]['status'] = [{
                    "time": (new Date()).getTime(),
                    "status": data[key]['status']
                }];
            } else if ('status' in archive[data[key]['id']] && 'status' in data[key] && data[key]['status'] != archive[data[key]['id']]['status'][0]['status']) {
                archive[data[key]['id']]['status'].unshift([{
                    "time": (new Date()).getTime(),
                    "status": data[key]['status']
                }]);
            }
            if ('url' in data[key] && job == "update") {
                dns.lookup(url.parse(data[key]['url']).hostname, (err, address, family) => {
                    if (!err) {
                        archive[data[key]['id']]['ip'] = address;
                    }
                    dns.resolveNs(url.parse(data[key]['url']).hostname, (err, addresses) => {
                        if (!err) {
                            archive[data[key]['id']]['nameservers'] = addresses.sort();
                        }
                        var r = request(data[key]['url'], function(e, response, body) {
                            if ((e || response.statusCode != 200) && (archive[data[key]['id']]['status'].length == 0 || archive[data[key]['id']]['status'][0]['status'] != "Offline")) {
                                archive[data[key]['id']]['status'].unshift({
                                    "time": (new Date()).getTime(),
                                    "status": "Offline"
                                });
                            } else if (r.uri.href.indexOf('cgi-sys/suspendedpage.cgi') !== -1 && (archive[data[key]['id']]['status'].length == 0 || archive[data[key]['id']]['status'][0]['status'] != "Suspended")) {
                                archive[data[key]['id']]['status'].unshift({
                                    "time": (new Date()).getTime(),
                                    "status": "Suspended"
                                });
                            } else if ((archive[data[key]['id']]['status'].length == 0 || archive[data[key]['id']]['status'][0]['status'] != "Active") && !e && response.statusCode == 200 && r.uri.href.indexOf('cgi-sys/suspendedpage.cgi') === -1) {
                                archive[data[key]['id']]['status'].unshift({
                                    "time": (new Date()).getTime(),
                                    "status": "Active"
                                });
                            }
                            writeToArchive(archive);
                        });
                    });
                });
            } else {
                writeToArchive(archive);
            }
        });
    });
}

/* Write to archive if loop ended */
function writeToArchive(archive) {
    total++;
    if (total == Object.keys(data).length) {
        fs.writeFile("./_data/archive_compiled.yaml", yaml.safeDump(archive), function(err) {
            if (err) {
                return console.log(err);
            }
            console.log("Archive file generated.");
            if (job == "build" || job == "update" || job == "archive" || job == false) {
                yaml2json();
            } else {
                finish();
            }
        });
    }
}

/* Convert data.yaml and archive.yaml to scams.json, ips.json, addresses.json, blacklist.json, whitelist.json and search.json */
function yaml2json() {
    console.log("Converting YAML to JSON...");
    let addresses = {};
    let ips = {};
	let blacklist = [];
	let whitelist = [];
    let search = {
        "success": true,
        "results": []
    };
    fs.readFile("./_data/archive_compiled.yaml", function(err, archive) {
        var archive = yaml.safeLoad(archive);
		Object.keys(legiturls).forEach(function(key) {
			whitelist.push(legiturls[key]['url'].toLowerCase().replace('www.','').replace(/(^\w+:|^)\/\//, ''));
			whitelist.push('www.' + legiturls[key]['url'].toLowerCase().replace('www.','').replace(/(^\w+:|^)\/\//, ''));
		});
        Object.keys(data).reverse().forEach(function(key) {
            search.results.push({
                "name": data[key]['name'],
                "value": data[key]['id'].toString()
            });
            if ('addresses' in data[key]) {
                data[key]['addresses'].forEach(function(addr) {
                    if (!(addr in addresses)) {
                        addresses[addr] = [];
                    }
                    addresses[addr].unshift(data[key]['id']);
                });
            }
			if('url' in data[key]) {
				blacklist.push(data[key]['url'].toLowerCase().replace(/(^\w+:|^)\/\//, ''));
				blacklist.push('www.' + data[key]['url'].toLowerCase().replace(/(^\w+:|^)\/\//, ''));
			}
            if (data[key]['id'] in archive) {
                if ("ip" in archive[data[key]['id']]) {
                    if (!(archive[data[key]['id']]['ip'] in ips)) {
                        ips[archive[data[key]['id']]['ip']] = [];
                    }
                    ips[archive[data[key]['id']]['ip']].unshift(data[key]['id']);
                    data[key]['ip'] = archive[data[key]['id']]['ip'];
                }
                if ("nameservers" in archive[data[key]['id']]) {
                    data[key]['nameservers'] = archive[data[key]['id']]['nameservers'];
                }
                if ("status" in archive[data[key]['id']]) {
                    data[key]['status'] = archive[data[key]['id']]['status'];
                }
            }
        });
        if (job == "build" || job == false) {
            if (!fs.existsSync("./_site")) {
                fs.mkdirSync("./_site/");
            }
            if (!fs.existsSync("./_site/data")) {
                fs.mkdirSync("./_site/data");
            }
            fs.writeFileSync("./_site/data/search.json", JSON.stringify(search));
            console.log("Search results file compiled.");
        }
        fs.writeFile("./_site/data/scams.json", JSON.stringify(data), function(err) {
            console.log("Scam file compiled.");
            fs.writeFile("./_site/data/addresses.json", JSON.stringify(addresses), function(err) {
                console.log("Address file compiled.");
                fs.writeFile("./_site/data/ips.json", JSON.stringify(ips), function(err) {
                    console.log("IPs file compiled.");
					fs.writeFile("./_site/data/blacklist.json", JSON.stringify(blacklist, null, "  "), function(err) {
						console.log("Blacklist file compiled.");
						fs.writeFile("./_site/data/whitelist.json", JSON.stringify(whitelist, null, "  "), function(err) {
							console.log("Whitelist file compiled.");
							if (job == "build" || job == false) {
								generatestatic();
							} else if (job == "update") {
								finish("updating");
							} else if (job == "archive") {
								archiveorg();
							}
						});
					});
                });
            });
        });
    });
}

/* --archive, sends all active domains to archive.org to save them */
function archiveorg() {
    var timeout = 0;
    console.log("Sending all pages to archive.org...");
    fs.readFile("./_site/data/scams.json", function(err, data) {
        data = shuffle(JSON.parse(data));
        data.forEach(function(val, key) {
            if ('url' in data[key] && 'status' in data[key] && data[key]['status'][0]['status'] == "Active") {
                timeout++;
                setTimeout(function() {
                    request("https://web.archive.org/save/" + data[key]['url'], function(e, response) {
                        if (e) {
                            throw e;
                        } else {
                            console.log("Archived " + data[key]['url']);
                        }
                    });
                }, timeout * 10000);
            }
        });
    });
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

/* Use all json files to generate html files */
function generatestatic() {
    console.log("Generating unique pages...");
    const scams = JSON.parse(fs.readFileSync('./_site/data/scams.json'));
    const addresses = JSON.parse(fs.readFileSync('./_site/data/addresses.json'));
    const ips = JSON.parse(fs.readFileSync('./_site/data/ips.json'));
    const layout_scams = fs.readFileSync('./_layouts/scam.html', 'utf8');
    const layout_addresses = fs.readFileSync('./_layouts/address.html', 'utf8');
    const layout_ips = fs.readFileSync('./_layouts/ip.html', 'utf8');
    if (!fs.existsSync("./_site")) {
        fs.mkdirSync("./_site/");
    }
    if (!fs.existsSync("./_site/scam/")) {
        fs.mkdirSync("./_site/scam/");
    }
    for (var key = 0, len = scams.length; key < len; key++) {
        var layout = template.replace("{{ content }}", layout_scams);
        var sc_nameservers = "";
        var sc_addresses = "";
        var history = "";
        var actions = "<button id='share' class='ui icon secondary button'><i class='share alternate icon'></i> Share</button>";
        if ("nameservers" in scams[key]) {
            scams[key]['nameservers'].forEach(function(nameindex) {
                sc_nameservers += "<div class='item'>" + nameindex + '</div>';
            });
            if (sc_nameservers) {
                layout = layout.replace(/{{ scam.nameservers }}/ig, '<b>Nameservers</b>: <div class="ui bulleted list">' + sc_nameservers + '</div>');
            }
        } else {
            layout = layout.replace(/{{ scam.nameservers }}/ig, "");
        }
        if ("addresses" in scams[key]) {
            scams[key]['addresses'].forEach(function(nameindex) {
                sc_addresses += "<div class='item'><a href='/address/" + nameindex + "'>" + nameindex + "</a></div>";
            });
            if (sc_addresses) {
                layout = layout.replace(/{{ scam.addresses }}/ig, '<b>Related addresses</b>: <div class="ui bulleted list">' + sc_addresses + '</div>');
            }
        } else {
            layout = layout.replace(/{{ scam.addresses }}/ig, "");
        }
        if ("status" in scams[key]) {
            if (scams[key]['status'][0]['status'] != "Unknown") {
                scams[key]['status'].forEach(function(nameindex) {
                    var st = nameindex['status'];
                    if (st == "Active") {
                        st = '<i class="checkmark icon"></i> Active';
                    } else if (st == "Offline") {
                        st = '<i class="remove icon"></i> Offline';
                    } else if (st == "Suspended") {
                        st = '<i class="warning sign icon"></i> Suspended';
                    }
                    history += "<tr><td class='" + nameindex['status'].toLowerCase().replace('active', 'activ') + "'>" + st + "</td><td>" + dateFormat(nameindex['time'], "mmmm dS, yyyy, HH:MM:ss Z", true) + "</td></tr>"
                });
                actions = '<button id="history" class="ui icon secondary button"><i class="history icon"></i> History</button>' + actions
                layout = layout.replace(/{{ scam.history }}/ig, '<table class="ui celled table"><thead><tr><th>Status</th><th>Date</th></tr></thead><tbody>' + history + '</tbody></table>');
                layout = layout.replace(/{{ scam.status }}/ig, "<b>Status</b>: <span class='" + scams[key]['status'][0]['status'].toLowerCase().replace('active', 'activ') + "'>" + scams[key]['status'][0]['status'] + "</span> (" + dateFormat(scams[key]['status'][0]['time'], "mmmm dS, yyyy, HH:MM:ss Z", true) + ")<BR>");
            } else {
                layout = layout.replace(/{{ scam.history }}/ig, "");
                layout = layout.replace(/{{ scam.status }}/ig, "");
            }
        } else {
            layout = layout.replace(/{{ scam.history }}/ig, "");
            layout = layout.replace(/{{ scam.status }}/ig, "");
        }
        if ("description" in scams[key]) {
            layout = layout.replace(/{{ scam.description }}/ig, "<b>Description</b>: " + scams[key]['description'] + "<BR>");
        } else {
            layout = layout.replace(/{{ scam.description }}/ig, "");
        }
        if ("ip" in scams[key]) {
            layout = layout.replace(/{{ scam.ip }}/ig, '<b>IP</b>: <a href="/ip/' + scams[key]['ip'] + '">' + scams[key]['ip'] + '</a><BR>');
        } else {
            layout = layout.replace(/{{ scam.ip }}/ig, "");
        }
        if ("category" in scams[key]) {
            if ("subcategory" in scams[key]) {
                layout = layout.replace(/{{ scam.category }}/ig, "<b>Category</b>: " + scams[key]['category'] + " - " + scams[key]['subcategory'] + "<BR>");
            } else {
                layout = layout.replace(/{{ scam.category }}/ig, "<b>Category</b>: " + scams[key]['category'] + "<BR>");
            }
        } else {
            layout = layout.replace(/{{ scam.category }}/ig, "");
        }
        if ("url" in scams[key]) {
            actions = '<a target="_blank" href="http://web.archive.org/web/*/' + encodeURIComponent(url.parse(scams[key]['url']).hostname) + '" class="ui icon secondary button"><i class="archive icon"></i> Archive</a>' + actions
            layout = layout.replace(/{{ scam.url }}/ig, '<b>URL</b>: <a id="url" target="_blank" href="/redirect/?url=' + encodeURIComponent(scams[key]['url']) + '">' + scams[key]['url'] + '</a><BR>');
            layout = layout.replace(/{{ scam.ethaddresslookup }}/ig, "<b>EtherAddressLookup</b>: <span id='blocked'>loading...</span><BR>");
            layout = layout.replace(/{{ scam.googlethreat }}/ig, "<b>Google Safe Browsing</b>: <span id='googleblocked'>loading...</span><BR>");

            if ("status" in scams[key] && scams[key]['status'][0]['status'] == "Active") {
                actions = '<button id="gen" class="ui icon secondary button"><i class="setting icon"></i> Abuse Report</button>' + actions
                layout = layout.replace(/{{ scam.abusereport }}/ig, generateAbuseReport(scams[key]));
            } else {
                layout = layout.replace(/{{ scam.abusereport }}/ig, "");
            }
        } else {
            layout = layout.replace(/{{ scam.url }}/ig, "");
            layout = layout.replace(/{{ scam.abusereport }}/ig, "");
            layout = layout.replace(/{{ scam.ethaddresslookup }}/ig, "");
            layout = layout.replace(/{{ scam.googlethreat }}/ig, "");
        }
        layout = layout.replace(/{{ scam.id }}/ig, scams[key]['id']);
        layout = layout.replace(/{{ scam.history }}/ig, history);
        layout = layout.replace(/{{ scam.actions }}/ig, actions);
        layout = layout.replace(/{{ scam.name }}/ig, scams[key]['name']);
        if (!fs.existsSync("./_site/scam/" + scams[key]['id'] + "/")) {
            fs.mkdirSync("./_site/scam/" + scams[key]['id'] + "/");
        }
        if (minify) {
            layout = htmlmin(layout);
        }
        fs.writeFile("./_site/scam/" + scams[key]['id'] + "/index.html", layout, function(err) {
            if (err) {
                return console.log(err);
            }
        });
    }
    if (!fs.existsSync("./_site/address/")) {
        fs.mkdirSync("./_site/address/");
    }
    Object.keys(addresses).forEach(function(key) {
        var layout = template.replace("{{ content }}", layout_addresses);
        var related = "";
        for (var i = 0, len = addresses[key].length; i < len; i++) {
            related += "<div class='item'><a href='/scam/" + addresses[key][i] + "'>" + data.find(o => o['id'] === addresses[key][i])['name'] + "</a></div>"
        }
        if (related) {
            related = '<div class="ui bulleted list">' + related + '</div>'
        } else {
            related = "None"
        }
        layout = layout.replace(/{{ address.address }}/ig, key);
        layout = layout.replace(/{{ address.scams }}/ig, related);
        if (!fs.existsSync("./_site/address/" + key + "/")) {
            fs.mkdirSync("./_site/address/" + key + "/");
        }
        if (minify) {
            layout = htmlmin(layout);
        }
        fs.writeFile("./_site/address/" + key + "/index.html", layout, function(err) {
            if (err) {
                return console.log(err);
            }
        });
    });
    if (!fs.existsSync("./_site/ip/")) {
        fs.mkdirSync("./_site/ip/");
    }
    Object.keys(ips).forEach(function(key) {
        var layout = template.replace("{{ content }}", layout_ips);
        var related = "";
        for (var i = 0, len = ips[key].length; i < len; i++) {
            related += "<div class='item'><a href='/scam/" + ips[key][i] + "'>" + data.find(o => o['id'] === ips[key][i])['name'] + "</a></div>"
        }
        if (related) {
            related = '<div class="ui bulleted list">' + related + '</div>'
        } else {
            related = "None"
        }
        layout = layout.replace(/{{ ip.ip }}/ig, key);
        layout = layout.replace(/{{ ip.scams }}/ig, related);
        if (!fs.existsSync("./_site/ip/" + key + "/")) {
            fs.mkdirSync("./_site/ip/" + key + "/");
        }
        if (minify) {
            layout = htmlmin(layout);
        }
        fs.writeFile("./_site/ip/" + key + "/index.html", layout, function(err) {
            if (err) {
                return console.log(err);
            }
        });
    });
    console.log("Done generating unique scam pages");
    if (job == "build" || job == false) {
        copyStatic();
    } else {
        finish();
    }
}

/* Copy files from _static to _site */
function copyStatic() {
    console.log("Copying static files...");
    fs.readdirSync("_static").forEach(function(file, index) {
        var curPath = "_static/" + file;
        if (fs.lstatSync(curPath).isDirectory()) {
            if (!fs.existsSync(curPath.replace("_static", "_site"))) {
                fs.mkdirSync(curPath.replace("_static", "_site"));
            }
            fs.readdirSync(curPath).forEach(function(file, index) {
                fs.readFile(curPath + '/' + file, function(err, data) {
                    fs.writeFileSync(curPath.replace("_static", "_site") + '/' + file, data);
                });
            });
        } else {
            fs.readFile("_static/" + file, function(err, data) {
                fs.writeFileSync("_site/" + file, data);
            });
        }
    });
    console.log("Copied to _site.");
    if (job == "build" || job == false) {
        preprocess();
    } else {
        finish();
    }
}

/* Generate all scam pages */
function preprocessScams() {
    let total_2 = 0;
    if (!fs.existsSync("./_site/scams/")) {
        fs.mkdirSync("./_site/scams/");
    }
    fs.readFile('./_layouts/scams.html', 'utf8', function(err, data) {
        const template_1 = template.replace("{{ content }}", data);
        fs.readFile('./_layouts/scams_2.html', 'utf8', function(err, data2) {
            const template_2 = template.replace("{{ content }}", data2);
            fs.readFile('./_site/data/scams.json', 'utf8', function(err, data3) {
                const scams = JSON.parse(data3).sort(
                    function(x, y) {
                        if ('status' in x && 'status' in y) {
                            if (x['status'][0]['time'] < y['status'][0]['time']) {
                                return 1;
                            } else if (x['status'][0]['time'] == y['status'][0]['time']) {
                                return 0;
                            } else {
                                return -1;
                            }
                        } else {
                            return 0;
                        }
                    });
                fs.readFile('./_site/data/addresses.json', 'utf8', function(err, data4) {
                    const addresses = JSON.parse(data4);
                    let pages = [];
                    let active = 0;
                    let inactive = 0;
                    for (var key = 0, len = scams.length; key < len; key++) {
                        total_2++;
                        var layout = "";
                        var color_status = "Unknown"
                        var status = "unknown";
                        if ('status' in scams[key]) {
                            status = scams[key]['status'][0]['status'];
                            if (status == "Active") {
                                status = "offline";
                                color_status = '<i class="warning sign icon"></i> Active';
                                active++;
                            } else if (status == "Offline") {
								status = "activ";
                                color_status = '<i class="checkmark icon"></i> Offline';
                                inactive++;
                            } else if (status == "Suspended") {
                                color_status = '<i class="remove icon"></i> Suspended';
                            }
                        }
                        if ('category' in scams[key]) {
							switch(scams[key]['category']) {
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
									var category = scams[key]['category'];
							}
                        } else {
                            var category = '<i class="remove icon"></i> None';
                        }
                        if ('subcategory' in scams[key]) {
							if(scams[key]['subcategory'].toLowerCase() == "wallets") {
								var subcategory = '<i class="credit card alternative icon"></i> ' + scams[key]['subcategory'];
							} else if(fs.existsSync("_static/img/" + scams[key]['subcategory'].toLowerCase().replace(/\s/g,'') + ".png")) {
								var subcategory = "<img src='/img/" + scams[key]['subcategory'].toLowerCase().replace(/\s/g,'') + ".png' class='subcategoryicon'> " + scams[key]['subcategory'];
							} else {
								console.log("Warning: No subcategory icon was found for " + scams[key]['subcategory']);
								var subcategory = scams[key]['subcategory'];
							}
                        } else {
                            var subcategory = '<i class="remove icon"></i> None';
                        }
                        if (key % 100 === 0) {
                            pages[Math.floor(key / 100)] = "";
                        }
                        pages[Math.floor(key / 100)] += "<tr><td>" + category + "</td><td>" + subcategory + "</td><td class='" + status.toLowerCase() + "'>" + color_status + "</td><td>" + scams[key]['name'] + "</td><td class='center'><a href='/scam/" + scams[key]['id'] + "'><i class='search icon'></i></a></td></tr>";
                        if (total_2 == scams.length) {
                            let all_pages = "";
                            pages.forEach(function(page, index) {
                                all_pages += page;
                            });
                            layout = template_1.replace(/{{ scams.total }}/ig, scams.length);
                            layout = layout.replace(/{{ scams.table }}/ig, all_pages);
                            layout = layout.replace(/{{ scams.pagination }}/ig, "");
                            layout = layout.replace(/{{ scams.active }}/ig, active);
                            layout = layout.replace(/{{ addresses.total }}/ig, Object.keys(addresses).length);
                            layout = layout.replace(/{{ scams.inactive }}/ig, inactive);
                            if (!fs.existsSync("./_site/scams/all/")) {
                                fs.mkdirSync("./_site/scams/all/");
                            }
                            fs.writeFile("./_site/scams/all/index.html", layout, function(err) {
                                if (err) {
                                    return console.log(err);
                                }
                            });
                            pages.forEach(function(page, index) {
                                var pagination = "<div class='ui pagination menu'>";
                                if (index == 0) {
                                    var loop = [1, 6];
                                } else if (index == 1) {
                                    var loop = [0, 5];
                                } else {
                                    var loop = [-1, 4];
                                }
                                for (var i = loop[0]; i < loop[1]; i++) {
                                    var item_class = "item";
                                    var href = "/scams/" + (index + i) + "/";
                                    if ((index + i) > pages.length || (index + i) < 1) {
                                        item_class = "disabled item";
                                        href = "#";
                                    } else if (i == 1) {
                                        item_class = "active item";
                                    }
                                    pagination += "<a href='" + href + "' class='" + item_class + "'>" + (index + i) + "</a>";
                                }
                                pagination += "</div>";
                                if (index == 0) {
                                    layout = template_1.replace(/{{ scams.total }}/ig, scams.length);
                                    layout = layout.replace(/{{ scams.table }}/ig, page);
                                    layout = layout.replace(/{{ scams.pagination }}/ig, pagination);
                                    layout = layout.replace(/{{ scams.active }}/ig, active);
                                    layout = layout.replace(/{{ addresses.total }}/ig, Object.keys(addresses).length);
                                    layout = layout.replace(/{{ scams.inactive }}/ig, inactive);
                                    fs.writeFile("./_site/scams/index.html", layout, function(err) {
                                        if (err) {
                                            return console.log(err);
                                        }
                                    });
                                }
                                layout = template_2.replace(/{{ scams.table }}/ig, page);
                                layout = layout.replace(/{{ scams.pagination }}/ig, pagination);
                                if (!fs.existsSync("./_site/scams/" + (index + 1) + "/")) {
                                    fs.mkdirSync("./_site/scams/" + (index + 1) + "/");
                                }
                                if (minify) {
                                    layout = htmlmin(layout);
                                }
                                fs.writeFile("./_site/scams/" + (index + 1) + "/index.html", layout, function(err) {
                                    if (err) {
                                        return console.log(err);
                                    }
                                });
                            });
                        }
                    }
                });
            });
        });
    });
}

/* Use templates to generate all the default pages */
function preprocess() {
    total = 0;
    console.log("Preprocessing html files...");
    preprocessScams();
    fs.readdir('./_layouts/', function(err, files) {
        if (err) throw err;
        files.forEach(function(file) {
            if (file != "address.html" && file != "default.html" && file != "scam.html" && file != "ip.html" && file != "scams.html" && file != "scams_2.html") {
                fs.readFile('./_layouts/' + file, 'utf8', function(err, data) {
                    var preprocess = template.replace("{{ content }}", data);
                    if (err) {
                        return console.log(err);
                    }
                    if (file != "index.html" && file != "reportdomain.html" && file != "reportaddress.html") {
                        var filename = "./_site/" + file.replace('.html', '') + "/index.html";
                        if (!fs.existsSync("./_site/" + file.replace('.html', ''))) {
                            fs.mkdirSync("./_site/" + file.replace('.html', ''));
                        }
                    } else if (file == "reportdomain.html" || file == "reportaddress.html") {
                        var filename = "./_site/" + file.replace('.html', '').replace("report", "report/") + "/index.html";
                        if (!fs.existsSync("./_site/report/")) {
                            fs.mkdirSync("./_site/report/");
                        }
                        if (!fs.existsSync("./_site/" + file.replace('.html', '').replace("report", "report/"))) {
                            fs.mkdirSync("./_site/" + file.replace('.html', '').replace("report", "report/"));
                        }
                    } else if (file == "index.html") {
                        var filename = "./_site/index.html";
                    }
                    if (minify) {
                        preprocess = htmlmin(preprocess);
                    }
                    fs.writeFile(filename, preprocess, function(err) {
                        if (err) {
                            return console.log(err);
                        }
                        total++;
                        if ((job == "build" || job == false) && total == files.length - 6) {
                            console.log("Done preprocessing.")
                            finish();
                        }
                    });
                });
            }
        });
    });
}

/* Finished function */
function finish(task = 'building') {
    console.log("Done " + task + " in " + (((new Date()).getTime() - startTime) / 1000) + " seconds");
    if (job == false) {
        serve();
    }
}

/* Serve the content to a local server */
function serve() {
    connect().use(serveStatic(__dirname + "/_site")).listen(port, function() {
        console.log('Content served on http://localhost:' + port);
    });
}

if (2 in process.argv) {
    if (process.argv[2] == "--clean") {
        clean();
    } else if (process.argv[2] == "--update") {
        job = "update";
        compile_archive();
    } else if (process.argv[2] == "--build") {
        job = "build";
        compile_archive();
    } else if (process.argv[2] == "--serve") {
        serve();
    } else if (process.argv[2] == "--archive") {
        job = "archive";
        compile_archive();
    } else {
        console.log("Unsupported flag: " + process.argv[2]);
    }
} else {
    compile_archive();
}
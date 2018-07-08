'use strict';

const fs = require('fs-extra');
const express = require('express');
const bodyParser = require('body-parser');
const url = require('url');
const dateFormat = require('dateformat');
const spawn = require('child_process').spawn;
const download = require('download-file');
const rimraf = require('rimraf');
const phishingDetector = require('eth-phishing-detect/src/detector');
const crypto = require("crypto");
const request = require('request');
const app = express();
const config = require('./config');

const default_template = fs.readFileSync('./_layouts/default.html', 'utf8');
let cache;
let updating_now = false;
let icon_warnings = [];
var older_cache_time;


/* See if there's an up-to-date cache, otherwise run `update.js` to create one. */
function getCache(callback = false) {
    if (!fs.existsSync('_cache/cache.json')) {
        console.log("No cache file found. Creating one...");
        if (callback) {
            if (!updating_now) {
                updating_now = true;
                spawn('node', ['update.js'], {
                    detached: true
                });
            }
            var checkDone = setInterval(function() {
                if (fs.existsSync('_cache/cache.json')) {
                    updating_now = false;
                    cache = JSON.parse(fs.readFileSync('_cache/cache.json'));
                    clearInterval(checkDone);
                    console.log("Successfully updated cache!");
                    callback();
                }
            }, 1000);
        } else {
            spawn('node', ['update.js'], {
                detached: true
            });
        }
    } else if (!cache) {
        cache = JSON.parse(fs.readFileSync('_cache/cache.json'));
        if (callback) {
            callback();
        }
    } else if ((new Date().getTime() - cache.updated) < config.cache_refreshing_interval) {
        return cache;
    } else if ((new Date().getTime() - cache.updated) >= config.cache_refreshing_interval) {
        if (!updating_now) {
            updating_now = true;
            older_cache_time = cache.updated;
            spawn('node', ['update.js'], {
                detached: true
            });
            var checkDone2 = setInterval(function() {
                if (cache.updated != older_cache_time) {
                    clearInterval(checkDone2);
                    console.log("Successfully updated cache!");
                    updating_now = false;
                }
            }, 1000);
        }
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
    } else if ('subcategory' in scam && scam.subcategory == "MyCrypto") {
        abusereport += "The domain is impersonating MyCrypto.com, a website where people can create Ethereum wallets (a cryptocurrency like Bitcoin).";
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
                    table += "<tr><td><img class='project icon' src='/img/" + url.name.toLowerCase().replace(' ', '') + ".png'>" + url.name + "</td><td><a target='_blank' href='" + url.url + "'>" + url.url + "</a></td></tr>";
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

    app.get('/report/:type?/:value?', function(req, res) { // Serve /report/, /report/domain/, and /report/address/ (or /report/domain/fake-mycrypto.com
        if (!req.params.type) {
            res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/report.html', 'utf8')));
        } else if (req.params.type == "address") {
            if (req.params.value) {
                res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/reportaddress.html', 'utf8')).replace('{{ page.placeholder }}', req.params.value));
            } else {
                res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/reportaddress.html', 'utf8')).replace('{{ page.placeholder }}', ''));
            }
        } else if (req.params.type == "domain") {
            if (req.params.value) {
                res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/reportdomain.html', 'utf8')).replace('{{ page.placeholder }}', req.params.value));
            } else {
                res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/reportdomain.html', 'utf8')).replace('{{ page.placeholder }}', ''));
            }
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
                    if ((a.status == 'Active' && b.status != 'Active') || (a.status == 'Inactive' && (b.status == 'Suspended' || b.status == 'Offline')) || (a.status == 'Suspended' && b.status == 'Offline')) {
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
                if ('category' in a && 'category' in b && a.category && b.category) {
                    return a.category.localeCompare(b.category);
                } else {
                    return -1;
                }
            });
        } else if (req.params.sorting == 'subcategory') {
            template = template.replace("{{ sorting.subcategory }}", "sorted descending");
            var scams = getCache().scams.sort(function(a, b) {
                if ('subcategory' in a && 'subcategory' in b && a.subcategory && b.subcategory) {
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
                } else if (scams[i].status == "Inactive") {
                    var status = "<td class='suspended'><i class='remove icon'></i> Inactive</td>";
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
            if ('subcategory' in scams[i] && scams[i].subcategory) {
                if (scams[i].subcategory.toLowerCase() == "wallets") {
                    var subcategory = '<i class="credit card alternative icon"></i> ' + scams[i].subcategory;
                } else if (fs.existsSync("_static/img/" + scams[i].subcategory.toLowerCase().replace(/\s/g, '') + ".png")) {
                    var subcategory = "<img src='/img/" + scams[i].subcategory.toLowerCase().replace(/\s/g, '') + ".png' class='subcategoryicon'> " + scams[i].subcategory;
                } else {
                    var subcategory = scams[i].subcategory;
                    if (!(icon_warnings.includes(subcategory))) {
                        icon_warnings.push(subcategory);
                        console.log("Warning! No subcategory icon found for " + subcategory);
                    }
                }
            } else {
                var subcategory = '<i class="remove icon"></i> None';
            }
            if (scams[i].name.length > 40) {
                scams[i].name = scams[i].name.substring(0, 40) + '...';
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
        var whitelistImports;
        var blacklistImports;
        var fuzzylistImports;
        var toleranceImports;
        let startTime = (new Date()).getTime();
        let scam = getCache().scams.find(function(scam) {
            return scam.id == req.params.id;
        });

        if(typeof scam === "undefined") {
            let template = fs.readFileSync('./_layouts/no-scam-found.html', 'utf8');
            res.send(default_template.replace('{{ content }}', template));
        }
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
            /* Parses data for Metamask*/
            if (fs.existsSync('./_data/metamaskImports.json')) {
              try {
                var importsData = require('./_data/metamaskImports.json')
                const detector = new phishingDetector(importsData);
                template = template.replace("{{ scam.metamask }}", "<b>MetaMask Status:</b> " + (detector.check(url.parse(scam.url).hostname).result ? "<span style='color:green'>Blocked</span>" : "<span style='color:red'>Not Blocked</span>") + "<br />");
              } catch (e) {
                console.log(e);
              }
            } else{
              console.log('MetaMask JSON not found');
            };
            if ('status' in scam && scam.status != 'Offline' && fs.existsSync('_cache/screenshots/' + scam.id + '.png')) {
                template = template.replace("{{ scam.screenshot }}", '<h3>Screenshot</h3><img src="/screenshot/' + scam.id + '.png">');
            } else {
                template = template.replace("{{ scam.screenshot }}", '');
            }
        } else {
            template = template.replace("{{ scam.googlethreat }}", '');
            template = template.replace("{{ scam.screenshot }}", '');
        }
        actions_text += '<a target="_blank" href="https://github.com/' + config.repository.author + '/' + config.repository.name + '/blob/' + config.repository.branch + '/_data/scams.yaml" class="ui icon secondary button"><i class="write alternate icon"></i> Improve</a><button id="share" class="ui icon secondary button"><i class="share alternate icon"></i> Share</button>';
        template = template.replace("{{ scam.actions }}", '<div id="actions" class="eight wide column">' + actions_text + '</div>');
        if ('Google_SafeBrowsing_API_Key' in config && config.Google_SafeBrowsing_API_Key && 'url' in scam) {
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
                            "url": url.parse(scam.url).hostname
                        }]
                    }
                }
            };
            request(options, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    if ('matches' in body && 0 in body.matches) {
                        template = template.replace("{{ scam.googlethreat }}", "<span class='class_offline'>Blocked for " + body.matches[0]['threatType'] + '</span>');
                    } else {
                        template = template.replace("{{ scam.googlethreat }}", "<span class='class_active'>Not Blocked</span> <a target='_blank' href='https://safebrowsing.google.com/safebrowsing/report_phish/'><i class='warning sign icon'></i></a>");
                    }
                }
                template = template.replace("{{ page.built }}", '<p class="built">This page was built in <b>' + ((new Date()).getTime() - startTime) + '</b>ms, and last updated at <b>' + dateFormat(getCache().updated, "UTC:mmm dd yyyy, HH:MM") + ' UTC</b></p>');
                res.send(default_template.replace('{{ content }}', template));
            });
        } else {
            console.log("Warning: No Google Safe Browsing API key found");
            res.send(default_template.replace('{{ content }}', template));
        }
    });

    app.get('/domain/:domain/', function(req, res) { // Serve /scam/<id>/
        var whitelistImports;
        var blacklistImports;
        var fuzzylistImports;
        var toleranceImports;
        let domainpage = encodeURIComponent(req.params.domain.replace("www.","").split(/[/?#]/)[0].toLowerCase());
        let startTime = (new Date()).getTime();

        let scam = getCache().scams.find(function(scam) {
            return scam.name == domainpage;
        });

        let verified = getCache().legiturls.find(function(verified) {
          return verified.url.replace("https://", '') == domainpage;
        });

        if(typeof scam === "undefined" && typeof verified === "undefined") {
          let template = fs.readFileSync('./_layouts/neutraldomain.html', 'utf8');
          template = template.replace("{{ neutral.name }}", domainpage);
          template = template.replace("{{ neutral.url }}", '<b>URL</b>: <a id="url" target="_blank" href="/redirect/' + "https://" + encodeURIComponent(domainpage) + '">' + domainpage + '</a><BR>');
          template = template.replace("{{ neutral.notification }}", '<div class="ui mini brown message"><i class="warning sign icon"></i> This domain has not yet been classified on EtherScamDB </div>')
          template = template.replace("{{ page.built }}", '<p class="built">This page was built in <b>' + ((new Date()).getTime() - startTime) + '</b>ms, and last updated at <b>' + dateFormat(getCache().updated, "UTC:mmm dd yyyy, HH:MM") + ' UTC</b></p>');
          res.send(default_template.replace('{{ content }}', template));
        }

        if(typeof verified != "undefined"){
          let template = fs.readFileSync('./_layouts/verifieddomain.html', 'utf8');
          template = template.replace("{{ verified.name }}", verified.name);
          template = template.replace("{{ verified.notification }}", '<div class="ui mini green message"><i class="warning sign icon"></i> This is a verified domain. </div>')
          if ('description' in verified) {
              template = template.replace("{{ verified.description }}", '<b>Description</b>: ' + verified.description + '<BR>');
          } else {
              template = template.replace("{{ verified.description }}", '');
          }
          if ('addresses' in verified) {
              var addresses_text = '';
              verified.addresses.forEach(function(address) {
                  addresses_text += '<div class="ui item"><a href="/address/' + address + '">' + address + '</a></div>';
              });
              template = template.replace("{{ verified.addresses }}", '<b>Related addresses</b>: <div class="ui bulleted list">' + addresses_text + '</div>');
          } else {
              template = template.replace("{{ verified.addresses }}", '');
          }
          if ('url' in verified) {
              template = template.replace("{{ verified.url }}", '<b>URL</b>: <a id="url" target="_blank" href="' + encodeURIComponent(verified.url) + '">' + verified.url + '</a><BR>');
          } else {
              template = template.replace("{{ verified.url }}", '');
          }
          template = template.replace("{{ page.built }}", '<p class="built">This page was built in <b>' + ((new Date()).getTime() - startTime) + '</b>ms, and last updated at <b>' + dateFormat(getCache().updated, "UTC:mmm dd yyyy, HH:MM") + ' UTC</b></p>');
          res.send(default_template.replace('{{ content }}', template));
        }

        if(typeof scam != "undefined"){
          let template = fs.readFileSync('./_layouts/scamdomain.html', 'utf8');
          var actions_text = "";
          template = template.replace("{{ scam.id }}", scam.id);
          template = template.replace("{{ scam.name }}", scam.name);
          template = template.replace("{{ scam.notification }}", '<div class="ui mini red message"><i class="warning sign icon"></i> Warning: This is a scam domain. </div>')

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
              /* Parses data for Metamask*/
              if (fs.existsSync('./_data/metamaskImports.json')) {
                try {
                  var importsData = require('./_data/metamaskImports.json')
                  const detector = new phishingDetector(importsData);
                  template = template.replace("{{ scam.metamask }}", "<b>MetaMask Status:</b> " + (detector.check(url.parse(scam.url).hostname).result ? "<span style='color:green'>Blocked</span>" : "<span style='color:red'>Not Blocked</span>") + "<br />");
                } catch (e) {
                  console.log(e);
                }
              } else{
                console.log('MetaMask JSON not found');
              };
              if ('status' in scam && scam.status != 'Offline' && fs.existsSync('_cache/screenshots/' + scam.id + '.png')) {
                  template = template.replace("{{ scam.screenshot }}", '<h3>Screenshot</h3><img src="/screenshot/' + scam.id + '.png">');
              } else {
                  template = template.replace("{{ scam.screenshot }}", '');
              }
          } else {
              template = template.replace("{{ scam.googlethreat }}", '');
              template = template.replace("{{ scam.screenshot }}", '');
          }
          actions_text += '<a target="_blank" href="https://github.com/' + config.repository.author + '/' + config.repository.name + '/blob/' + config.repository.branch + '/_data/scams.yaml" class="ui icon secondary button"><i class="write alternate icon"></i> Improve</a><button id="share" class="ui icon secondary button"><i class="share alternate icon"></i> Share</button>';
          template = template.replace("{{ scam.actions }}", '<div id="actions" class="eight wide column">' + actions_text + '</div>');
          if ('Google_SafeBrowsing_API_Key' in config && config.Google_SafeBrowsing_API_Key && 'url' in scam) {
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
                              "url": url.parse(scam.url).hostname
                          }]
                      }
                  }
              };
              request(options, function(error, response, body) {
                  if (!error && response.statusCode == 200) {
                      if ('matches' in body && 0 in body.matches) {
                          template = template.replace("{{ scam.googlethreat }}", "<span class='class_offline'>Blocked for " + body.matches[0]['threatType'] + '</span>');
                      } else {
                          template = template.replace("{{ scam.googlethreat }}", "<span class='class_active'>Not Blocked</span> <a target='_blank' href='https://safebrowsing.google.com/safebrowsing/report_phish/'><i class='warning sign icon'></i></a>");
                      }
                  }
                  template = template.replace("{{ page.built }}", '<p class="built">This page was built in <b>' + ((new Date()).getTime() - startTime) + '</b>ms, and last updated at <b>' + dateFormat(getCache().updated, "UTC:mmm dd yyyy, HH:MM") + ' UTC</b></p>');
                  res.send(default_template.replace('{{ content }}', template));
              });
          } else {
              template = template.replace("{{ scam.googlethret }}", "");
              template = template.replace("{{ page.built }}", '<p class="built">This page was built in <b>' + ((new Date()).getTime() - startTime) + '</b>ms, and last updated at <b>' + dateFormat(getCache().updated, "UTC:mmm dd yyyy, HH:MM") + ' UTC</b></p>');
              console.log("Warning: No Google Safe Browsing API key found");
              res.send(default_template.replace('{{ content }}', template));
          }
        }

    });

    app.get('/ip/:ip/', function(req, res) { // Serve /ip/<ip>/
        let template = fs.readFileSync('./_layouts/ip.html', 'utf8');
        template = template.replace("{{ ip.ip }}", req.params.ip);
        var related = '';
        let total = 0;
        getCache().scams.filter(function(obj) {
            return obj.ip === req.params.ip;
        }).forEach(function(value) {
            related += "<div class='item'><a href='/scam/" + value.id + "/'>" + value.name + "</div>";
            total++;
        });

        template = template.replace("{{ ip.scams_count }}", total);

        //Grab the result from abuseipdb
        let abuseipdb_categories = {
            3: "Fraud Orders",
            4: "DDoS Attack",
            5: "FTP Brute-Force",
            6: "Ping of Death",
            7: "Phishing",
            8: "Fraud VoIP",
            9: "Open Proxy",
            10: "Web Spam",
            11: "Email Spam",
            12: "Blog Spam",
            13: "VPN IP",
            14: "Port Scan",
            15: "Hacking",
            16: "SQL Injection",
            17: "Spoofing",
            18: "Brute-Force",
            19: "Bad Web Bot",
            20: "Exploited Host",
            21: "Web App Attack",
            22: "SSH",
            23: "IoT Targeted"
        };

        template = template.replace("{{ ip.abuseipdb_link }}", '<a href="https://www.abuseipdb.com/check/'+ req.params.ip +'" target="_blank">View Report</a>');
        template = template.replace("{{ ip.urlscan_link }}", '<a href="https://urlscan.io/ip/'+ req.params.ip +'" target="_blank">View Report</a>');
        template = template.replace("{{ ip.scams }}", '<div class="ui bulleted list">' + related + '</div>');
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/address/:address/', function(req, res) { // Serve /address/<address>/
        let template = fs.readFileSync('./_layouts/address.html', 'utf8');
        let inputAddr = req.params.address.toLowerCase();
        template = template.replace(/{{ address.address }}/g, inputAddr);
        var related = '';
        var whitelistrelated = '';
        var scamstatus = false;
        var legitstatus = false;

        scamstatus = getCache().scams.filter(function(obj) {
            if ('addresses' in obj) {
                return obj.addresses.includes(inputAddr);
            } else {
                return false;
            }
        }).forEach(function(value) {
            template = template.replace("{{ address.notification }}", '<div class="ui mini red message"><i class="warning sign icon"></i> Warning: Do not send money to this address</div>')
            template = template.replace("{{ address.list }}", "<b>Related to the following verified scams</b>: {{ address.scams }}")
            related += "<div class='item'><a href='/scam/" + value.id + "/'>" + value.name + "</div>";
        });

        legitstatus = getCache().legiturls.filter(function(objtwo) {
            if ('addresses' in objtwo) {
                return objtwo.addresses.includes(inputAddr);
            } else {
                return false;
            }
        }).forEach(function(valuetwo) {
            template = template.replace("{{ address.notification }}", '<div class="ui mini green message">This is a verified address</div>')
            template = template.replace("{{ address.list }}", "<b>Related to the following verified urls</b>: {{ address.verifieddomains }}")
            whitelistrelated += "<div class='item'><a href='" + valuetwo.url + "/'>" + valuetwo.name + " - (" + valuetwo.url + ")" + "</div>";
        });

        if(!legitstatus && !scamstatus) {
          template = template.replace("{{ address.notification }}", '<div class="ui mini brown message"><i class="warning sign icon"></i>This is an unclassified address. <br> This does not mean that it is safe. It simply means that it hasn\'t been classified.</div>')
          template = template.replace("{{ address.list }}", "")
        }

        template = template.replace("{{ address.scams }}", '<div class="ui bulleted list">' + related + '</div>');
        template = template.replace("{{ address.verifieddomains }}", '<div class="ui bulleted list">' + whitelistrelated + '</div>');
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/redirect/:url/', function(req, res) { // Serve /redirect/<url>/
        let template = fs.readFileSync('./_layouts/redirect.html', 'utf8').replace(/{{ redirect.domain }}/g, req.params.url);
        res.send(default_template.replace('{{ content }}', template));
    });

    app.get('/rss/', function(req, res) { // Serve /rss/ (rss feed)
        let template = fs.readFileSync('./_layouts/rss.html', 'utf8');
        var entries = '';
        getCache().scams.forEach(function(scam, index) {
            entries += "<item><title>" + scam.name + "</title><link>https://etherscamdb.info/scam/" + scam.id + "/</link><description>" + scam.category + "</description></item>";
        });
        res.send(template.replace('{{ rss.entries }}', entries));
    });

    app.get('/api/:type?/:domain?/', function(req, res) { // Serve /api/<type>/
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
        } else if (req.params.type == "inactives") {
            res.send(JSON.stringify({
              success: true,
              result: getCache().inactives
          }));
        } else if (req.params.type == "actives") {
            res.send(JSON.stringify({
              success: true,
              result: getCache().actives
          }));
        } else if (req.params.type == "blacklist") {
            res.send(JSON.stringify(getCache().blacklist, null, 2));
        } else if (req.params.type == "whitelist") {
            res.send(JSON.stringify(getCache().whitelist, null, 2));
        } else if (req.params.type == "check" && req.params.domain) {
            //They can search for an address or domain.
            if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.domain)) {
                var blocked = false;
                Object.keys(getCache().whitelistaddresses).forEach(function(address, index) {
                    //They searched for an address
                    if (req.params.domain.toLowerCase() === address.toLowerCase()) {
                        blocked = true;
                        res.send(JSON.stringify({
                            success: true,
                            result: 'whitelisted',
                            type: 'address',
                            entries: getCache().legiturls.filter(function(verified) {
                                if ('addresses' in verified) {
                                    return (verified.addresses.includes(req.params.domain.toLowerCase()));
                                } else {
                                    return false;
                                }
                            })
                        }));
                    }
                });
                Object.keys(getCache().addresses).forEach(function(address, index) {
                    //They searched for an address
                    if (req.params.domain.toLowerCase() === address.toLowerCase()) {
                        blocked = true;
                        res.send(JSON.stringify({
                            success: true,
                            result: 'blocked',
                            type: 'address',
                            entries: getCache().scams.filter(function(scam) {
                                if ('addresses' in scam) {
                                    return (scam.addresses.includes(req.params.domain.toLowerCase()));
                                } else {
                                    return false;
                                }
                            })
                        }));
                    }
                });
                if (!blocked) {
                    res.send(JSON.stringify({
                        success: true,
                        result: 'neutral',
                        type: 'address',
                        entries: {}
                    }));
                }
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
            res.send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/api.html', 'utf8')));
        }
    });

    app.post('/update/', function(req, res) { // New github update?
        req.rawBody = '';
        req.setEncoding('utf8');

        req.on('data', function(chunk) {
            req.rawBody += chunk;
        });

        req.on('end', function() {

            if ('x-hub-signature' in req.headers && 'Github_Hook_Secret' in config && crypto.timingSafeEqual(Buffer.from(req.headers['x-hub-signature']), Buffer.from("sha1=" + crypto.createHmac("sha1", config.Github_Hook_Secret).update(req.rawBody).digest("hex")))) {
                console.log("New commit pushed");
                download("https://raw.githubusercontent.com/" + config.repository.author + "/" + config.repository.name + "/" + config.repository.branch + "/_data/scams.yaml?no-cache=" + (new Date()).getTime(), {
                    directory: "_data/",
                    filename: "scams.yaml"
                }, function(err) {
                    if (err) throw err;
                    download("https://raw.githubusercontent.com/" + config.repository.author + "/" + config.repository.name + "/" + config.repository.branch + "/_data/legit_urls.yaml?no-cache=" + (new Date()).getTime(), {
                        directory: "_data/",
                        filename: "legit_urls.yaml"
                    }, function(err) {
                        if (err) throw err;
                        res.status(200).end();
                        spawn('node', ['update.js'], {
                            detached: true
                        });
                    });
                });
            } else {
                console.log("Incorrect webhook attempt");
                console.log(req.headers['x-hub-signature']);
                console.log(req.body);
            }
        });
    });

    app.get('*', function(req, res) { // Serve all other pages as 404
        res.status(404).send(default_template.replace('{{ content }}', fs.readFileSync('./_layouts/404.html', 'utf8')));
    });

    app.listen(config.port, function() { // Listen on port (defined in config)
        console.log('Content served on http://localhost:' + config.port);
    });
}

/*  Copy config.example.js to config.js, if it does not exist yet */
if (!fs.existsSync('config.js')) {
    fs.copySync('config.example.js', 'config.js');
    console.log('Config file was copied. Please update with correct values');
    process.abort();
} else if (2 in process.argv) {
    if (process.argv[2] == "--clean") {
        rimraf('_cache', function() {
            console.log("Cleared cache");
        });
    } else if (process.argv[2] == "--update") {
        if (fs.existsSync("_cache/cache.json") && cache) {
            spawn('node', ['update.js'], {
                detached: true
            });
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
                try {
                    cache = JSON.parse(data);
                } catch (e) {
                    console.log(e);
                }
            });
        }
    }, 60000);
    getCache(function() {
        startWebServer();
    });
}

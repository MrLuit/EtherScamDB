'use strict';

const debug = require('debug')('app');
const {fork} = require('child_process');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const ejs = require('ejs');
const dateFormat = require('dateformat');
const url = require('url');
const crypto = require('crypto');
const db = require('./utils/db');
const config = require('./utils/config');
const app = express();

module.exports = async () => {
	await db.init();
    
	app.set('view engine', 'ejs');
	app.set('view cache', true);
	app.set('views','./src/views/pages');
	app.use(compression());
	app.use(express.static('./src/views/static'));
	/* app.use(require('body-parser').json());				Not sure if this is necessary? */
	
	app.get('/(/|index.html)?', (req, res) => res.render('index'));
	app.get('/faq/', (req, res) => res.render('faq'));
	app.get('/api/', (req, res) => res.render('api'));
	
	app.get('/report/', (req, res) => res.render('report'));
	app.get('/report/domain/:domain', (req, res) => res.render('report', { domain: req.params.domain }));
	app.get('/report/address/:address', (req, res) => res.render('report', { address: req.params.address }));
	
	app.get('/ip/:ip', (req, res) => res.render('ip', { ip: req.params.ip, related: db.read().index.ips[req.params.ip] }));
	app.get('/address/:address', (req, res) => res.render('address', { address: req.params.address, related: db.read().index.addresses[req.params.address] }));
	app.get('/scam/:id', (req, res) => {
		const entry = db.read().scams.find(scam => scam.id == req.params.id);
		if(entry) res.redirect('/domain/' + encodeURIComponent(entry.name));
		else res.status(404).render('404');
	});
	app.get('/domain/:url', (req, res) => {
		const startTime = Date.now();
		const hostname = url.parse(req.params.url).hostname;
		const scamEntry = db.read().scams.find(scam => scam.name == hostname);
		const verifiedEntry = db.read().verified.find(verified => verified.name == hostname);
		
		if(verifiedEntry) res.render('domain', { type: 'verified', result: verifiedEntry, domain: hostname, startTime: startTime, dateFormat: dateFormat, addresses: verifiedEntry.addresses });
		else if(scamEntry) res.render('domain', { type: 'scam', result: scamEntry, domain: hostname, startTime: startTime, dateFormat: dateFormat, addresses: scamEntry.addresses });
		else res.render('domain', { type: 'neutral', domain: hostname, result: false, addresses: [], startTime: startTime });
	});
	app.get('/scams/:page?/:sorting?/', async (req, res) => {
        const MAX_RESULTS_PER_PAGE = 30;
		let scams;
		
        if (req.params.sorting == 'oldest') scams = db.read().scams
        else if (req.params.sorting == 'status') scams = db.read().scams;
        else if (req.params.sorting == 'category') scams = db.read().scams;
        else if (req.params.sorting == 'subcategory') scams = db.read().scams;
        else if (req.params.sorting == 'title') scams = db.read().scams;
		else scams = db.read().scams;

        let addresses = {};

        scams.forEach(function(scam, index) {
            if ('addresses' in scam && scam.addresses) {
                scams[index].addresses.forEach(function(address) {
                    addresses[address] = true;
                });
            }
        });

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
                    /*if (!(icon_warnings.includes(subcategory))) {
                        icon_warnings.push(subcategory);
                        console.log("Warning! No subcategory icon found for " + subcategory);
                    }*/
                }
            } else {
                var subcategory = '<i class="remove icon"></i> None';
            }
            if (scams[i].name.length > 40) {
                scams[i].name = scams[i].name.substring(0, 40) + '...';
            }
            table += "<tr><td>" + category + "</td><td>" + subcategory + "</td>" + status + "<td>" + scams[i].name + "</td><td class='center'><a href='/domain/" + url.parse(scams[i].url).hostname + "'><i class='search icon'></i></a></td></tr>";
        }

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
		
        res.render('scams', {
			'sorting': req.params.sorting,
			'pagination': strPagination,
			'total': scams.length.toLocaleString('en-US'),
			'active': Object.keys(scams.filter(scam => scam.status !== 'Active')).length.toLocaleString('en-US'),
			'total_addresses': Object.keys(addresses).length.toLocaleString('en-US'),
			'inactive': Object.keys(scams.filter(scam => scam.status === 'Active')).length.toLocaleString('en-US'),
			'table': table
		});
	});
	
	app.get('/search/', (req, res) => res.render('search', { featured: db.read().index.featured }));
	app.get('/rss/', (req, res) => res.render('rss', { scams: db.read().scams }));
	
	app.use('/api/:type?/:domain?/', (req,res,next) => {
		res.header('Access-Control-Allow-Origin', '*');
		next();
	});
	
	app.get('/api/scams', (req, res) => res.json({ success: true, result: db.read().scams }));
	app.get('/api/addresses', (req, res) => res.json({ success: true, result: db.read().index.addresses }));
	app.get('/api/ips', (req, res) => res.json({ success: true, result: db.read().index.ips }));
	app.get('/api/verified', (req, res) => res.json({ success: true, result: db.read().verified }));
	app.get('/api/inactives', (req, res) => res.json({ success: true, result: db.read().index.inactives }));
	app.get('/api/actives', (req, res) => res.json({ success: true, result: db.read().index.actives }));
	app.get('/api/blacklist', (req, res) => res.json({ success: true, result: db.read().index.blacklist }));
	app.get('/api/whitelist', (req, res) => res.json({ success: true, result: db.read().index.whitelist }));
	// Check endpoint
	// Abuse report endpoint

    app.post('/update/', (req, res) => {
        req.rawBody = '';
        req.setEncoding('utf8');

        req.on('data', chunk => {
            req.rawBody += chunk;
        });

        req.on('end', () => {

            if ('x-hub-signature' in req.headers && 'Github_Hook_Secret' in config && crypto.timingSafeEqual(Buffer.from(req.headers['x-hub-signature']), Buffer.from("sha1=" + crypto.createHmac("sha1", config.Github_Hook_Secret).update(req.rawBody).digest("hex")))) {
                debug("New commit pushed");
                /*download("https://raw.githubusercontent.com/" + config.repository.author + "/" + config.repository.name + "/" + config.repository.branch + "/_data/scams.yaml?no-cache=" + (new Date()).getTime(), {
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
                        fork('update.js');
                    });
                });*/
            } else {
                debug("Incorrect webhook attempt %o",req);
            }
        });
    });
	
	app.get('/redirect/:url', (req,res) => res.render('redirect', { url: req.params.url }));
    app.get('*', (req, res) => res.status(404).render('404'));

    
	app.listen(config.port, () => debug('Content served on http://localhost:%s',config.port));
}

if(!module.parent) module.exports();

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
const path = require('path');
const config = require('./utils/config');
const generateAbuseReport = require('./utils/abusereport');
const checkForPhishing = require('eth-phishing-detect');
const app = express();

const updateScams = async () => {
	const updateProcess = fork(path.join(__dirname,'scripts/update.js'));
	updateProcess.on('message', data => db.write(data.id,data));
}

module.exports = async () => {
	await db.init();
    
	app.set('view engine', 'ejs');
	app.set('views',path.join(__dirname,'views/pages'));
	app.use(compression());
	app.use(express.static(path.join(__dirname,'views/static')));
	/* app.use(require('body-parser').json());				Not sure if this is necessary? */
	
	app.get('/(/|index.html)?', (req, res) => res.render('index'));
	app.get('/faq/', (req, res) => res.render('faq'));
	app.get('/api/', (req, res) => res.render('api'));
	
	app.get('/report/', (req, res) => res.render('report'));
	app.get('/report/domain/:domain', (req, res) => res.render('report', { domain: req.params.domain }));
	app.get('/report/address/:address', (req, res) => res.render('report', { address: req.params.address }));
	
	app.get('/ip/:ip', (req, res) => res.render('ip', { ip: req.params.ip, related: (db.read().index.ips[req.params.ip] || []) }));
	app.get('/address/:address', (req, res) => res.render('address', { address: req.params.address, related: (db.read().index.addresses[req.params.address] || []) }));
	app.get('/scam/:id', (req, res) => {
		const entry = db.read().scams.find(scam => scam.id == req.params.id);
		if(entry) res.redirect('/domain/' + encodeURIComponent(entry.name));
		else res.status(404).render('404');
	});
	app.get('/domain/:url', (req, res) => {
		const startTime = Date.now();
		const {hostname} = url.parse('http://' + req.params.url.replace('http://','').replace('https://'));
		const scamEntry = db.read().scams.find(scam => scam.name == hostname);
		const verifiedEntry = db.read().verified.find(verified => url.parse(verified.url).hostname == hostname);
		
		if(verifiedEntry) res.render('domain', { type: 'verified', result: verifiedEntry, domain: hostname, metamask: false, startTime: startTime, dateFormat: dateFormat });
		else if(scamEntry) res.render('domain', { type: 'scam', result: scamEntry, domain: hostname, metamask: checkForPhishing(hostname), startTime: startTime, dateFormat: dateFormat, abuseReport: generateAbuseReport(scamEntry) });
		else res.render('domain', { type: 'neutral', domain: hostname, result: false, metamask: checkForPhishing(hostname), addresses: [], startTime: startTime });
	});
	app.get('/scams/:page?/:sorting?/', (req, res) => {
        const MAX_RESULTS_PER_PAGE = 30;
		const scamList = [];
		let scams;
		
		if(req.params.page && (req.params.page != 'all' && (!isFinite(parseInt(req.params.page)) || isNaN(parseInt(req.params.page)) || parseInt(req.params.page) < 0))) {
			res.status(404).render('404');
			return;
		}
		
        if (req.params.sorting == 'oldest') scams = db.read().scams.sort((a,b) => a.id-b.id)
        else if (req.params.sorting == 'status') scams = db.read().scams;
        else if (req.params.sorting == 'category') scams = db.read().scams;
        else if (req.params.sorting == 'subcategory') scams = db.read().scams;
        else if (req.params.sorting == 'title') scams = db.read().scams;
		else scams = db.read().scams.sort((a,b) => b.id-a.id);

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
            if (scams.hasOwnProperty(i) === false) continue;
			scamList.push(scams[i]);
        }
		
        res.render('scams', {
			'page': req.params.page,
			'sorting': req.params.sorting,
			'total': scams.length.toLocaleString('en-US'),
			'active': Object.keys(scams.filter(scam => scam.status === 'Inactive')).length.toLocaleString('en-US'),
			'total_addresses': Object.keys(db.read().index.addresses).length.toLocaleString('en-US'),
			'inactive': Object.keys(scams.filter(scam => scam.status === 'Active')).length.toLocaleString('en-US'),
			'scams': scamList,
			'MAX_RESULTS_PER_PAGE': MAX_RESULTS_PER_PAGE,
			'scamsLength': scams.length
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
	app.get('/api/abusereport/:domain', (req, res) => { 
		const result = db.read().scams.find(scam => scam.getHostname() == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain);
        if (result) res.json({ success: false, error: "URL wasn't found"});
        else res.send({ success: true, result: generateAbuseReport(result)});
	});
	app.get('/api/check/:domain', (req,res) => {
		 //They can search for an address or domain.
            if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.domain)) {
                var blocked = false;
                Object.keys(db.read().index.whitelistAddresses).forEach(function(address, index) {
                    //They searched for an address
                    if (req.params.domain.toLowerCase() === address.toLowerCase()) {
                        blocked = true;
                        res.send(JSON.stringify({
                            success: true,
                            result: 'whitelisted',
                            type: 'address',
                            entries: db.read().index.verified.filter(function(verified) {
                                if ('addresses' in verified) {
                                    return (verified.addresses.includes(req.params.domain.toLowerCase()));
                                } else {
                                    return false;
                                }
                            })
                        }));
                    }
                });
                Object.keys(db.read().index.addresses).forEach(function(address, index) {
                    //They searched for an address
                    if (req.params.domain.toLowerCase() === address.toLowerCase()) {
                        blocked = true;
                        res.send(JSON.stringify({
                            success: true,
                            result: 'blocked',
                            type: 'address',
                            entries: db.read().scams.filter(function(scam) {
                                if ('addresses' in scam && scam.addresses) {
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
                if (db.read().index.whitelist.includes(url.parse(req.params.domain).hostname) || db.read().index.whitelist.includes(req.params.domain)) {
                    res.send(JSON.stringify({
                        success: true,
                        input: url.parse(req.params.domain).hostname || req.params.domain,
                        result: 'verified'
                    }));
                } else if (db.read().index.blacklist.includes(url.parse(req.params.domain).hostname) || db.read().index.blacklist.includes(req.params.domain.replace(/(^\w+:|^)\/\//, ''))) {
                    if (/^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/.test(req.params.domain.replace(/(^\w+:|^)\/\//, ''))) {
                        //They searched for an ip address
                        res.send(JSON.stringify({
                            success: true,
                            input: req.params.domain.replace(/(^\w+:|^)\/\//, ''),
                            result: 'blocked',
                            type: 'ip',
                            entries: db.read().scams.filter(function(scam) {
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
                            entries: db.read().scams.filter(function(scam) {
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
	});

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
	
	setTimeout(() => {
		updateScams();
		setInterval(updateScams,5*60*1000);
	},100);
}

if(!module.parent) module.exports();

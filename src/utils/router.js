const express = require('express');
const db = require('./db');
const generateAbuseReport = require('./abusereport');
const checkForPhishing = require('eth-phishing-detect');
const dateFormat = require('dateformat');
const url = require('url');
const crypto = require('crypto');
const download = require('download-file');
const config = require('./config');
const router = express.Router();

/* Homepage */
router.get('/(/|index.html)?', (req, res) => res.render('index'));

/* FAQ page */
router.get('/faq/', (req, res) => res.render('faq'));

/* API documentation page */
router.get('/api/', (req, res) => res.render('api'));

/* Report pages */
router.get('/report/', (req, res) => res.render('report'));

router.get('/report/domain/:domain', (req, res) => res.render('report', {
	domain: req.params.domain
}));

router.get('/report/address/:address', (req, res) => res.render('report', {
	address: req.params.address
}));

/* IP pages */
router.get('/ip/:ip', (req, res) => res.render('ip', {
	ip: req.params.ip,
	related: (db.read().index.ips[req.params.ip] || [])
}));

/* Address pages */
router.get('/address/:address', (req, res) => res.render('address', {
	address: req.params.address,
	related: (db.read().index.addresses[req.params.address] || [])
}));

/* Scam pages (deprecated) */
router.get('/scam/:id', (req, res) => {
	const entry = db.read().scams.find(scam => scam.id == req.params.id);
	if(entry) res.redirect('/domain/' + encodeURIComponent(entry.name));
	else res.status(404).render('404');
});

/* Domain pages */
router.get('/domain/:url', (req, res) => {
	const startTime = Date.now();
	const {hostname} = url.parse('http://' + req.params.url.replace('http://','').replace('https://'));
	const scamEntry = db.read().scams.find(scam => scam.name == hostname);
	const verifiedEntry = db.read().verified.find(verified => url.parse(verified.url).hostname == hostname);
		
	if(verifiedEntry) res.render('domain', { type: 'verified', result: verifiedEntry, domain: hostname, metamask: false, startTime: startTime, dateFormat: dateFormat });
	else if(scamEntry) res.render('domain', { type: 'scam', result: scamEntry, domain: hostname, metamask: checkForPhishing(hostname), startTime: startTime, dateFormat: dateFormat, abuseReport: generateAbuseReport(scamEntry) });
	else res.render('domain', { type: 'neutral', domain: hostname, result: false, metamask: checkForPhishing(hostname), addresses: [], startTime: startTime });
});

/* Scams index */
router.get('/scams/:page?/:sorting?/', (req, res) => {
	const MAX_RESULTS_PER_PAGE = 30;
	const scamList = [];
	let scams = db.read().scams.sort((a,b) => b.id-a.id);
	let index = [0,MAX_RESULTS_PER_PAGE];
		
	if(req.params.page && (req.params.page != 'all' && (!isFinite(parseInt(req.params.page)) || isNaN(parseInt(req.params.page)) || parseInt(req.params.page) < 0))) {
		res.status(404).render('404');
	} else {
		if (req.params.sorting == 'oldest') scams = db.read().scams.sort((a,b) => a.id-b.id)
		else if (req.params.sorting == 'status') scams = db.read().scams;
		else if (req.params.sorting == 'category') scams = db.read().scams;
		else if (req.params.sorting == 'subcategory') scams = db.read().scams;
		else if (req.params.sorting == 'title') scams = db.read().scams;

		if (req.params.page == "all") index = [0,scams.length-1];
		else if (!isNaN(parseInt(req.params.page))) index = [req.params.page * MAX_RESULTS_PER_PAGE,(req.params.page * MAX_RESULTS_PER_PAGE) + MAX_RESULTS_PER_PAGE];
		
		for (var i = index[0]; i <= index[1]; i++) {
			if (scams.hasOwnProperty(i) === false) continue;
			scamList.push(scams[i]);
		}
			
		res.render('scams', {
			'page': req.params.page,
			'sorting': req.params.sorting,
			'total': scams.length.toLocaleString('en-US'),
			'active': Object.keys(scams.filter(scam => scam.status === 'Active')).length.toLocaleString('en-US'),
			'total_addresses': Object.keys(db.read().index.addresses).length.toLocaleString('en-US'),
			'inactive': Object.keys(scams.filter(scam => scam.status === 'Inactive')).length.toLocaleString('en-US'),
			'scams': scamList,
			'MAX_RESULTS_PER_PAGE': MAX_RESULTS_PER_PAGE,
			'scamsLength': scams.length
		});
	}
});
	
/* Search pages */
router.get('/search/', (req, res) => res.render('search', { featured: db.read().index.featured }));

/* RSS */
router.get('/rss/', (req, res) => res.render('rss', { scams: db.read().scams }));

/* API middleware */
router.use('/api/:type?/:domain?/', (req,res,next) => {
	res.header('Access-Control-Allow-Origin', '*');
	next();
});
	
router.get('/api/scams', (req, res) => res.json({ success: true, result: db.read().scams }));
router.get('/api/addresses', (req, res) => res.json({ success: true, result: db.read().index.addresses }));
router.get('/api/ips', (req, res) => res.json({ success: true, result: db.read().index.ips }));
router.get('/api/verified', (req, res) => res.json({ success: true, result: db.read().verified }));
router.get('/api/inactives', (req, res) => res.json({ success: true, result: db.read().index.inactives }));
router.get('/api/actives', (req, res) => res.json({ success: true, result: db.read().index.actives }));
router.get('/api/blacklist', (req, res) => res.json({ success: true, result: db.read().index.blacklist }));
router.get('/api/whitelist', (req, res) => res.json({ success: true, result: db.read().index.whitelist }));
router.get('/api/abusereport/:domain', (req, res) => { 
	const result = db.read().scams.find(scam => scam.getHostname() == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain);
	if (result) res.json({ success: false, error: "URL wasn't found"});
	else res.send({ success: true, result: generateAbuseReport(result)});
});
router.get('/api/check/:domain', (req,res) => {
	//They can search for an address or domain.
	if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.domain)) {
		var blocked = false;
		Object.keys(db.read().index.whitelistAddresses).forEach((address, index) => {
                    //They searched for an address
                    if (req.params.domain.toLowerCase() === address.toLowerCase()) {
                        blocked = true;
                        res.send(JSON.stringify({
                            success: true,
                            result: 'whitelisted',
                            type: 'address',
                            entries: db.read().index.verified.filter(verified => (verified.addresses || []).includes(req.params.domain.toLowerCase()))
                        }));
                    }
                });
                Object.keys(db.read().index.addresses).forEach((address, index) => {
                    //They searched for an address
                    if (req.params.domain.toLowerCase() === address.toLowerCase()) {
                        blocked = true;
                        res.send(JSON.stringify({
                            success: true,
                            result: 'blocked',
                            type: 'address',
                            entries: db.read().scams.filter(scam => (scam.addresses || []).includes(req.params.domain.toLowerCase()))
                        }));
                    }
                });
                if (!blocked) {
                    res.send(JSON.stringify({
                        success: true,
                        result: 'neutral',
                        type: 'address',
                        entries: []
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
                            entries: db.read().scams.filter(scam => url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain || scam.ip == req.params.domain.replace(/(^\w+:|^)\/\//, ''))
                        }));
                    } else {
                        //They searched for a domain
                        res.send(JSON.stringify({
                            success: true,
                            input: url.parse(req.params.domain).hostname || req.params.domain,
                            result: 'blocked',
                            type: 'domain',
                            entries: db.read().scams.filter(scam => url.parse(scam.url).hostname == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain)
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

router.post('/update/', (req, res) => {
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
	
	
	
router.get('/redirect/:url', (req,res) => res.render('redirect', { url: req.params.url }));


module.exports = router;
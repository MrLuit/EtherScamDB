const express = require('express');
const db = require('./db');
const generateAbuseReport = require('./abusereport');
const checkForPhishing = require('eth-phishing-detect');
const dateFormat = require('dateformat');
const url = require('url');
const config = require('./config');
const github = require('./github');
const router = express.Router();
const isIpPrivate = require('private-ip');
const {getGoogleSafeBrowsing,getURLScan} = require('./lookup');
const debug = require('debug')('router')

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
router.get('/ip/:ip', async (req, res) => {
	const entry = db.read()
	console.log(JSON.stringify(entry.index.ips, null, 2))
	await res.render('ip', {
		ip: req.params.ip,
		isPrivate: isIpPrivate(req.params.ip),
		related: (entry.index.ips[req.params.ip] || [])
	})
});

/* Address pages */
router.get('/address/:address', async (req, res) => {
	const entry = await db.read()
	if(entry.index.whitelistAddresses[req.params.address]) {6
		res.render('address', {
			address: req.params.address,
			related: (entry.index.whitelistAddresses[req.params.address]),
			type: "verified"
		})
	}
	else if(entry.index.addresses[req.params.address]) {
		res.render('address', {
			address: req.params.address,
			related: (entry.index.addresses[req.params.address] || []),
			type: "scam"
		})
	}
	else {
		res.render('address', {
			address: req.params.address,
			related: (entry.index.addresses[req.params.address] || []),
			type: "neutral"
		})
	}
});

/* (dev) Add scam page */
router.get('/add/', (req,res) => {
	const {NODE_ENV} = process.env;
	if(NODE_ENV === 'development') res.render('add');
	else res.send(403).end();
});

/* Domain pages */
router.get('/domain/:url', async (req, res) => {
	const startTime = Date.now();
	const {hostname} = url.parse('http://' + req.params.url.replace('http://','').replace('https://'));
	const scamEntry = db.read().scams.find(scam => scam.getHostname() == hostname);
	const verifiedEntry = db.read().verified.find(verified => url.parse(verified.url).hostname == hostname);

	const urlScan = await getURLScan(hostname);
	let googleSafeBrowsing = undefined;
	let virusTotal = undefined;

	if((scamEntry || !verifiedEntry) && config.apiKeys.Google_SafeBrowsing) googleSafeBrowsing = await getGoogleSafeBrowsing(hostname);
	if((scamEntry || !verifiedEntry) && config.apiKeys.VirusTotal) virusTotal = await virusTotal(hostname);

	if(verifiedEntry) res.render('domain', { type: 'verified', result: verifiedEntry, domain: hostname, urlScan: urlScan, metamask: false, googleSafeBrowsing: googleSafeBrowsing, virusTotal: virusTotal, startTime: startTime, dateFormat: dateFormat });
	else if(scamEntry) res.render('domain', { type: 'scam', result: scamEntry, domain: hostname, urlScan: urlScan, metamask: checkForPhishing(hostname), googleSafeBrowsing: googleSafeBrowsing, virusTotal: virusTotal, startTime: startTime, dateFormat: dateFormat, abuseReport: generateAbuseReport(scamEntry) });
	else res.render('domain', { type: 'neutral', domain: hostname, result: false, urlScan: urlScan, metamask: checkForPhishing(hostname), googleSafeBrowsing: googleSafeBrowsing, virusTotal: virusTotal, addresses: [], startTime: startTime });
});

/* Scams index */
router.get('/scams/:page?/:sorting?/', (req, res) => {
	const MAX_RESULTS_PER_PAGE = 30;
	const scamList = [];
	let scams = [...db.read().scams].reverse();
	let index = [0,MAX_RESULTS_PER_PAGE];

	if(req.params.page && req.params.page != 'all' && (!isFinite(parseInt(req.params.page)) || isNaN(parseInt(req.params.page)) || parseInt(req.params.page) < 1)) {
		res.status(404).render('404');
	} else {
		if (req.params.sorting == 'oldest') scams = db.read().scams;
		else if (req.params.sorting == 'status') scams = [...db.read().scams].sort((a,b) => (a.status || '').localeCompare(b.status || ''));
		else if (req.params.sorting == 'category') scams = [...db.read().scams].sort((a,b) => (a.category || '').localeCompare(b.category || ''));
		else if (req.params.sorting == 'subcategory') scams = [...db.read().scams].sort((a,b) => (a.subcategory || '').localeCompare(b.subcategory || ''));
		else if (req.params.sorting == 'name') scams = [...db.read().scams].sort((a,b) => a.getHostname().localeCompare(b.getHostname()));

		if (req.params.page == "all") index = [0,scams.length-1];
		else if(req.params.page) index = [(req.params.page-1) * MAX_RESULTS_PER_PAGE,(req.params.page * MAX_RESULTS_PER_PAGE)];

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
router.get('/api/blacklist', (req, res) => res.json(db.read().index.blacklist));
router.get('/api/whitelist', (req, res) => res.json(db.read().index.whitelist));
router.get('/api/abusereport/:domain', (req, res) => {
	const result = db.read().scams.find(scam => scam.getHostname() == url.parse(req.params.domain).hostname || scam.url.replace(/(^\w+:|^)\/\//, '') == req.params.domain);
	if (result) res.json({ success: false, message: "URL wasn't found"});
	else res.send({ success: true, result: generateAbuseReport(result)});
});
router.get('/api/check/:search', (req,res) => {
	if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.search)) {
		/* Searched for an ethereum address */
		const whitelistAddresses = Object.keys(db.read().index.whitelistAddresses).filter(address => req.params.search.toLowerCase() === address.toLowerCase());
		const blacklistAddresses = Object.keys(db.read().index.addresses).filter(address => req.params.search.toLowerCase() === address.toLowerCase());
		if(whitelistAddresses.length > 0) {
			res.json({
				success: true,
				result: 'whitelisted',
				type: 'address',
				entries: whitelistAddresses.map(address => db.read().index.whitelistAddresses[address])
			});
		} else if(blacklistAddresses.length > 0) {
			res.json({
				success: true,
				result: 'blocked',
				type: 'address',
				entries: blacklistAddresses.map(address => db.read().index.addresses[address])
			});
		} else {
			res.json({
				success: true,
				result: 'neutral',
				type: 'address',
				entries: []
			});
		}
	} else if(/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/.test(req.params.search)) {
		/* Searched for a domain */
		const whitelistURL = db.read().verified.find(entry => (url.parse(req.params.search).hostname || req.params.search) === (url.parse(entry.url).hostname));
		const blacklistURL = db.read().scams.find(entry => (url.parse(req.params.search).hostname || req.params.search) === entry.getHostname());
		if(whitelistURL) {
			res.json({
				success: true,
				result: 'verified',
				type: 'domain',
				entries: [whitelistURL]
			});
		} else if(blacklistURL) {
			res.json({
				success: true,
				result: 'blocked',
				type: 'domain',
				entries: [blacklistURL]
			});
		} else {
			res.json({
				success: true,
				result: 'neutral',
				type: 'domain',
				entries: []
			});
		}
	} else if(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(req.params.search)) {
		/* Searched for an ip address */
		const blacklistIP = Object.keys(db.read().index.ips).filter(ip => req.params.search.toLowerCase() === ip.toLowerCase());
		if(blacklistIP.length > 0) {
			res.json({
				success: true,
				result: 'blocked',
				type: 'ip',
				entries: blacklistIP
			});
		} else {
			res.json({
				success: true,
				result: 'neutral',
				type: 'ip',
				entries: []
			});
		}
	} else {
		res.json({
			success: false,
			message: "Incorrect search type (must be ethereum address / ip address / URL)"
		});
	}
});

/* Incoming Github webhook attempt */
router.post('/update/', (req, res) => {
	req.rawBody = '';
	req.setEncoding('utf8');
	req.on('data', chunk => req.rawBody += chunk);
	req.on('end', () => github.webhook(req,res));
});

/* Safe redirect pages */
router.get('/redirect/:url', (req,res) => res.render('redirect', { url: req.params.url }));


module.exports = router;

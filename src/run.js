'use strict';

const debug = require('debug')('app');
const fs = require('fs');
const express = require('express');
const yaml = require('js-yaml');
const ejs = require('ejs');
const db = require.main.require('./utils/db');
const config = require.main.require('./utils/config');
const app = express();

(async () => {
	await db.init();
	await Promise.all(yaml.safeLoad(fs.readFileSync('_data/scams.yaml')).map(scam => db.run("INSERT OR REPLACE INTO scams VALUES (?,?,?,null,null,null,?,?,?,0)",[scam.id,scam.name,scam.url,scam.category,scam.subcategory,scam.description])));
	await Promise.all(yaml.safeLoad(fs.readFileSync('_data/legit_urls.yaml')).map(verified => db.run("INSERT OR REPLACE INTO verified_urls VALUES (?,?,?,?,?)",[verified.id,verified.name,verified.url,verified.featured+0,verified.description])));
    
	app.set('view engine', 'ejs');
	app.set('views','./src/views/pages');
    app.use(express.static('./src/views/static'));
    app.use(require('body-parser').json());
	
	app.get('/(/|index.html)?', (req, res) => res.render('index'));
	app.get('/faq/', (req, res) => res.render('faq'));
	app.get('/api/', (req, res) => res.render('api'));
	
	app.get('/report/', (req, res) => res.render('report'));
	app.get('/report/domain/:domain', (req, res) => res.render('report', { domain: req.params.domain }));
	app.get('/report/address/:address', (req, res) => res.render('report', { address: req.params.address }));
	
	app.get('/ip/:ip', async (req, res) => res.render('ip', { ip: req.params.ip, related: await db.all("SELECT * FROM scams WHERE ip=? ORDER BY id DESC",[req.params.ip]) }));
	app.get('/address/:address', async (req, res) => res.render('address', { address: req.params.address, related: await db.all("SELECT * FROM scams WHERE address=? ORDER BY id DESC",[req.params.address]) }));

	app.get('/search/', async (req, res) => res.render('search', { featured: await db.all("SELECT * FROM verified_urls WHERE featured=1 ORDER BY name ASC") }));
	app.get('/rss/', async (req, res) => res.render('rss', { scams: await db.all("SELECT * FROM scams ORDER BY id ASC") }));
	
	app.get('/redirect/:url', (req,res) => res.render('redirect', { url: req.params.url }));
    app.get('*', (req, res) => res.status(404).render('404'));

    app.listen(config.port, () => debug('Content served on http://localhost:%s',config.port));
})();

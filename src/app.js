'use strict';

const debug = require('debug')('app');
const {fork} = require('child_process');
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const db = require('./utils/db');
const github = require('./utils/github');
const config = require('./utils/config');
const writeConfig = require('./utils/writeConfig');
const app = express();

module.exports.check = (input) => {
	/* TODO: add isMalicious check */
}

module.exports.update = async () => {
	if(config.lookups.DNS.IP.enabled || config.lookups.DNS.NS.enabled || config.lookups.HTTP.enabled) {
		debug("Spawning update process...");
		const updateProcess = fork(path.join(__dirname,'scripts/update.js'));
		updateProcess.on('message', data => db.write(data.url,data));
		updateProcess.on('exit', () => setTimeout(() => this.update(),config.interval.cacheRenewCheck));
	}
}

module.exports.serve = async (electronApp) => {
	/* Initiate database */
	await db.init();

	/* Allow both JSON and URL encoded bodies */
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	/* Set security headers */
	app.use(helmet());
	app.use(helmet.referrerPolicy());

	/* Set EJS config */
	app.set('view engine', 'ejs');
	app.set('views',path.join(__dirname,'views/pages'));
	app.locals.environment = process.env.NODE_ENV;
	app.locals.announcement = config.announcement;

	/* Compress pages */
	app.use(require('compression')());

	/* Serve static content*/
	app.use(express.static(path.join(__dirname,'views/static')));

	/* Configuration middleware */
	app.use(async (req,res,next) => {
		const {NODE_ENV} = process.env;
		if(!config.manual && req.path != '/config/' && NODE_ENV == 'development') res.render('config', { production: false, done: false });
		else if(!config.manual && req.path != '/config/' && NODE_ENV == 'production')  res.render('config', { production: true, done: false });
		else if(req.path == '/config' && (req.method != 'POST' || !req.body || config.manual)) res.status(403).end();
		else if(req.path == '/config/' && req.method == 'POST' && !config.manual) {
			await writeConfig(req.body);
			if(electronApp) {
				electronApp.relaunch();
				electronApp.exit();
			} else {
				res.render('config', { production: false, done: true });
			}
		}
		else next();
	});

	/* Serve all routes (see src/utils/router.js) */
	app.use(require('./utils/router'));

	/* Serve all other pages as 404 */
    app.get('*', (req, res) => res.status(404).render('404'));

	/* Listen to port (defined in config */
	app.listen(config.port, () => debug('Content served on http://localhost:%s',config.port));

	/* Update scams after 100ms timeout (to process async) */
	setTimeout(() => this.update(),100);

	/* If auto pulling from Github is enabled; schedule timer */
	if(config.autoPull.enabled) setInterval(github.pullData,config.autoPull.interval);
}

if(!module.parent) this.serve();

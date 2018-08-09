'use strict';

const debug = require('debug')('app');
const {fork} = require('child_process');
const express = require('express');
const db = require('./utils/db');
const path = require('path');
const config = require('./utils/config');
const writeConfig = require('./utils/writeConfig');
const app = express();

const updateScams = async () => {
	if(config.lookups.IP.enabled || config.lookups.DNS.enabled || config.lookups.HTTP.enabled) {
		debug("Spawning update process...");
		const updateProcess = fork(path.join(__dirname,'scripts/update.js'));
		updateProcess.on('message', data => db.write(data.url,data));
		updateProcess.on('exit', () => setTimeout(updateScams,config.interval.cacheRenewCheck));
	}
}

const init = async (electronApp) => {
	/* Initiate database */
	await db.init();
	
	/* Allow both JSON and URL encoded bodies */
	app.use(express.json());
	app.use(express.urlencoded());
    
	/* Set EJS views */
	app.set('view engine', 'ejs');
	app.set('views',path.join(__dirname,'views/pages'));
	
	/* Compress pages */
	app.use(require('compression')());
	
	/* Serve static content*/
	app.use(express.static(path.join(__dirname,'views/static')));
	
	/* Configuration middleware */
	app.use(async (req,res,next) => {
		if(!config.manual && req.path != '/config/') res.render('config', { done: false });
		else if(req.path == '/config' && (req.method != 'POST' || !req.body || config.manual)) res.status(403).end();
		else if(req.path == '/config/' && req.method == 'POST' && !config.manual) {
			await writeConfig(req.body);
			if(electronApp) {
				electronApp.relaunch();
				electronApp.exit();
			} else {
				res.render('config', { done: true });
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
	setTimeout(updateScams,100);
}

module.exports = init;

if(!module.parent) init();

const {app, BrowserWindow, Menu} = require('electron');
const util = require('util');
const esdb = require('./app');
const serialijse = require("serialijse");
const config = require('./utils/config');
const db = require('./utils/db');

app.on('ready', async () => {
	await esdb();
	
	const mainWindow = new BrowserWindow({
		icon: "./src/assets/icon.ico",
		titleBarStyle: 'hidden',
		webPreferences: {
			nodeIntegration: false
		},
		show: false,
		darkTheme: true
	});
	
	const windowMenu = Menu.buildFromTemplate([
		{
			label: 'Main',
			click: () => mainWindow.loadURL('http://localhost:' + config.port)
		}, {
			type: 'separator'
		}, {
			label: 'Add scam',
			click: () => mainWindow.loadURL()
		}, {
			type: 'separator'
		}, {
			label: 'Debug',
			submenu: [
				{
					role: 'reload'
				}, {
					role: 'forcereload'
				}, {
					role: 'toggledevtools'
				}, {
					type: 'separator'
				}, {
					label: 'Inspect cache',
					click: () => mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURI('<pre>' + util.inspect(db.read()) + '</pre>'))
				}
			]
		}
	]);
	
	Menu.setApplicationMenu(windowMenu);
	mainWindow.loadURL('http://localhost:' + config.port);
	mainWindow.once('ready-to-show', () => {
		mainWindow.maximize();
		mainWindow.show();
		mainWindow.focus();
	});
	let handled = false;
	app.on('window-all-closed', app.quit);
	app.on('before-quit', (event) => {
		event.preventDefault();
		mainWindow.removeAllListeners('close');
		if(!handled) {
			handled = true;
			console.log("Cleaning up...");
			db.exitHandler();
			console.log("Exited.");
			mainWindow.close();
			process.exit();
		}
	});
});
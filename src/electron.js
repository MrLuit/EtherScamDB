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
		backgroundColor: '#333333',
		darkTheme: true
	});
	
	const windowMenu = Menu.buildFromTemplate([
		{
			label: 'Main',
			click: () => mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURI('<iframe frameborder="0" style="height: 100%; width: 100%;" src="http://localhost:' + config.port + '">'))
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
});
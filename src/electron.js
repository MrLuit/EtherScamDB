const {app, BrowserWindow, Menu} = require('electron');
const esdb = require('./run');
const config = require('./utils/config');

app.on('ready', async () => {
	await esdb();
	
	const mainWindow = new BrowserWindow({
		icon: "./src/assets/icon.ico",
		webPreferences: {
			nodeIntegration: false
		}
	});
	
	mainWindow.loadURL('http://localhost:' + config.port);
	mainWindow.focus();
});
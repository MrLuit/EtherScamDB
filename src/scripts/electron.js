const {app, BrowserWindow, Menu} = require('electron');
const util = require('util');
const config = require('../utils/config');
const db = require('../utils/db');

app.on('ready', async () => {
	const mainWindow = new BrowserWindow({
		icon: "./src/assets/favicon.ico",
		titleBarStyle: 'hidden',
		webPreferences: {
			nodeIntegration: false
		},
		show: false,
		darkTheme: true
	});
	const windowMenu = Menu.buildFromTemplate([{
		label: 'Main',
		click: () => mainWindow.loadURL('http://localhost:' + config.port)
	}, {
		type: 'separator'
	}, {
		label: 'Add scam',
		click: () => mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURI('<pre>WIP</pre>'))
	}, {
		type: 'separator'
	}, {
		label: 'Debug',
		submenu: [{
			role: 'reload'
		}, {
			role: 'forcereload'
		}, {
			role: 'toggledevtools'
		}, {
			type: 'separator'
		}, {
			label: 'Inspect database',
			click: () => mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURI('<pre>' + util.inspect(db.read()) + '</pre>'))
		}, {
			label: 'View config',
			click: () => mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURI('<pre>' + util.inspect(config) + '</pre>'))
		}]
	}]);
	Menu.setApplicationMenu(windowMenu);
	
	await require('../app')(app);
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
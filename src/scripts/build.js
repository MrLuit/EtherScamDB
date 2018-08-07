const rimraf = require('rimraf');
const builder = require('electron-builder');

const shouldBuildOs = (os) => {
	const { ELECTRON_OS } = process.env;
	if (ELECTRON_OS === 'JENKINS_LINUX') {
		return os === 'linux' || os === 'windows';
	} else if (ELECTRON_OS === 'JENKINS_MAC') {
		return os === 'mac';
	} else {
		return !process.env.ELECTRON_OS || process.env.ELECTRON_OS === os;
	}
}

(async () => {
	console.log('Building Electron apps...');
	
	rimraf.sync('./dist');
	rimraf.sync('./config.json');
	rimraf.sync('./cache.db');
	
	await builder.build({
		mac: shouldBuildOs('mac') ? ['zip', 'dmg'] : undefined,
		win: shouldBuildOs('windows') ? ['nsis'] : undefined,
		linux: shouldBuildOs('linux') ? ['AppImage'] : undefined,
		x64: true,
		ia32: true,
		config: {
			appId: 'info.etherscamdb',
			productName: 'EtherScamDB',
			directories: {
				app: './',
				output: './dist'
			},
			mac: {
				category: 'public.app-category.utilities',
				icon: './assets/favicon.icns',
				compression: 'store'
			},
			win: {
				icon: './assets/favicon.ico',
				compression: 'store'
			},
			linux: {
				category: 'Utilities',
				icon: './assets/favicon.png',
				compression: 'store'
			},
			publish: null,
			extends: null
		}
	});

    console.log("Electron builds are finished!");
})();
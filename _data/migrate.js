const fs = require('fs');
const yaml = require('js-yaml');

/* Retrieve old YAML objects */
const oldScamEntries = yaml.safeLoad(fs.readFileSync('./scams.yaml','utf8'));
const oldVerifiedEntries = yaml.safeLoad(fs.readFileSync('./legit_urls.yaml','utf8'));

/* scams.yaml: remove every 'id' and 'name' property */
const newScamEntries = oldScamEntries.map(entry => {
	delete entry.id;
	delete entry.name;
	return entry;
});

/* legit_urls.yaml: remove every 'id' property */
const newVerifiedEntries = oldVerifiedEntries.map(entry => {
	delete entry.id;
	return entry;
});

/* Write new YAML to files */
fs.writeFileSync('./scams.yaml',yaml.safeDump(newScamEntries,{ lineWidth: 99999999, indent: 4 }));
fs.writeFileSync('./legit_urls.yaml',yaml.safeDump(newVerifiedEntries,{ lineWidth: 99999999, indent: 4 }));
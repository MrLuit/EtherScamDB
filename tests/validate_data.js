const assert = require('assert');
const yaml = require('js-yaml');
const fs = require('fs');
describe('YAML Validator', function() {
	describe('scams.yaml', function() {
		it('should contain valid YAML', function(){
			assert.doesNotThrow(() => yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')));
		});
		it('every entry should have an ID', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')).filter(entry => !('id' in entry)),[]);
		});
		it('every entry should have a name', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')).filter(entry => !('name' in entry)),[]);
		});
		it('every entry should have a url', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')).filter(entry => !('url' in entry)),[]);
		});
		it('every ID should be numeric', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')).filter(entry => isNaN(parseInt(entry.id))),[]);
		});
		it('every url should specify its protocol (http:// or https:// or mailto:)', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')).filter(entry => !entry.url.startsWith('http://') && !entry.url.startsWith('https://') && !entry.url.startsWith('mailto:')),[]);
		});
	});
	describe('legit_urls.yaml', function() {
		it('should contain valid YAML', function(){
			assert.doesNotThrow(() => yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')));
		});
		it('every entry should have an ID', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')).filter(entry => !('id' in entry)),[]);
		});
		it('every entry should have a name', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')).filter(entry => !('name' in entry)),[]);
		});
		it('every entry should have a url', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')).filter(entry => !('url' in entry)),[]);
		});
		it('every ID should be numeric', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')).filter(entry => isNaN(parseInt(entry.id))),[]);
		});
		it('every url should specify its protocol (http:// or https://)', function() {
			assert.deepEqual(yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')).filter(entry => !entry.url.startsWith('http://') && !entry.url.startsWith('https://')),[]);
		});
	});
});
describe('JSON Validator', function() {
	describe('twitter.json', function() {
		it('should contain valid JSON', function(){
			assert.doesNotThrow(() => JSON.parse(fs.readFileSync('./_data/twitter.json', 'utf8')));
		});
	});
	describe('metamaskImports.json', function() {
		it('should contain valid JSON', function(){
			assert.doesNotThrow(() => JSON.parse(fs.readFileSync('./_data/metamaskImports.json', 'utf8')));
		});
	});
});
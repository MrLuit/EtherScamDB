const assert = require('assert');
const yaml = require('js-yaml');
const fs = require('fs');
describe('YAML Validator', function() {
	describe('scams.yaml', function() {
		this.slow(100);
		it('should contain valid YAML', function(){
			assert.doesNotThrow(() => yaml.safeLoad(fs.readFileSync('./_data/scams.yaml', 'utf8')));
		});
	});
	describe('legit_urls.yaml', function() {
		this.slow(100);
		it('should contain valid YAML', function(){
			assert.doesNotThrow(() => yaml.safeLoad(fs.readFileSync('./_data/legit_urls.yaml', 'utf8')));
		});
	});
});
describe('JSON Validator', function() {
	describe('twitter.json', function() {
		this.slow(100);
		it('should contain valid JSON', function(){
			assert.doesNotThrow(() => JSON.parse(fs.readFileSync('./_data/twitter.json', 'utf8')));
		});
	});
	describe('metamaskImports.json', function() {
		this.slow(100);
		it('should contain valid JSON', function(){
			assert.doesNotThrow(() => JSON.parse(fs.readFileSync('./_data/metamaskImports.json', 'utf8')));
		});
	});
});
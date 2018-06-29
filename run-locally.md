## EtherScamDB 

### Requirements:

* node js (working on v8.9.4)
* npm (working on v5.6.0)
* git

### Spin-Up Process:

* `git clone https://github.com/mrluit/etherscamdb.git` - This will clone the project locally.
* `cd etherscamdb` - Navigate into your newly-created project folder.
* Rename the `config.example.js` file to `config.js`
   * Input API keys for abuseipdb, github, google safebrowsing, and urlscan.
* Ensure the option `ping_domains` is set to `0` so you don’t contact any of the bad domains on your local machine.
* `npm install` - This will install required dependencies
* `npm update` - This will create and update a new `_cache/cache.json` file inside the project folder.
* `npm run` - This will start the project running locally at `http://localhost:8080`

### Why should I run it myself?

Running it yourself will mean you can have your own instance of EtherScamDb so you will have a GUI and an API in case for 
whatever reason the etherscamdb.info domain is down. This is important to know as products start integrating with our APIs 
and you will want to have the option of privacy - for example, checking our APIs for specific addresses especially in an 
integration where we are checking if the address is blacklisted could be a privacy concern for you.

![EtherScamDB Logotype](https://raw.githubusercontent.com/MrLuit/EtherScamDB/master/_static/logo/logotype-readme.png)

# Ethereum Scam Database

*An open-source database to keep track of all the current ethereum scams*

## Why should I run it myself?

Running it yourself will mean you can have your own instance of EtherScamDb so you will have a GUI and an API in case for 
whatever reason the etherscamdb.info domain is down. This is important to know as products start integrating with our APIs 
and you will want to have the option of privacy - for example, checking our APIs for specific addresses especially in an 
integration where we are checking if the address is blacklisted could be a privacy concern for you.

## Usage

Make sure you have both [Node.JS](https://nodejs.org/en/download/) and [Git](https://git-scm.com/downloads) installed.

Then, open a command line anywhere and run the following commands:

> git clone https://github.com/MrLuit/EtherScamDB.git

> cd EtherScamDB

> npm install

> npm start

The command line should now exit, asking you to update the config.js file with correct values. Please use your own API keys (preferably abuseipdb, github, google safebrowsing, and urlscan). When you're done, launch run.js again:

> npm start

Generating should take a couple of minutes the first time or after a clean, but when `cache.db` is already present it should launch instantly.

## Contribute

Fork this project and edit `_data/data.yaml`. Every item can have the following properties:

- **id**: A unique incremental integer
- **name**: The title of the scam, should probably not be longer than 64 characters
- **url**: The protocol + hostname for a scam website, without a trailing `/` **(Optional)**
- **description**: A full description for the scam **(Optional)**
- **category**: The category under which the item falls **(Optional)**
- **addresses**: An array of all ethereum addresses that were involved in this scam, with leading '0x'  **(Optional)**

## API

To make use of our database, the following API can be used: https://etherscamdb.info/api/

## Donate

If you would like to help without contributing on GitHub yourself you can send some ETH or ERC20 tokens to [etherscamdb.eth](https://etherscan.io/address/etherscamdb.eth) :clap:

## Thanks

* Thanks to [Tobaloidee](https://github.com/Tobaloidee) for doing the logos!

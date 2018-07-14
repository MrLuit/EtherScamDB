process.env.UV_THREADPOOL_SIZE = 128;
const dns = require('dns');
const url = require('url');
const yaml = require('js-yaml');
const fs = require('fs');
const request = require("request");
const download = require('download-file');
const config = require('./config');

let cache = JSON.parse(fs.readFileSync('_cache/cache.json'));

let changemade = false;
let scams_checked = 0;
let legitcheck = 0;
let requests_pending = 0;
var scamchecklist = [];
var legitchecklist = [];
var legiturls;
console.time("timingquickadd");
console.time("timinglegitquickadd");

// Download newest files
let downloadcomplete = function(){
    return new Promise(function(resolve, reject) {
        console.time("timingquickadd");
        download("https://raw.githubusercontent.com/" + config.repository.author + "/" + config.repository.name + "/" + config.repository.branch + "/_data/scams.yaml?no-cache=" + (new Date()).getTime(), {
            directory: "_data/",
            filename: "scams.yaml"
        }, function(err) {
            if (err) throw err;
            resolve();
        });
    })
}


// Create a new cache that contains same data as old

var new_cache = cache;
let scamsdetected = 0;
let scamsnotdetected = 0;

let scamtestcomplete = function(){
    return new Promise(function(resolve, reject){
        //console.log("starting scamtest now")
        //console.log("changed new_cache.updated to: " + new_cache.updated)
        yaml.safeLoad(fs.readFileSync('_data/scams.yaml'), function(err) {
          if(err) throw(err);
        }).forEach(function(scam, index) {
            scams_checked += 1;
            //scamdata = JSON.stringify(scam, null, 2)
            for(var i = 0; i < new_cache.scams.length; i++) {
                if( url.parse(new_cache.scams[i].url).hostname == url.parse(scam.url).hostname ) {
                    scamsdetected += 1;
                    break;
                }
                else if( i == new_cache.scams.length - 1) {
                    scamsnotdetected += 1;
                    changemade = true;

                    // Not detected, add scam to cache
                    if ('url' in scam) {
                          if (!scam.url.includes('http://') && !scam.url.includes('https://')) {
                              console.log('Warning! Entry ' + scam.id + ' has no protocol (http or https) specified. Please update!');
                              scam.url = 'http://' + scam.url;
                          }
                          if (scam.addresses != null) {
                            scam.addresses.forEach(function(address, index) {
                              scam.addresses[index] = scam.addresses[index].toLowerCase();
                            })
                          }
                          var scam_details = new_cache.scams[new_cache.scams.push(scam) - 1];
                          new_cache.blacklist.push(url.parse(scam.url).hostname.replace("www.", ""));
                          new_cache.blacklist.push('www.' + url.parse(scam.url).hostname.replace("www.", ""));
                          dns.lookup(url.parse(scam.url).hostname, (err, address, family) => {
                              if (!err) {
                                  scam_details.ip = address;
                              }
                              dns.resolveNs(url.parse(scam.url).hostname, (err, addresses) => {
                                  if (!err) {
                                      scam_details.nameservers = addresses;
                                  }
                                  requests_pending++;
                                  var r = request(scam.url, {timeout: 30*1000}, function(e, response, body) {
                                      requests_pending--;
                                      if (e || !([200, 301, 302].includes(response.statusCode))) {
                                          scam_details.status = 'Offline';
                                          new_cache.inactives.push(scam);
                                      } else if (r.uri.href.indexOf('cgi-sys/suspendedpage.cgi') !== -1) {
                                          scam_details.status = 'Suspended';
                                          new_cache.inactives.push(scam);
                                      } else {
                                          if ('subcategory' in scam && scam.subcategory == 'MyEtherWallet') {
                                              requests_pending++;
                                              request('http://' + url.parse(scam.url).hostname.replace("www.", "") + '/js/etherwallet-static.min.js', {timeout: 30*1000}, function(e, response, body) {
                                                  requests_pending--;
                                                  if (!e && response.statusCode == 200) {
                                                      scam_details.status = 'Active';
                                                      new_cache.actives.push(scam);
                                                  } else {
                                                      scam_details.status = 'Inactive';
                                                      new_cache.inactives.push(scam);
                                                  }
                                              });
                                          } else if ('subcategory' in scam && scam.subcategory == 'MyCrypto') {
                                              requests_pending++;
                                              request('http://' + url.parse(scam.url).hostname.replace("www.", "") + '/js/mycrypto-static.min.js', {timeout: 30*1000}, function(e, response, body) {
                                                  requests_pending--;
                                                  if (!e && response.statusCode == 200) {
                                                      scam_details.status = 'Active';
                                                      new_cache.actives.push(scam);
                                                  } else {
                                                      scam_details.status = 'Inactive';
                                                      new_cache.inactives.push(scam);
                                                  }
                                              });
                                          } else if (body == '') {
                                              scam_details.status = 'Inactive';
                                              new_cache.inactives.push(scam);
                                          } else {
                                              scam_details.status = 'Active';
                                              new_cache.actives.push(scam);
                                          }
                                      }
                                      if ('ip' in scam_details) {
                                          if (!(scam_details.ip in new_cache.ips)) {
                                              new_cache.ips[scam_details.ip] = [];
                                          }
                                          new_cache.ips[scam_details.ip] = scam_details;
                                      }
                                      if ('addresses' in scam_details) {
                                          scam_details.addresses.forEach(function(address) {
                                              if (!(address.toLowerCase() in new_cache.addresses)) {
                                                  new_cache.addresses[address.toLowerCase()] = [];
                                              }
                                              new_cache.addresses[address.toLowerCase()] = scam_details;
                                          });
                                      }
                            scams_checked++;
                            if(index == (new_cache.scams.length-1)) {
                              var done_interval = setInterval(function() {
                                //console.log(requests_pending);
                                if (requests_pending == 0) {
                                  clearInterval(done_interval);
                                  Object.keys(new_cache.ips).forEach(function(ip) {
                                    new_cache.blacklist.push(ip);
                                  });
                                  fs.writeFileSync("_cache/cache.json", JSON.stringify(new_cache));
                                  console.log("Done");
                                  process.abort();
                                }
                              }, 500);
                            }
                                  });
                              });
                          });
                      } else {
                          console.log("Fatal error: Scam without URL found (" + scam.id + ")");
                          process.abort();
                      }
                }
                if( scamsdetected == index ){
                  resolve();
                }
            }
        });
    });
};

let addUpdate = function(){
    return new Promise(function(resolve, reject){
        if(changemade == false){
            new_cache.updated = (new Date()).getTime();
            fs.writeFileSync("_cache/cache.json", JSON.stringify(new_cache));
            process.abort();
        }
        resolve();
    })
}

var checkchangemade = setInterval(function(){
      if(changemade == true){
          new_cache.updated = (new Date()).getTime();
          clearInterval(checkchangemade);
      }
}, 1000)


downloadcomplete().then(function(){
    return scamtestcomplete();
}).then(function(){
    return addUpdate();
}).then(function(){
    console.timeEnd("timingquickadd");
})

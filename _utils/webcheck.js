const request = require('request')

class web {
  lookup (input) {
    return new Promise(function(resolve, reject) {
      var result = request('https://urlscan.io/api/v1/search/?q=domain:' + encodeURIComponent(input),{timeout: 30*1000}, function(e, response, body) {
        if(e || !([200, 301, 302].includes(response.statusCode))) {
          resolve(e)
        }
        else if(!e && response.statusCode == 200){
          resolve(JSON.parse(body))
        }
      });
    });
  }
}
module.exports = web

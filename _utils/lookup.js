const request = require('request')

class weblookup {
  lookup (input) {
    return new Promise(function(resolve, reject) {
      var result = request(input,
      {timeout: 30*1000}, function(e, response, body) {
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
module.exports = weblookup

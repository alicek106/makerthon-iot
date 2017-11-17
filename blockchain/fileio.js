exports.writeKey = (filename, data) => {
    var fs = require('fs')
    fs.writeFileSync(filename, data, 'utf8');
}

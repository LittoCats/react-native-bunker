/**
 *  This is just a shadow module for general import
 *  
 *  The implemention is ${projRoot}/node_modules/react-bunker-entry.js
 *  
 *  So, you should import react-bunker-entry as early as you can in app's main bundle.
 */
var symbol = require('./src/symbol');
module.exports = global[symbol];

const velocityjs = require('velocityjs');

console.log(JSON.stringify(velocityjs.parse('$foo.prototype'), null, 2));
console.log(JSON.stringify(velocityjs.parse('$foo["constructor"]'), null, 2));
console.log(JSON.stringify(velocityjs.parse('$foo[$bar]'), null, 2));

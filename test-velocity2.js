const velocityjs = require('velocityjs');

const template3 = velocityjs.parse('$foo[$bar]');
console.log(JSON.stringify(template3, null, 2));

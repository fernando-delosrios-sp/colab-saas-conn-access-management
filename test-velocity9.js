const velocityjs = require('velocityjs');

const t4 = velocityjs.parse('#set($a = "constructor")\n$foo[$a]');
console.log(JSON.stringify(t4, null, 2));

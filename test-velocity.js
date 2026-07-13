const velocityjs = require('velocityjs');

const template = velocityjs.parse('$foo.prototype');
console.log(JSON.stringify(template, null, 2));

const template2 = velocityjs.parse('$foo["prototype"]');
console.log(JSON.stringify(template2, null, 2));

const template3 = velocityjs.parse('$foo[$bar]');
console.log(JSON.stringify(template3, null, 2));

const template4 = velocityjs.parse('$foo["__pro" + "to__"]');
console.log(JSON.stringify(template4, null, 2));

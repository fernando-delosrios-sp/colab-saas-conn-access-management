const velocityjs = require('velocityjs');

const context = {
    foo: {},
    bar: "constructor"
};

const template = velocityjs.parse('#set($fn = $foo[$bar])\n$fn');
const comp = new velocityjs.Compile(template);
console.log(comp.render(context));

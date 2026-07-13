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
                (
                    (id.type === 'string' && (id.value === 'constructor' || id.value === '__proto__')) ||
                    id.isEval === true ||
                    id.type === 'references' ||
                    id.type === 'math'
                )
            )
        )
            return true

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key])) return true
        }
    }

    return false
}

const t1 = velocityjs.parse('$foo.prototype');
console.log('t1 (prototype)', isUnsafeVelocityAST(t1));

const t2 = velocityjs.parse('$foo[$bar]');
console.log('t2 (dynamic ref)', isUnsafeVelocityAST(t2));

const t3 = velocityjs.parse('$foo["constructor"]');
console.log('t3 (string index)', isUnsafeVelocityAST(t3));

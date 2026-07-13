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
            id === 'prototype' || // Added prototype
            (nodes.type === 'index' &&
                id &&
                (
                    (id.type === 'string' && (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype')) ||
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

console.log('prototype via property', isUnsafeVelocityAST(velocityjs.parse('$foo.prototype'))); // true
console.log('dynamic index', isUnsafeVelocityAST(velocityjs.parse('$foo[$bar]'))); // true

import velocityjs from 'velocityjs'

function evaluateASTNode(node: any, vars: Record<string, string>): string | undefined {
    if (!node) return undefined

    if (node.type === 'string') {
        return node.value
    }

    if (node.type === 'references' && typeof node.id === 'string') {
        const val = vars[node.id]
        if (val !== undefined) return val
    }

    if (node.type === 'math' && node.operator === '+') {
        const left = node.expression[0]
        const right = node.expression[1]
        const leftVal = evaluateASTNode(left, vars)
        const rightVal = evaluateASTNode(right, vars)

        if (leftVal !== undefined && rightVal !== undefined) {
            return leftVal + rightVal
        }
    }

    return undefined
}

// Security: Track variable assignments and inline math string concatenations within #set directives to resolve sensitive keys and prevent unsafe evaluations.
function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target && target.type === 'references' && typeof target.id === 'string') {
                const evaluated = evaluateASTNode(expr, vars)
                if (evaluated !== undefined) {
                    vars[target.id] = evaluated
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        let resolvedIdValue = undefined
        if (nodes.type === 'index' && id) {
            resolvedIdValue = evaluateASTNode(id, vars)
        }

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (resolvedIdValue !== undefined &&
                (resolvedIdValue === 'constructor' ||
                    resolvedIdValue === '__proto__' ||
                    resolvedIdValue === 'prototype'))
        ) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], vars)) return true
        }
    }

    return false
}

// ⚡ Bolt: Cache compiled velocity templates to avoid redundant parsing/compilation
const templateCache = new Map<string, any>()

/**
 * Evaluates a Velocity template string with the given context.
 *
 * @param template - Velocity template string (e.g. "$name - $value")
 * @param context - Key-value context for template variables
 * @returns Rendered string
 * @throws Error if template parsing or rendering fails
 */
export function evaluateVelocityExpression(template: string, context: Record<string, unknown> = {}): string {
    let velocity = templateCache.get(template)
    if (!velocity) {
        const velocityTemplate = velocityjs.parse(template)
        if (isUnsafeVelocityAST(velocityTemplate)) {
            throw new Error('Invalid template: access to constructor, __proto__, or prototype is not allowed')
        }
        velocity = new velocityjs.Compile(velocityTemplate)
        templateCache.set(template, velocity)
    }

    return velocity.render(context)
}

/**
 * Builds entitlement template context with both nested and top-level access.
 *
 * This keeps expressions backward-compatible:
 * - Preferred: $entitlement.name
 * - Supported alias: $name
 */
export function buildEntitlementVelocityContext<T extends object>(
    entitlement: T,
    additionalContext: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        entitlement,
        ...(entitlement as Record<string, unknown>),
        ...additionalContext,
    }
}

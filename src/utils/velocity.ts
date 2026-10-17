import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, vars: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        // Track variable assignments to prevent SSTI via string concatenation bypass
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [left, right] = nodes.equal
            if (left.type === 'references' && typeof left.id === 'string') {
                const evalExpr = (expr: any): string => {
                    if (!expr) return ''
                    if (expr.type === 'string') return expr.value || ''
                    if (expr.type === 'references' && typeof expr.id === 'string') return vars.get(expr.id) || ''
                    if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
                        return expr.expression.map(evalExpr).join('')
                    }
                    return ''
                }
                vars.set(left.id, evalExpr(right))
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Block unsafe identifier access
        if (typeof id === 'string' && (id === 'constructor' || id === '__proto__' || id === 'prototype')) {
            if (nodes.type !== 'string') return true
        }

        // Block unsafe property or method access
        if (nodes.type === 'method' || nodes.type === 'property') {
            if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true
        }

        // Block unsafe dynamic index access (e.g. $foo[$c])
        if (nodes.type === 'index' && id) {
            const val =
                id.type === 'string'
                    ? id.value
                    : id.type === 'references' && typeof id.id === 'string'
                    ? vars.get(id.id)
                    : ''
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') return true
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

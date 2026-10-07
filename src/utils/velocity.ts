import velocityjs from 'velocityjs'

export function isUnsafeVelocityAST(nodes: any, env: Record<string, string> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, env)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target && target.type === 'references' && target.id) {
                if (expr.type === 'string' && typeof expr.value === 'string') {
                    env[target.id] = expr.value
                } else if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
                    let val = ''
                    for (const op of expr.expression) {
                        if (op.type === 'string' && typeof op.value === 'string') {
                            val += op.value
                        } else if (op.type === 'references' && op.id && typeof env[op.id] === 'string') {
                            val += env[op.id]
                        } else {
                            val += '?'
                        }
                    }
                    env[target.id] = val
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (nodes.type === 'index' &&
                id &&
                ((id.type === 'string' &&
                    (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype')) ||
                    (id.type === 'references' &&
                        id.id &&
                        (env[id.id] === 'constructor' || env[id.id] === '__proto__' || env[id.id] === 'prototype'))))
        )
            return true

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], env)) return true
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

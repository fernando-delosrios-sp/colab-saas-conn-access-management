import velocityjs from 'velocityjs'

function evaluateExpression(expr: any, env: Map<string, string>): string | null {
    if (!expr) return null
    if (expr.type === 'string') return expr.value
    if (expr.type === 'references') return env.get(expr.id) || null
    if (expr.type === 'math' && expr.operator === '+') {
        const left = evaluateExpression(expr.expression[0], env)
        const right = evaluateExpression(expr.expression[1], env)
        if (left !== null && right !== null) {
            return left + right
        }
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, env: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, env)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && left.id) {
                const val = evaluateExpression(right, env)
                if (val !== null) {
                    env.set(left.id, val)
                }
            }
        }

        const id = nodes.id
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (nodes.type === 'index' &&
                id &&
                id.type === 'string' &&
                (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype'))
        )
            return true

        // Check if dynamic index accesses resolve to dangerous properties
        if (nodes.type === 'index' && id) {
            const val = evaluateExpression(id, env)
            if (val && (val === 'constructor' || val === '__proto__' || val === 'prototype')) {
                return true
            }
        }

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

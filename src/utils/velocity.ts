import velocityjs from 'velocityjs'

function evaluateStaticExpr(expr: any, env: Record<string, string>): string {
    if (!expr) return ''
    if (expr.type === 'string') return expr.value || ''
    if (expr.type === 'references' && expr.id) return env[expr.id] || ''
    if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
        return expr.expression.map((e: any) => evaluateStaticExpr(e, env)).join('')
    }
    return ''
}

function isUnsafeVelocityAST(nodes: any, env: Record<string, string> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, env)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true

        // Static tracking for #set directives to prevent evaluation bypass
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target.type === 'references' && target.id) {
                env[target.id] = evaluateStaticExpr(expr, env)
            }
        }

        // Validate index accessors for dangerous properties
        if (nodes.type === 'index' && nodes.id) {
            const val = evaluateStaticExpr(nodes.id, env)
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
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

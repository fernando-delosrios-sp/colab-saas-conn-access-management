import velocityjs from 'velocityjs'

function evaluateExpression(expr: any, vars: Record<string, string>): string {
    if (!expr) return ''
    if (expr.type === 'string') return expr.value || ''
    if (expr.type === 'references' && typeof expr.id === 'string') return vars[expr.id] || ''
    if (expr.type === 'math' && expr.operator === '+') {
        return evaluateExpression(expr.expression[0], vars) + evaluateExpression(expr.expression[1], vars)
    }
    return ''
}

function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        // Security: Track assignments for dynamic evaluation checks
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expression = nodes.equal[1]
            if (target && target.type === 'references' && typeof target.id === 'string') {
                vars[target.id] = evaluateExpression(expression, vars)
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const checkVal = (val: any) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        if (typeof id === 'string' && checkVal(id)) return true

        if (nodes.type === 'index' && id) {
            const evaluated = evaluateExpression(id, vars)
            if (checkVal(evaluated)) return true
        }

        for (const key of Object.keys(nodes)) {
            // Do not ignore equal property
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

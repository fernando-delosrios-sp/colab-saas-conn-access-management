import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Track assignments to identify dynamically constructed strings (e.g. 'con' + 'structor')
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target && target.type === 'references' && target.id) {
                let val = ''
                if (expr && expr.type === 'string' && typeof expr.value === 'string') {
                    val = expr.value
                } else if (expr && expr.type === 'math' && expr.operator === '+') {
                    const left = expr.expression && expr.expression[0]
                    const right = expr.expression && expr.expression[1]
                    if (left && right && left.type === 'string' && right.type === 'string') {
                        val = left.value + right.value
                    }
                }
                if (val) {
                    vars[target.id] = val
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isDangerous = (val: unknown) =>
            typeof val === 'string' && (val === 'constructor' || val === '__proto__' || val === 'prototype')

        if (isDangerous(id)) return true

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isDangerous(id.value)) return true
            if (id.type === 'references' && typeof id.id === 'string' && isDangerous(vars[id.id])) return true
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

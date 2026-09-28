import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, dangerousVars: Set<string> = new Set()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, dangerousVars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Check for direct references or properties
        if (typeof id === 'string' && (id === 'constructor' || id === '__proto__' || id === 'prototype')) {
            return true
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Track variable assignments
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target.type === 'references' && typeof target.id === 'string') {
                let val = ''
                if (expr.type === 'string' && typeof expr.value === 'string') {
                    val = expr.value
                } else if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
                    val = expr.expression
                        .filter((e: any) => e.type === 'string' && typeof e.value === 'string')
                        .map((e: any) => e.value)
                        .join('')
                }

                if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                    dangerousVars.add(target.id)
                }
            }
        }

        // Check index access
        if (nodes.type === 'index' && nodes.id) {
            const idx = nodes.id
            if (
                idx.type === 'string' &&
                typeof idx.value === 'string' &&
                (idx.value === 'constructor' || idx.value === '__proto__' || idx.value === 'prototype')
            ) {
                return true
            }
            if (idx.type === 'references' && typeof idx.id === 'string' && dangerousVars.has(idx.id)) {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], dangerousVars)) return true
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

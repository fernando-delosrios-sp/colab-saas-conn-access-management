import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, context = new Map<string, string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, context)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Track variable assignments for dynamic property evaluation prevention
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]

            if (target.type === 'references' && typeof target.id === 'string') {
                let value = ''
                if (expr.type === 'string') {
                    value = expr.value
                } else if (expr.type === 'math' && expr.operator === '+') {
                    if (Array.isArray(expr.expression)) {
                        for (const op of expr.expression) {
                            if (op.type === 'string') {
                                value += op.value
                            } else if (op.type === 'references' && typeof op.id === 'string') {
                                value += context.get(op.id) || ''
                            }
                        }
                    }
                }
                context.set(target.id, value)
            }
        }

        const isDangerous = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        // Apply dangerous identifier checks unconditionally to ALL node types (including references)
        if (
            (typeof id === 'string' && isDangerous(id)) ||
            (nodes.type === 'index' && id && id.type === 'string' && isDangerous(id.value)) ||
            (nodes.type === 'index' &&
                id &&
                id.type === 'references' &&
                typeof id.id === 'string' &&
                isDangerous(context.get(id.id) || ''))
        ) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], context)) return true
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

import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, unsafeVariables: Set<string> = new Set()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, unsafeVariables)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (nodes.type === 'index' &&
                id &&
                id.type === 'string' &&
                (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype'))
        ) {
            return true
        }

        if (nodes.type === 'index' && id && id.type === 'references' && unsafeVariables.has(id.id)) {
            return true
        }

        if (nodes.type === 'references' && typeof id === 'string' && unsafeVariables.has(id)) {
            return true
        }

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length >= 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]

            if (target && target.type === 'references') {
                const varName = target.id
                let val = ''

                if (expr && expr.type === 'string') {
                    val = expr.value
                } else if (expr && expr.type === 'math' && expr.operator === '+') {
                    if (Array.isArray(expr.expression)) {
                        for (const p of expr.expression) {
                            if (p && p.type === 'string') {
                                val += p.value
                            }
                        }
                    }
                }

                if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                    unsafeVariables.add(varName)
                }
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], unsafeVariables)) return true
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
export function evaluateVelocityExpression(
    template: string,
    context: Record<string, unknown> = {}
): string {
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

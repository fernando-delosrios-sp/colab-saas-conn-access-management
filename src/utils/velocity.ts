import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, variables: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, variables)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const value = nodes.equal[1]
            if (target.type === 'references' && typeof target.id === 'string') {
                if (value.type === 'string' && typeof value.value === 'string') {
                    variables.set(target.id, value.value)
                } else if (value.type === 'math' && value.operator === '+') {
                    let combined = ''
                    for (const expr of value.expression || []) {
                        if (expr.type === 'string' && typeof expr.value === 'string') {
                            combined += expr.value
                        } else if (expr.type === 'references' && typeof expr.id === 'string') {
                            combined += variables.get(expr.id) || ''
                        }
                    }
                    variables.set(target.id, combined)
                }
            }
        }

        if (typeof id === 'string' && (id === 'constructor' || id === '__proto__' || id === 'prototype')) {
            return true
        }

        if (nodes.type === 'index' && id) {
            let evaluated = ''
            if (id.type === 'string' && typeof id.value === 'string') {
                evaluated = id.value
            } else if (id.type === 'references' && typeof id.id === 'string') {
                evaluated = variables.get(id.id) || ''
            }
            if (evaluated === 'constructor' || evaluated === '__proto__' || evaluated === 'prototype') {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], variables)) return true
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

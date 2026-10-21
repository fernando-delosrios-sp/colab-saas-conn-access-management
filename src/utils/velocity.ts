import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, vars: Record<string, any> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && target.id) {
                if (expr.type === 'string') {
                    vars[target.id] = expr.value
                } else if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
                    let combined = ''
                    for (const term of expr.expression) {
                        if (term.type === 'string') {
                            combined += term.value
                        } else if (term.type === 'references' && term.id && typeof vars[term.id] === 'string') {
                            combined += vars[term.id]
                        } else {
                            combined = ''
                            break
                        }
                    }
                    if (combined) vars[target.id] = combined
                } else if (expr.type === 'references' && expr.id && typeof vars[expr.id] === 'string') {
                    vars[target.id] = vars[expr.id]
                }
            }
        }

        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const checkValue = (val: unknown) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        let resolvedIdValue = null
        if (nodes.type === 'index' && id) {
            if (id.type === 'string') {
                resolvedIdValue = id.value
            } else if (id.type === 'references' && id.id && typeof vars[id.id] === 'string') {
                resolvedIdValue = vars[id.id]
            }
        }

        if (checkValue(id) || (resolvedIdValue && checkValue(resolvedIdValue))) {
            return true
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

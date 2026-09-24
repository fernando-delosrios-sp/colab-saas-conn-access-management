import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, vars = new Map<string, string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Evaluate and track variables from #set directives
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && left.id) {
                if (right.type === 'string') {
                    vars.set(left.id, right.value)
                } else if (right.type === 'math' && right.operator === '+' && Array.isArray(right.expression)) {
                    let val = ''
                    for (const exp of right.expression) {
                        if (exp.type === 'string') {
                            val += exp.value
                        } else if (exp.type === 'references' && exp.id && vars.has(exp.id)) {
                            val += vars.get(exp.id)
                        } else {
                            val = ''
                            break
                        }
                    }
                    if (val) vars.set(left.id, val)
                } else if (right.type === 'references' && right.id && vars.has(right.id)) {
                    vars.set(left.id, vars.get(right.id)!)
                }
            }
        }

        const isDangerous = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        // Check property and method nodes
        if (nodes.type === 'property' || nodes.type === 'method') {
            if (typeof id === 'string' && isDangerous(id)) return true
        }

        // Check index node references
        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isDangerous(id.value)) return true
            if (id.type === 'references' && typeof id.id === 'string') {
                const val = vars.get(id.id)
                if (val && isDangerous(val)) return true
            }
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

import velocityjs from 'velocityjs'

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

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && target.id) {
                if (expr.type === 'string') {
                    env[target.id] = expr.value
                } else if (expr.type === 'math' && expr.operator === '+') {
                    let val = ''
                    let isStatic = true
                    for (const operand of expr.expression) {
                        if (operand.type === 'string') {
                            val += operand.value
                        } else if (operand.type === 'references' && operand.id && env[operand.id]) {
                            val += env[operand.id]
                        } else {
                            isStatic = false
                            break
                        }
                    }
                    if (isStatic) env[target.id] = val
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isUnsafeTerm = (term: any) =>
            term === 'constructor' || term === '__proto__' || term === 'prototype'

        if (isUnsafeTerm(id)) return true

        if (nodes.type === 'index' && id) {
            let indexVal: any = undefined
            if (id.type === 'string') indexVal = id.value
            else if (id.type === 'references' && id.id && env[id.id]) indexVal = env[id.id]

            if (isUnsafeTerm(indexVal)) return true
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

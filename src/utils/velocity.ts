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

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        let idVal = undefined
        if (typeof id === 'string') {
            idVal = id
        } else if (id && typeof id === 'object') {
            if (id.type === 'string') {
                idVal = id.value
            } else if (id.type === 'references' && id.id && typeof id.id === 'string' && env[id.id] !== undefined) {
                idVal = env[id.id]
            }
        }

        if (idVal === 'constructor' || idVal === '__proto__' || idVal === 'prototype') return true

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target && target.type === 'references' && target.id && typeof target.id === 'string') {
                if (expr && expr.type === 'string' && typeof expr.value === 'string') {
                    env[target.id] = expr.value
                } else if (
                    expr &&
                    expr.type === 'references' &&
                    expr.id &&
                    typeof expr.id === 'string' &&
                    env[expr.id] !== undefined
                ) {
                    env[target.id] = env[expr.id]
                } else if (expr && expr.type === 'math' && expr.operator === '+') {
                    let concatenated = ''
                    let allStrings = true
                    if (Array.isArray(expr.expression)) {
                        for (const exp of expr.expression) {
                            if (exp && exp.type === 'string' && typeof exp.value === 'string') {
                                concatenated += exp.value
                            } else if (
                                exp &&
                                exp.type === 'references' &&
                                exp.id &&
                                typeof exp.id === 'string' &&
                                env[exp.id] !== undefined
                            ) {
                                concatenated += env[exp.id]
                            } else {
                                allStrings = false
                                break
                            }
                        }
                    } else {
                        allStrings = false
                    }
                    if (allStrings) {
                        env[target.id] = concatenated
                    }
                }
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

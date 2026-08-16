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

        // Track variables set in `#set` directives
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && typeof left.id === 'string') {
                if (right.type === 'string') {
                    env[left.id] = right.value
                } else if (right.type === 'math' && right.operator === '+') {
                    const expr = right.expression
                    if (Array.isArray(expr)) {
                        let str = ''
                        let allStrings = true
                        for (const op of expr) {
                            if (op.type === 'string') {
                                str += op.value
                            } else if (
                                op.type === 'references' &&
                                typeof op.id === 'string' &&
                                env[op.id] !== undefined
                            ) {
                                str += env[op.id]
                            } else {
                                allStrings = false
                                break
                            }
                        }
                        if (allStrings) {
                            env[left.id] = str
                        }
                    }
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Explicitly block dangerous identifiers within property and method node types
        if (
            (nodes.type === 'property' || nodes.type === 'method') &&
            (id === 'constructor' || id === '__proto__' || id === 'prototype')
        ) {
            return true
        }

        // Check index references
        if (nodes.type === 'index' && id) {
            let val: string | undefined
            if (id.type === 'string') {
                val = id.value
            } else if (id.type === 'references' && typeof id.id === 'string') {
                val = env[id.id]
            }
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                return true
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

import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, scope: Record<string, string> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, scope)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Track variable assignments to prevent SSTI via string concatenation
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]

            if (target && target.type === 'references' && typeof target.id === 'string') {
                if (expr.type === 'string' && typeof expr.value === 'string') {
                    scope[target.id] = expr.value
                } else if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
                    let concat = ''
                    let canEval = true
                    for (const op of expr.expression) {
                        if (op.type === 'string' && typeof op.value === 'string') {
                            concat += op.value
                        } else if (
                            op.type === 'references' &&
                            typeof op.id === 'string' &&
                            scope[op.id] !== undefined
                        ) {
                            concat += scope[op.id]
                        } else {
                            canEval = false
                            break
                        }
                    }
                    if (canEval) {
                        scope[target.id] = concat
                    }
                }
            }
        }

        const isDangerous = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Context-aware validation for dangerous identifiers
        if (nodes.type === 'property' || nodes.type === 'method') {
            if (typeof id === 'string' && isDangerous(id)) return true
        }

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && typeof id.value === 'string' && isDangerous(id.value)) return true
            if (id.type === 'references' && typeof id.id === 'string' && isDangerous(scope[id.id])) return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], scope)) return true
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

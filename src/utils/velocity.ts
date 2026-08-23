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
        // Track variable assignments in #set directives
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && left.id) {
                // Calculate simple string concatenations (using the + operator)
                if (right.type === 'string') {
                    variables.set(left.id, right.value)
                } else if (right.type === 'math' && right.operator === '+' && right.expression) {
                    let concatValue = ''
                    let isStringConcat = true
                    for (const expr of right.expression) {
                        if (expr.type === 'string') {
                            concatValue += expr.value
                        } else if (expr.type === 'references' && expr.id && variables.has(expr.id)) {
                            concatValue += variables.get(expr.id)!
                        } else {
                            isStringConcat = false
                            break
                        }
                    }
                    if (isStringConcat) {
                        variables.set(left.id, concatValue)
                    }
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isDangerous = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        // Explicitly block dangerous identifiers within property and method node types
        if ((nodes.type === 'property' || nodes.type === 'method') && typeof id === 'string' && isDangerous(id)) {
            return true
        }

        // Check index references
        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isDangerous(id.value)) {
                return true
            }
            if (id.type === 'references' && id.id && variables.has(id.id) && isDangerous(variables.get(id.id)!)) {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (key !== 'parent' && isUnsafeVelocityAST(nodes[key], variables)) return true
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

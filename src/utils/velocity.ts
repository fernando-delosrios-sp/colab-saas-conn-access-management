import velocityjs from 'velocityjs'

function evaluateStatic(node: any, variables: Record<string, string>): string | undefined {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) return variables[node.id]
    if (node.type === 'math' && node.operator === '+' && node.expression && node.expression.length === 2) {
        const left = evaluateStatic(node.expression[0], variables)
        const right = evaluateStatic(node.expression[1], variables)
        if (left !== undefined && right !== undefined) {
            return left + right
        }
    }
    return undefined
}

function isUnsafeVelocityAST(nodes: any, variables: Record<string, string> = {}): boolean {
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

        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target && target.type === 'references' && target.id) {
                const val = evaluateStatic(expr, variables)
                if (val !== undefined) {
                    variables[target.id] = val
                }
            }
        }

        if (
            (nodes.type === 'property' || nodes.type === 'method') &&
            (id === 'constructor' || id === '__proto__' || id === 'prototype')
        ) {
            return true
        }

        if (nodes.type === 'index' && id) {
            const val = evaluateStatic(id, variables)
            if (val && (val === 'constructor' || val === '__proto__' || val === 'prototype')) {
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

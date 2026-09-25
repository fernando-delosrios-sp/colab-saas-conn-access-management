import velocityjs from 'velocityjs'

function staticEval(node: any, vars: Record<string, any>): any {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) return vars[node.id] || null
    if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
        const left = staticEval(node.expression[0], vars)
        const right = staticEval(node.expression[1], vars)
        if (left !== null && right !== null) return left + right
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, vars: Record<string, any> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        // Track variable assignments
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && target.id) {
                const val = staticEval(expr, vars)
                if (val !== null) {
                    vars[target.id] = val
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (
            (nodes.type === 'property' || nodes.type === 'method') &&
            (id === 'constructor' || id === '__proto__' || id === 'prototype')
        ) {
            return true
        }

        if (nodes.type === 'index' && nodes.id) {
            const indexVal = staticEval(nodes.id, vars)
            if (indexVal === 'constructor' || indexVal === '__proto__' || indexVal === 'prototype') {
                return true
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

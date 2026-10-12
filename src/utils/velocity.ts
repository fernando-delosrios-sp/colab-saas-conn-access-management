import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = {}): boolean {
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

        const dangerous = ['constructor', '__proto__', 'prototype']

        // Statically trace variable assignments
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && target.id) {
                const evaluateExpr = (exprNode: any): string | undefined => {
                    if (exprNode.type === 'string') return exprNode.value
                    if (exprNode.type === 'references' && exprNode.id) return vars[exprNode.id]
                    if (exprNode.type === 'math' && exprNode.operator === '+') {
                        const left = evaluateExpr(exprNode.expression[0])
                        const right = evaluateExpr(exprNode.expression[1])
                        if (left !== undefined && right !== undefined) return left + right
                    }
                    return undefined
                }
                const val = evaluateExpr(expr)
                if (val !== undefined) {
                    vars[target.id] = val
                }
            }
        }

        if (
            dangerous.includes(id) ||
            (nodes.type === 'index' && id && id.type === 'string' && dangerous.includes(id.value)) ||
            (nodes.type === 'index' && id && id.type === 'references' && id.id && dangerous.includes(vars[id.id]))
        ) {
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

import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        if (nodes.type === 'set' && nodes.equal && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target && target.type === 'references' && target.id) {
                const evaluateExpr = (exprNode: any): string | null => {
                    if (!exprNode) return null
                    if (exprNode.type === 'string') {
                        return exprNode.value
                    } else if (exprNode.type === 'math' && exprNode.operator === '+') {
                        const left = evaluateExpr(exprNode.expression[0])
                        const right = evaluateExpr(exprNode.expression[1])
                        if (left !== null && right !== null) {
                            return left + right
                        }
                    } else if (exprNode.type === 'references' && exprNode.id && vars[exprNode.id] !== undefined) {
                        return vars[exprNode.id]
                    }
                    return null
                }
                const val = evaluateExpr(expr)
                if (val !== null) {
                    vars[target.id] = val
                } else {
                    delete vars[target.id]
                }
            }
        }

        const isBlocked = (val: any) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (
            isBlocked(id) ||
            (nodes.type === 'index' && id && id.type === 'string' && isBlocked(id.value)) ||
            (nodes.type === 'index' && id && id.type === 'references' && id.id && isBlocked(vars[id.id])) ||
            (nodes.type === 'references' && id && isBlocked(vars[id]))
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

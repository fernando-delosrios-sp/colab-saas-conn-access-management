import velocityjs from 'velocityjs'

function evaluateStaticExpression(expr: any): string | undefined {
    if (!expr) return undefined
    if (expr.type === 'string') return expr.value
    if (
        expr.type === 'math' &&
        expr.operator === '+' &&
        Array.isArray(expr.expression) &&
        expr.expression.length === 2
    ) {
        const left = evaluateStaticExpression(expr.expression[0])
        const right = evaluateStaticExpression(expr.expression[1])
        if (left !== undefined && right !== undefined) return left + right
    }
    return undefined
}

function isUnsafeVelocityAST(nodes: any, dangerousVars = new Set<string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, dangerousVars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            if (target.type === 'references' && target.id) {
                const val = evaluateStaticExpression(nodes.equal[1])
                if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                    dangerousVars.add(target.id)
                }
            }
        }

        const id = nodes.id
        if (nodes.type === 'macro_call' && id === 'evaluate') return true
        if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true

        if (nodes.type === 'index' && nodes.id) {
            if (nodes.id.type === 'string') {
                const val = nodes.id.value
                if (val === 'constructor' || val === '__proto__' || val === 'prototype') return true
            } else if (nodes.id.type === 'references' && dangerousVars.has(nodes.id.id)) {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (typeof nodes[key] === 'object' && nodes[key] !== null) {
                if (isUnsafeVelocityAST(nodes[key], dangerousVars)) return true
            }
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

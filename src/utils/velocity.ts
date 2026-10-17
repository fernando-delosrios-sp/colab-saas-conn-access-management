import velocityjs from 'velocityjs'

function evaluateStaticNode(node: any, vars: Map<string, string>): string | undefined {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) return vars.get(node.id)
    if (node.type === 'math' && node.operator === '+') {
        const exprs = node.expression
        if (Array.isArray(exprs)) {
            let result = ''
            for (const expr of exprs) {
                const val = evaluateStaticNode(expr, vars)
                if (typeof val === 'string') {
                    result += val
                } else {
                    return undefined
                }
            }
            return result
        }
    }
    return undefined
}

function isUnsafeVelocityAST(nodes: any, vars: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const [target, value] = nodes.equal
            if (target.type === 'references' && target.id) {
                const evalVal = evaluateStaticNode(value, vars)
                if (typeof evalVal === 'string') {
                    vars.set(target.id, evalVal)
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true

        if (nodes.type === 'index' && id) {
            let evalVal
            if (id.type === 'string') {
                evalVal = id.value
            } else if (id.type === 'references' && id.id) {
                evalVal = vars.get(id.id)
            }

            if (evalVal === 'constructor' || evalVal === '__proto__' || evalVal === 'prototype') {
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

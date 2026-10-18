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
        const evalStr = (n: any): string | null => {
            if (!n) return null
            if (n.type === 'string' && typeof n.value === 'string') return n.value
            if (n.type === 'references' && typeof n.id === 'string' && typeof vars[n.id] === 'string') return vars[n.id]
            if (n.type === 'math' && n.operator === '+' && Array.isArray(n.expression)) {
                const l = evalStr(n.expression[0]),
                    r = evalStr(n.expression[1])
                if (l !== null && r !== null) return l + r
            }
            return null
        }

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0],
                expr = nodes.equal[1]
            if (target.type === 'references' && typeof target.id === 'string') {
                const val = evalStr(expr)
                if (val !== null) vars[target.id] = val
            }
        }

        const id = nodes.id
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isBad = (v: any) => v === 'constructor' || v === '__proto__' || v === 'prototype'
        if (typeof id === 'string' && isBad(id) && nodes.type !== 'string') return true
        if (nodes.type === 'index' && id && isBad(evalStr(id))) return true

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

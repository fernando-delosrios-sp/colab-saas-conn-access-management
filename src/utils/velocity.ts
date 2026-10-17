import velocityjs from 'velocityjs'

function evalNode(node: any, vars: Map<string, string>): string | undefined {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references') return vars.get(node.id)
    if (node.type === 'math' && node.operator === '+') {
        let res = ''
        for (const p of node.expression || []) {
            const v = evalNode(p, vars)
            if (v === undefined) return undefined
            res += v
        }
        return res
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
        // Track variable assignments for static evaluation
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target?.type === 'references') {
                const val = evalNode(expr, vars)
                if (val !== undefined) vars.set(target.id, val)
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true

        // Prevent SSTI/Prototype Pollution via dynamic index accessors and string concatenation
        if (nodes.type === 'index' && id) {
            const val = evalNode(id, vars)
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') return true
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

import velocityjs from 'velocityjs'

function evaluateStatic(node: any, vars: Record<string, string>): string | undefined {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references' && typeof node.id === 'string') return vars[node.id]
    if (node.type === 'math' && node.operator === '+' && node.expression && node.expression.length === 2) {
        const left = evaluateStatic(node.expression[0], vars)
        const right = evaluateStatic(node.expression[1], vars)
        if (typeof left === 'string' && typeof right === 'string') {
            return left + right
        }
    }
    return undefined
}

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

        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && typeof target.id === 'string') {
                const val = evaluateStatic(expr, vars)
                if (val !== undefined) vars[target.id] = val
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isBanned = (val: any) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        if (isBanned(id)) return true

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isBanned(id.value)) return true
            if (id.type === 'references' && typeof id.id === 'string' && isBanned(vars[id.id])) return true
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

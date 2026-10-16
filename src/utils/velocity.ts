import velocityjs from 'velocityjs'

function resolveValue(node: any, variables: Map<string, string>): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && typeof node.id === 'string') return variables.get(node.id) || null
    if (node.type === 'math' && node.operator === '+') {
        const left = resolveValue(node.expression[0], variables)
        const right = resolveValue(node.expression[1], variables)
        if (left !== null && right !== null) return left + right
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, variables: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, variables)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && typeof target.id === 'string') {
                const val = resolveValue(expr, variables)
                if (val !== null) variables.set(target.id, val)
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isBad = (v?: string) => v === 'constructor' || v === '__proto__' || v === 'prototype'

        if (typeof id === 'string' && isBad(id)) return true

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isBad(id.value)) return true
            if (id.type === 'references' && typeof id.id === 'string' && isBad(variables.get(id.id))) return true
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

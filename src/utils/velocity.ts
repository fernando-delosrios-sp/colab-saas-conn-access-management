import velocityjs from 'velocityjs'

function evaluateStaticString(node: any, context: Map<string, string>): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && context.has(node.id)) {
        return context.get(node.id) ?? null
    }
    if (node.type === 'math' && node.operator === '+') {
        const left = evaluateStaticString(node.expression[0], context)
        const right = evaluateStaticString(node.expression[1], context)
        if (typeof left === 'string' && typeof right === 'string') {
            return left + right
        }
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, context = new Map<string, string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, context)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set') {
            if (nodes.equal && nodes.equal.length === 2 && nodes.equal[0].type === 'references') {
                const varName = nodes.equal[0].id
                const value = evaluateStaticString(nodes.equal[1], context)
                if (value !== null) {
                    context.set(varName, value)
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true

        if (nodes.type === 'index' && id) {
            let val = null
            if (id.type === 'string') {
                val = id.value
            } else if (id.type === 'references' && context.has(id.id)) {
                val = context.get(id.id)
            }
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], context)) return true
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

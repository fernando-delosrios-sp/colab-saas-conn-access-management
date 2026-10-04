import velocityjs from 'velocityjs'

function evaluateStatic(node: any, variables: Map<string, string> = new Map()): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && typeof node.id === 'string' && variables.has(node.id)) {
        return variables.get(node.id)!
    }
    if (node.type === 'math' && node.operator === '+') {
        const left = evaluateStatic(node.expression[0], variables)
        const right = evaluateStatic(node.expression[1], variables)
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
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const ref = nodes.equal[0]
            const expr = nodes.equal[1]
            if (ref.type === 'references' && typeof ref.id === 'string') {
                const val = evaluateStatic(expr, variables)
                if (val !== null) {
                    variables.set(ref.id, val)
                } else {
                    variables.delete(ref.id)
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isDangerous = (val: string | null | undefined) =>
            val === 'constructor' || val === '__proto__' || val === 'prototype'

        // Check explicit dangerous identifiers in all context
        if (typeof id === 'string' && isDangerous(id)) return true

        if (nodes.type === 'index' && id) {
            let indexVal = null
            if (id.type === 'string') indexVal = id.value
            else if (id.type === 'references' && typeof id.id === 'string') indexVal = variables.get(id.id) || null

            if (isDangerous(indexVal)) return true
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

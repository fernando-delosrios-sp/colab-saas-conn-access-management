import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, assignments = new Map<string, string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, assignments)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Evaluate and track #set directives
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const [ref, val] = nodes.equal
            if (ref && ref.type === 'references' && ref.id && typeof ref.id === 'string') {
                let resolvedValue = ''
                if (val.type === 'string' && typeof val.value === 'string') {
                    resolvedValue = val.value
                } else if (val.type === 'math' && val.operator === '+' && Array.isArray(val.expression)) {
                    resolvedValue = val.expression
                        .filter((expr: any) => expr.type === 'string' && typeof expr.value === 'string')
                        .map((expr: any) => expr.value)
                        .join('')
                }
                if (resolvedValue) {
                    assignments.set(ref.id, resolvedValue)
                }
            }
        }

        const isDangerous = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        // Check property and method nodes
        if (nodes.type === 'property' || nodes.type === 'method') {
            if (typeof id === 'string' && isDangerous(id)) return true
        }

        // Check index access
        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && typeof id.value === 'string') {
                if (isDangerous(id.value)) return true
            } else if (id.type === 'references' && typeof id.id === 'string') {
                const resolved = assignments.get(id.id)
                if (resolved && isDangerous(resolved)) return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], assignments)) return true
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

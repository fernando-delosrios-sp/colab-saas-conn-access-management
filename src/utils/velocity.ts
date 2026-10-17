import velocityjs from 'velocityjs'

function evaluateStatic(node: any, env: Record<string, any>): any {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) return env[node.id]
    if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
        const left = evaluateStatic(node.expression[0], env)
        const right = evaluateStatic(node.expression[1], env)
        if (typeof left === 'string' && typeof right === 'string') {
            return left + right
        }
    }
    return undefined
}

function isUnsafeVelocityAST(nodes: any, env: Record<string, any> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, env)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Track variable assignments
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && left.id) {
                const val = evaluateStatic(right, env)
                if (val !== undefined) {
                    env[left.id] = val
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isDangerous = (val: any) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        if (nodes.type === 'property' || nodes.type === 'method' || nodes.type === 'references') {
            if (isDangerous(id)) return true
        }

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isDangerous(id.value)) return true
            if (id.type === 'references' && id.id && isDangerous(env[id.id])) return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], env)) return true
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

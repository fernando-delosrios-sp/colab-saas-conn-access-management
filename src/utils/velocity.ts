import velocityjs from 'velocityjs'

function evaluateMath(node: any): string | null {
    if (node.type === 'string') return node.value
    if (node.type === 'math' && node.operator === '+' && node.expression && node.expression.length === 2) {
        const left = evaluateMath(node.expression[0])
        const right = evaluateMath(node.expression[1])
        if (left !== null && right !== null) return left + right
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, dangerousVars: Set<string> = new Set()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, dangerousVars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Track dangerous assignments via #set
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const value = nodes.equal[1]
            if (target.type === 'references' && target.id) {
                const evalVal = evaluateMath(value)
                if (evalVal === 'constructor' || evalVal === '__proto__' || evalVal === 'prototype') {
                    dangerousVars.add(target.id)
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (nodes.type === 'index' &&
                id &&
                ((id.type === 'string' &&
                    (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype')) ||
                    (id.type === 'references' && dangerousVars.has(id.id))))
        ) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], dangerousVars)) return true
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

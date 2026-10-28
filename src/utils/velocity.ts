import velocityjs from 'velocityjs'

// Security: Validate dynamic property access to prevent Unsafe Dynamic Property Evaluation.
function resolveExpression(node: any, vars: Record<string, string>): string | undefined {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) {
        return vars[node.id]
    }
    if (node.type === 'math' && node.operator === '+') {
        const left = resolveExpression(node.expression[0], vars)
        const right = resolveExpression(node.expression[1], vars)
        if (left !== undefined && right !== undefined) {
            return left + right
        }
    }
    return undefined
}

function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target && target.type === 'references' && target.id) {
                const val = resolveExpression(expr, vars)
                if (val !== undefined) {
                    vars[target.id] = val
                } else {
                    delete vars[target.id]
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const resolvedId = typeof id === 'string' ? id : undefined

        let indexVal = undefined
        if (nodes.type === 'index' && id) {
            indexVal = resolveExpression(id, vars)
        }

        if (
            resolvedId === 'constructor' ||
            resolvedId === '__proto__' ||
            resolvedId === 'prototype' ||
            (indexVal && (indexVal === 'constructor' || indexVal === '__proto__' || indexVal === 'prototype'))
        ) {
            return true
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

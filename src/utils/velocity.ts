import velocityjs from 'velocityjs'

function evaluateNode(node: any, vars: Record<string, any>): any {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'math' && node._evaluated !== undefined) return node._evaluated
    if (node.type === 'references' && vars[node.id] !== undefined) return vars[node.id]
    return undefined
}

function isUnsafeVelocityAST(nodes: any, vars: Record<string, any> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        // Security: Evaluate mathematical operations for string concatenation to prevent unsafe evaluations
        if (nodes.type === 'math' && nodes.expression && nodes.expression.length >= 2) {
            if (isUnsafeVelocityAST(nodes.expression[0], vars)) return true
            if (isUnsafeVelocityAST(nodes.expression[1], vars)) return true
            const left = evaluateNode(nodes.expression[0], vars)
            const right = evaluateNode(nodes.expression[1], vars)
            if (nodes.operator === '+' && typeof left === 'string' && typeof right === 'string') {
                nodes._evaluated = left + right
            }
        }

        // Security: Track variable assignments to prevent resolving without restrictions
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const target = nodes.equal[0]
            const expr = nodes.equal[1]
            if (target.type === 'references' && target.id) {
                if (isUnsafeVelocityAST(expr, vars)) return true
                vars[target.id] = evaluateNode(expr, vars)
                return false
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const evaluatedId = evaluateNode(nodes, vars)

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (nodes.type === 'references' &&
                (evaluatedId === 'constructor' || evaluatedId === '__proto__' || evaluatedId === 'prototype'))
        ) {
            return true
        }

        if (nodes.type === 'index' && id) {
            const evaluatedIndex = evaluateNode(id, vars)
            if (evaluatedIndex === 'constructor' || evaluatedIndex === '__proto__' || evaluatedIndex === 'prototype') {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (key === '_evaluated') continue
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

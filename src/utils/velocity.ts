import velocityjs from 'velocityjs'

// Security: Prevent unsafe AST evaluations by dynamically tracking variable assignments
// and evaluating inline mathematical expressions.
function evaluateNode(node: any, vars: Record<string, any>): any {
    if (!node) return undefined
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) {
        if (vars[node.id] !== undefined) return vars[node.id]
        return undefined
    }
    if (
        node.type === 'math' &&
        node.operator === '+' &&
        Array.isArray(node.expression) &&
        node.expression.length >= 2
    ) {
        const left = evaluateNode(node.expression[0], vars)
        const right = evaluateNode(node.expression[1], vars)
        if (left !== undefined && right !== undefined) {
            return String(left) + String(right)
        }
    }
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
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length >= 2) {
            const target = nodes.equal[0]
            const expression = nodes.equal[1]
            if (target && target.type === 'references' && target.id) {
                const val = evaluateNode(expression, vars)
                if (val !== undefined) {
                    vars[target.id] = val
                } else {
                    vars[target.id] = null
                }
            }
        }

        if (id === 'constructor' || id === '__proto__' || id === 'prototype') {
            return true
        }

        if (nodes.type === 'property' || nodes.type === 'method' || nodes.type === 'references') {
            if (id === 'constructor' || id === '__proto__' || id === 'prototype') {
                return true
            }
        }

        if (nodes.type === 'index' && nodes.id) {
            const evaluatedId = evaluateNode(nodes.id, vars)
            if (evaluatedId === 'constructor' || evaluatedId === '__proto__' || evaluatedId === 'prototype') {
                return true
            }
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

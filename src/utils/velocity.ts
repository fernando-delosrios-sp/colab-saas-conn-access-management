import velocityjs from 'velocityjs'

function evaluateNode(node: any, vars: Map<string, string>): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && node.id) {
        return vars.get(node.id) || null
    }
    if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
        const left = evaluateNode(node.expression[0], vars)
        const right = evaluateNode(node.expression[1], vars)
        if (left !== null && right !== null) {
            return left + right
        }
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, vars: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
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
                const val = evaluateNode(right, vars)
                if (val !== null) {
                    vars.set(left.id, val)
                } else {
                    vars.delete(left.id)
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const dangerous = ['constructor', '__proto__', 'prototype']

        // Direct property access is dangerous
        if (dangerous.includes(id)) return true

        // Check index access (e.g. $foo["constructor"] or $foo[$var])
        if (nodes.type === 'index' && id) {
            let valToCheck: string | null = null
            if (id.type === 'string') {
                valToCheck = id.value
                if (valToCheck && valToCheck.startsWith('$')) {
                    valToCheck = vars.get(valToCheck.substring(1)) || valToCheck
                }
            } else if (id.type === 'references' && id.id) {
                valToCheck = vars.get(id.id) || null
            }

            if (valToCheck && dangerous.includes(valToCheck)) return true
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

import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, variables = new Map<string, string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, variables)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        // Track variables set via #set to detect concatenated dangerous strings
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]

            if (left.type === 'references' && left.id) {
                const evaluateNode = (node: any): string => {
                    if (node.type === 'string') return node.value
                    if (node.type === 'references' && node.id) {
                        return variables.get(node.id) || ''
                    }
                    if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
                        return node.expression.map(evaluateNode).join('')
                    }
                    return ''
                }

                variables.set(left.id, evaluateNode(right))
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Block dangerous identifiers in method/property access
        if (
            (nodes.type === 'method' || nodes.type === 'property') &&
            (id === 'constructor' || id === '__proto__' || id === 'prototype')
        ) {
            return true
        }

        // Check index accessors for dangerous strings or variables
        if (nodes.type === 'index' && nodes.id) {
            let val = ''
            if (nodes.id.type === 'string') {
                val = nodes.id.value
            } else if (nodes.id.type === 'references' && nodes.id.id) {
                val = variables.get(nodes.id.id) || ''
            }
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (typeof nodes[key] === 'object' && nodes[key] !== null) {
                if (isUnsafeVelocityAST(nodes[key], variables)) return true
            }
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

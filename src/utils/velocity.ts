import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, variables: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, variables)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Track #set variable assignments
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && typeof left.id === 'string') {
                let val = ''
                if (right.type === 'string' && typeof right.value === 'string') {
                    val = right.value
                } else if (right.type === 'math' && right.operator === '+' && Array.isArray(right.expression)) {
                    val = right.expression
                        .map((e: any) => {
                            if (e.type === 'string' && typeof e.value === 'string') return e.value
                            if (e.type === 'references' && typeof e.id === 'string') return variables.get(e.id) || ''
                            return ''
                        })
                        .join('')
                }
                variables.set(left.id, val)
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isBanned = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        if (typeof id === 'string' && isBanned(id)) return true

        // Check dynamic index accessors
        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && typeof id.value === 'string' && isBanned(id.value)) return true
            if (id.type === 'references' && typeof id.id === 'string' && isBanned(variables.get(id.id) || ''))
                return true
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

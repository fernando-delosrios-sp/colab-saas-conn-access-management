import velocityjs from 'velocityjs'

function evaluateASTString(node: any, variables: Map<string, string>): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && typeof node.id === 'string') {
        return variables.get(node.id) || null
    }
    if (
        node.type === 'math' &&
        node.operator === '+' &&
        Array.isArray(node.expression) &&
        node.expression.length === 2
    ) {
        const left = evaluateASTString(node.expression[0], variables)
        const right = evaluateASTString(node.expression[1], variables)
        if (left !== null && right !== null) {
            return left + right
        }
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
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [ref, val] = nodes.equal
            if (ref.type === 'references' && typeof ref.id === 'string') {
                const evaluatedVal = evaluateASTString(val, variables)
                if (evaluatedVal !== null) {
                    variables.set(ref.id, evaluatedVal)
                } else {
                    variables.delete(ref.id)
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (nodes.type === 'property' || nodes.type === 'method') {
            if (id === 'constructor' || id === '__proto__' || id === 'prototype') return true
        }

        if (nodes.type === 'index' && id) {
            if (
                id.type === 'string' &&
                (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype')
            ) {
                return true
            }
            if (id.type === 'references' && typeof id.id === 'string') {
                const varValue = variables.get(id.id)
                if (varValue === 'constructor' || varValue === '__proto__' || varValue === 'prototype') {
                    return true
                }
            }
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

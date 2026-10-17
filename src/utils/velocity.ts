import velocityjs from 'velocityjs'

const dangerousStrings = new Set(['constructor', '__proto__', 'prototype', 'process', 'require', 'global'])

function evaluateASTNode(node: any, variables: Map<string, string>): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'references' && typeof node.id === 'string') {
        return variables.get(node.id) || null
    }
    if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
        const parts = node.expression.map((expr: any) => evaluateASTNode(expr, variables))
        if (parts.every((p: any) => p !== null)) {
            return parts.join('')
        }
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, variables = new Map<string, string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, variables)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && nodes.id === 'evaluate') return true

        // Direct property access
        if (nodes.type === 'property' && typeof nodes.id === 'string' && dangerousStrings.has(nodes.id)) return true

        // Dynamic index access
        if (nodes.type === 'index' && nodes.id) {
            const val = evaluateASTNode(nodes.id, variables)
            if (val && dangerousStrings.has(val)) return true
            if (nodes.id.type === 'string' && dangerousStrings.has(nodes.id.value)) return true
        }

        // Track variable assignments
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target.type === 'references' && typeof target.id === 'string') {
                const val = evaluateASTNode(expr, variables)
                if (val !== null) {
                    variables.set(target.id, val)
                } else {
                    variables.delete(target.id)
                }
            }
        }

        for (const key of Object.keys(nodes)) {
            if (key !== 'id' && isUnsafeVelocityAST(nodes[key], variables)) return true
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
export function evaluateVelocityExpression(
    template: string,
    context: Record<string, unknown> = {}
): string {
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

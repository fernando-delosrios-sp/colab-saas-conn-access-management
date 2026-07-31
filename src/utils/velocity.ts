import velocityjs from 'velocityjs'

const BANNED_IDENTIFIERS = ['constructor', '__proto__', 'prototype', 'process', 'require', 'global']

function evaluateMath(node: any): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value || ''
    if (node.type === 'math' && node.operator === '+') {
        const left = evaluateMath(node.expression[0])
        const right = evaluateMath(node.expression[1])
        if (left !== null && right !== null) {
            return left + right
        }
    }
    return null
}

function isUnsafeVelocityAST(nodes: any): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (typeof id === 'string' && BANNED_IDENTIFIERS.includes(id)) return true

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && BANNED_IDENTIFIERS.includes(id.value)) return true
            if (id.type === 'math') {
                const val = evaluateMath(id)
                if (val && BANNED_IDENTIFIERS.includes(val)) return true
            }
        }

        if (nodes.type === 'set' && nodes.equal && nodes.equal[1]) {
            const val = evaluateMath(nodes.equal[1])
            if (val && BANNED_IDENTIFIERS.includes(val)) return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key])) return true
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

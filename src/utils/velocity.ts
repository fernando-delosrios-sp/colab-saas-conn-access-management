import velocityjs from 'velocityjs'

const DANGEROUS_INDEX = ['constructor', '__proto__', 'prototype', 'process', 'require', 'global']
const DANGEROUS_ID = ['constructor', '__proto__', 'prototype']

function evaluateStaticString(expr: any, varsMap: Map<string, string>): string | null {
    if (!expr) return null
    if (expr.type === 'string') return expr.value
    if (expr.type === 'references' && expr.id && varsMap.has(expr.id)) {
        return varsMap.get(expr.id) || null
    }
    if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
        let result = ''
        for (const operand of expr.expression) {
            const val = evaluateStaticString(operand, varsMap)
            if (val === null) return null
            result += val
        }
        return result
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, varsMap: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, varsMap)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (id && typeof id === 'string' && DANGEROUS_ID.includes(id)) return true

        if (nodes.type === 'set' && Array.isArray(nodes.equal)) {
            const [target, expr] = nodes.equal
            if (target && target.type === 'references' && target.id) {
                const val = evaluateStaticString(expr, varsMap)
                if (val !== null) {
                    varsMap.set(target.id, val)
                }
            }
        }

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && DANGEROUS_INDEX.includes(id.value)) return true
            if (id.type === 'references' && id.id) {
                const val = varsMap.get(id.id)
                if (val && DANGEROUS_INDEX.includes(val)) return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], varsMap)) return true
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

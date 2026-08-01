import velocityjs from 'velocityjs'

const BANNED_IDENTIFIERS = ['constructor', '__proto__', 'prototype', 'process', 'require', 'global']

function evaluateStaticString(node: any): string | null {
    if (!node) return null
    if (node.type === 'string') return node.value
    if (node.type === 'math' && node.operator === '+') {
        if (Array.isArray(node.expression)) {
            let result = ''
            for (const expr of node.expression) {
                const val = evaluateStaticString(expr)
                if (val === null) return null
                result += val
            }
            return result
        }
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, trackedVars = new Set<string>()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, trackedVars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Track variables assigned via #set that evaluate to a banned string
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, value] = nodes.equal
            if (target && target.type === 'references' && target.id) {
                const staticVal = evaluateStaticString(value)
                if (staticVal && BANNED_IDENTIFIERS.includes(staticVal)) {
                    trackedVars.add(target.id)
                }
            }
        }

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && BANNED_IDENTIFIERS.includes(id.value)) {
                return true
            }
            if (id.type === 'references' && id.id && trackedVars.has(id.id)) {
                return true
            }
        }

        if (typeof id === 'string' && BANNED_IDENTIFIERS.includes(id)) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], trackedVars)) return true
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

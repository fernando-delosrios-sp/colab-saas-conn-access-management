import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, unsafeVars: Set<string> = new Set()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, unsafeVars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        // Evaluate #set directives to trace dangerous strings
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target.type === 'references' && target.id) {
                let evalValue = ''
                if (expr.type === 'string') {
                    evalValue = expr.value
                } else if (expr.type === 'math' && expr.operator === '+' && Array.isArray(expr.expression)) {
                    // Evaluate string concatenations
                    evalValue = expr.expression
                        .map((e: any) => (e.type === 'string' ? e.value : ''))
                        .join('')
                }

                if (['constructor', '__proto__', 'prototype'].includes(evalValue)) {
                    unsafeVars.add(target.id)
                }
            }
        }

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype'
        ) {
            return true
        }

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && ['constructor', '__proto__', 'prototype'].includes(id.value)) {
                return true
            }
            if (id.type === 'references' && id.id && unsafeVars.has(id.id)) {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], unsafeVars)) return true
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

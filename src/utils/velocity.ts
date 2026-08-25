import velocityjs from 'velocityjs'

function evaluateMathExpression(node: any, vars: Record<string, string>): string | null {
    if (node.type === 'string') {
        return node.value
    } else if (node.type === 'references' && typeof node.id === 'string' && vars[node.id] !== undefined) {
        return vars[node.id]
    } else if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
        let concatenated = ''
        for (const operand of node.expression) {
            const val = evaluateMathExpression(operand, vars)
            if (val === null) return null
            concatenated += val
        }
        return concatenated
    }
    return null
}

function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [ref, val] = nodes.equal
            if (ref.type === 'references' && typeof ref.id === 'string') {
                if (val.type === 'string') {
                    vars[ref.id] = val.value
                } else if (val.type === 'math' && val.operator === '+') {
                    const evalResult = evaluateMathExpression(val, vars)
                    if (evalResult !== null) {
                        vars[ref.id] = evalResult
                    }
                } else if (val.type === 'references' && typeof val.id === 'string' && vars[val.id] !== undefined) {
                    vars[ref.id] = vars[val.id]
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if ((nodes.type === 'method' || nodes.type === 'property') && typeof id === 'string') {
            if (id === 'constructor' || id === '__proto__' || id === 'prototype') {
                return true
            }
        }

        if (nodes.type === 'index' && id) {
            let indexValue = null
            if (id.type === 'string') {
                indexValue = id.value
            } else if (id.type === 'references' && typeof id.id === 'string') {
                indexValue = vars[id.id]
            }

            if (indexValue === 'constructor' || indexValue === '__proto__' || indexValue === 'prototype') {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (key === 'pos') continue
            if (typeof nodes[key] === 'object' && nodes[key] !== null) {
                if (isUnsafeVelocityAST(nodes[key], vars)) return true
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

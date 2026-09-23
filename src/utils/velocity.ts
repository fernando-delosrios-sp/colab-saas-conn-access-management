import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, env: Record<string, string> = {}): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, env)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (nodes.type === 'set' && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const ref = nodes.equal[0]
            const expr = nodes.equal[1]
            if (ref.type === 'references' && ref.id) {
                if (expr.type === 'string') {
                    // String interpolation check
                    let val = expr.value
                    const matches = val.match(/\$\{?([a-zA-Z0-9_]+)\}?/g)
                    if (matches) {
                        for (const match of matches) {
                            const varName = match.replace(/[\$\{\}]/g, '')
                            if (env[varName]) {
                                val = val.replace(match, env[varName])
                            }
                        }
                    }
                    env[ref.id] = val
                } else if (expr.type === 'math' && expr.operator === '+') {
                    let val = ''
                    const processOperand = (op: any) => {
                        if (!op) return
                        if (op.type === 'string') val += op.value
                        else if (op.type === 'references' && op.id && env[op.id]) val += env[op.id]
                        else if (op.type === 'math' && op.operator === '+') {
                            processOperand(op.left || op.expression?.[0])
                            processOperand(op.right || op.expression?.[1])
                        }
                    }
                    // Handle expression array or left/right operands depending on velocity AST
                    if (Array.isArray(expr.expression)) {
                        for (const operand of expr.expression) processOperand(operand)
                    } else {
                        processOperand(expr.left)
                        processOperand(expr.right)
                    }
                    env[ref.id] = val
                }
            }
        }

        if (
            id === 'constructor' ||
            id === '__proto__' ||
            id === 'prototype' ||
            (nodes.type === 'index' &&
                id &&
                ((id.type === 'string' &&
                    (id.value === 'constructor' || id.value === '__proto__' || id.value === 'prototype')) ||
                    (id.type === 'references' &&
                        id.id &&
                        env[id.id] &&
                        (env[id.id] === 'constructor' || env[id.id] === '__proto__' || env[id.id] === 'prototype'))))
        ) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (typeof nodes[key] === 'object') {
                if (isUnsafeVelocityAST(nodes[key], env)) return true
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

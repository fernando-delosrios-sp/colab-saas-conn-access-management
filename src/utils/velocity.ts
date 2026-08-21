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
        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const left = nodes.equal[0]
            const right = nodes.equal[1]
            if (left.type === 'references' && typeof left.id === 'string') {
                if (right.type === 'string') {
                    variables.set(left.id, right.value)
                } else if (right.type === 'math' && right.operator === '+') {
                    const evalMath = (mathNode: any): string | null => {
                        let res = ''
                        if (!mathNode.expression) return null
                        for (const expr of mathNode.expression) {
                            if (expr.type === 'string') {
                                res += expr.value
                            } else if (
                                expr.type === 'references' &&
                                typeof expr.id === 'string' &&
                                variables.has(expr.id)
                            ) {
                                res += variables.get(expr.id)!
                            } else if (expr.type === 'math' && expr.operator === '+') {
                                const evalRes = evalMath(expr)
                                if (evalRes === null) return null
                                res += evalRes
                            } else {
                                return null
                            }
                        }
                        return res
                    }
                    const concatVal = evalMath(right)
                    if (concatVal !== null) {
                        variables.set(left.id, concatVal)
                    }
                }
            }
        }

        const isDangerous = (val: string) => val === 'constructor' || val === '__proto__' || val === 'prototype'

        if ((nodes.type === 'property' || nodes.type === 'method') && typeof id === 'string' && isDangerous(id)) {
            return true
        }

        if (nodes.type === 'index' && id) {
            if (id.type === 'string' && isDangerous(id.value)) {
                return true
            }
            if (id.type === 'references' && typeof id.id === 'string') {
                const varVal = variables.get(id.id)
                if (varVal && isDangerous(varVal)) {
                    return true
                }
            }
        }

        if (typeof id === 'string' && isDangerous(id)) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (typeof nodes[key] === 'object') {
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

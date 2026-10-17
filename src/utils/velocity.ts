import velocityjs from 'velocityjs'

function isUnsafeVelocityAST(nodes: any, contextVars: Map<string, string> = new Map()): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, contextVars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        const id = nodes.id

        // Track variables in #set directives to calculate their string values
        if (nodes.type === 'set' && nodes.equal && nodes.equal.length === 2) {
            const [target, value] = nodes.equal
            if (target.type === 'references' && target.id) {
                let evaluatedStr = ''
                let isStaticString = false

                if (value.type === 'string') {
                    evaluatedStr = value.value
                    isStaticString = true
                } else if (value.type === 'references' && contextVars.has(value.id)) {
                    evaluatedStr = contextVars.get(value.id)!
                    isStaticString = true
                } else if (value.type === 'math' && value.operator === '+' && Array.isArray(value.expression)) {
                    const evaluateMath = (mathNode: any): string | null => {
                        let res = ''
                        if (
                            mathNode.type === 'math' &&
                            mathNode.operator === '+' &&
                            Array.isArray(mathNode.expression)
                        ) {
                            for (const expr of mathNode.expression) {
                                if (expr.type === 'string') {
                                    res += expr.value
                                } else if (expr.type === 'references' && contextVars.has(expr.id)) {
                                    res += contextVars.get(expr.id)!
                                } else if (expr.type === 'math' && expr.operator === '+') {
                                    const subRes = evaluateMath(expr)
                                    if (subRes === null) return null
                                    res += subRes
                                } else {
                                    return null
                                }
                            }
                            return res
                        }
                        return null
                    }
                    const mathRes = evaluateMath(value)
                    if (mathRes !== null) {
                        evaluatedStr = mathRes
                        isStaticString = true
                    }
                }

                if (isStaticString) {
                    contextVars.set(target.id, evaluatedStr)
                } else {
                    contextVars.delete(target.id)
                }
            }
        }

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const isDangerousString = (str: unknown) =>
            typeof str === 'string' && (str === 'constructor' || str === '__proto__' || str === 'prototype')

        if (
            isDangerousString(id) ||
            (nodes.type === 'index' && id && id.type === 'string' && isDangerousString(id.value)) ||
            (nodes.type === 'index' &&
                id &&
                id.type === 'references' &&
                contextVars.has(id.id) &&
                isDangerousString(contextVars.get(id.id)))
        ) {
            return true
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], contextVars)) return true
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

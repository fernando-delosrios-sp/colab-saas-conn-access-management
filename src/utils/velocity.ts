import velocityjs from 'velocityjs'

// Security: Track variable assignments and recursively evaluate string concatenations to prevent unsafe dynamic property evaluation.
function isUnsafeVelocityAST(nodes: any, vars: Record<string, string> = Object.create(null)): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (isUnsafeVelocityAST(node, vars)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if (nodes.type === 'set' && nodes.equal && Array.isArray(nodes.equal) && nodes.equal.length === 2) {
            const [target, expr] = nodes.equal
            if (target.type === 'references' && target.id) {
                const val = evaluateASTString(expr, vars)
                if (val !== null) {
                    vars[target.id] = val
                }
            }
        }

        const id = nodes.id

        // Block macro evaluation logic
        if (nodes.type === 'macro_call' && id === 'evaluate') return true

        const resolvedId = typeof id === 'string' ? id : null

        if (
            resolvedId === 'constructor' ||
            resolvedId === '__proto__' ||
            resolvedId === 'prototype'
        ) {
            return true
        }

        if (nodes.type === 'index') {
            const val = evaluateASTString(id, vars)
            if (val === 'constructor' || val === '__proto__' || val === 'prototype') {
                return true
            }
        }

        for (const key of Object.keys(nodes)) {
            if (isUnsafeVelocityAST(nodes[key], vars)) return true
        }
    }

    return false
}

function evaluateASTString(node: any, vars: Record<string, string>): string | null {
    if (!node) return null;
    if (node.type === 'string') return node.value;
    if (node.type === 'references' && node.id) return vars[node.id] || null;
    if (node.type === 'math' && node.operator === '+' && Array.isArray(node.expression)) {
        const left = evaluateASTString(node.expression[0], vars);
        const right = evaluateASTString(node.expression[1], vars);
        if (left !== null && right !== null) {
            return left + right;
        }
    }
    return null;
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

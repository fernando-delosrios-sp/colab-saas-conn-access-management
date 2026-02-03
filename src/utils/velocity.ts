import velocityjs from 'velocityjs'

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
    const velocityTemplate = velocityjs.parse(template)
    const velocity = new velocityjs.Compile(velocityTemplate)
    return velocity.render(context)
}

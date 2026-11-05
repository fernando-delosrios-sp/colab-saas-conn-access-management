import test from 'node:test'
import assert from 'node:assert'
import { evaluateVelocityExpression } from './velocity'

test('buildName should render template with entitlement attributes correctly', () => {
    const mockEntitlement = {
        attributes: {
            role: 'Admin',
            department: 'Engineering',
        },
    } as any

    const mockDefinition = {
        nameTemplate: 'Role: $role - Dept: $department',
    } as any

    const result = evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement.attributes)
    assert.strictEqual(result, 'Role: Admin - Dept: Engineering')
})

test('buildName should use cache for repeated template definitions', () => {
    const mockEntitlement1 = {
        attributes: {
            role: 'Admin',
            department: 'Engineering',
        },
    } as any

    const mockEntitlement2 = {
        attributes: {
            role: 'User',
            department: 'Sales',
        },
    } as any

    const mockDefinition = {
        nameTemplate: 'Role: $role - Dept: $department',
    } as any

    const result1 = evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement1.attributes)
    const result2 = evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement2.attributes)

    assert.strictEqual(result1, 'Role: Admin - Dept: Engineering')
    assert.strictEqual(result2, 'Role: User - Dept: Sales')
})

test('buildName should handle missing attributes', () => {
    const mockEntitlement = {
        attributes: {
            role: 'Admin',
        },
    } as any

    const mockDefinition = {
        nameTemplate: 'Role: $role - Dept: $department',
    } as any

    const result = evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement.attributes)
    assert.strictEqual(result, 'Role: Admin - Dept: $department')
})

test('buildName should handle conditionals in template', () => {
    const mockEntitlement = {
        attributes: {
            type: 'contractor',
        },
    } as any

    const mockDefinition = {
        nameTemplate: '#if($type == "contractor")Contractor#else Employee#end',
    } as any

    const result = evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement.attributes)
    assert.strictEqual(result, 'Contractor')
})

test('isUnsafeVelocityAST should block dynamic prototype pollution evaluations', () => {
    const templates = [
        '$a.constructor',
        '$a.constructor()',
        '#set($c = "constructor")\\n$a[$c]',
        '#set($c = "con" + "structor")\\n$a[$c]',
        '#set($b = "con")\\n#set($c = "structor")\\n#set($d = $b + $c)\\n$a[$d]',
        '#set($empty = "")\\n#set($c = $empty + "constructor")\\n$a[$c]',
        '$a["constructor"]',
    ]

    for (const t of templates) {
        assert.throws(
            () => evaluateVelocityExpression(t, { a: {} }),
            /Invalid template: access to constructor, __proto__, or prototype is not allowed/,
            `Failed to block template: ${t}`
        )
    }
})

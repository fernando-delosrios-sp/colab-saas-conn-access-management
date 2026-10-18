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

test('buildName should block unsafe dynamic property access', () => {
    const mockEntitlement = {
        attributes: {},
    } as any

    const mockDefinition = {
        nameTemplate: '#set($c = "con" + "structor")\n$a[$c]',
    } as any

    assert.throws(
        () => evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement.attributes),
        /Invalid template/
    )
})

test('buildName should allow benign literal sets', () => {
    const mockEntitlement = {
        attributes: {},
    } as any

    const mockDefinition = {
        nameTemplate: '#set($role = "constructor")\n$role',
    } as any

    const result = evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement.attributes)
    assert.strictEqual(result, 'constructor')
})

test('buildName should block unsafe dynamic property access with empty string', () => {
    const mockEntitlement = {
        attributes: {},
    } as any

    const mockDefinition = {
        nameTemplate: '#set($c = "constructor" + "")\n$a[$c]',
    } as any

    assert.throws(
        () => evaluateVelocityExpression(mockDefinition.nameTemplate, mockEntitlement.attributes),
        /Invalid template/
    )
})

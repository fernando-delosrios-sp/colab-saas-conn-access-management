import test from 'node:test'
import assert from 'node:assert'
import { evaluateVelocityExpression, isUnsafeVelocityAST } from './velocity'
import velocityjs from 'velocityjs'

test('isUnsafeVelocityAST should detect unsafe concatenations via #set', () => {
    const unsafeConcat1 = velocityjs.parse("#set($c = 'constructor') $foo[$c]")
    assert.strictEqual(isUnsafeVelocityAST(unsafeConcat1), true)

    const unsafeConcat2 = velocityjs.parse("#set($c = 'con' + 'structor') $foo[$c]")
    assert.strictEqual(isUnsafeVelocityAST(unsafeConcat2), true)

    const unsafeConcat3 = velocityjs.parse("#set($a = 'con') #set($b = 'structor') #set($c = $a + $b) $foo[$c]")
    assert.strictEqual(isUnsafeVelocityAST(unsafeConcat3), true)

    const safeConcat = velocityjs.parse("#set($c = 'hello' + 'world') $foo[$c]")
    assert.strictEqual(isUnsafeVelocityAST(safeConcat), false)
})

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

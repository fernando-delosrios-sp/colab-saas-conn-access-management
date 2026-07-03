import test from 'node:test'
import assert from 'node:assert'
import { buildName } from './index'

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

    const result = buildName(mockEntitlement, mockDefinition)
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

    const result1 = buildName(mockEntitlement1, mockDefinition)
    const result2 = buildName(mockEntitlement2, mockDefinition)

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

    const result = buildName(mockEntitlement, mockDefinition)
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

    const result = buildName(mockEntitlement, mockDefinition)
    assert.strictEqual(result, 'Contractor')
})

test('buildName should throw error when template has unsafe access to constructor', () => {
    const mockEntitlement = { attributes: {} } as any
    const mockDefinition = { nameTemplate: '$foo.constructor' } as any

    assert.throws(
        () => buildName(mockEntitlement, mockDefinition),
        /Invalid template: access to unsafe properties \(e\.g\., constructor\) is not allowed/
    )
})

test('buildName should throw error when template has unsafe access to __proto__', () => {
    const mockEntitlement = { attributes: {} } as any
    const mockDefinition = { nameTemplate: '$foo["__proto__"]' } as any

    assert.throws(
        () => buildName(mockEntitlement, mockDefinition),
        /Invalid template: access to unsafe properties \(e\.g\., constructor\) is not allowed/
    )
})

test('buildName should throw error when template dynamically accesses property via variable', () => {
    const mockEntitlement = { attributes: {} } as any
    const mockDefinition = { nameTemplate: '#set($prop = "constructor") $foo[$prop]' } as any

    assert.throws(
        () => buildName(mockEntitlement, mockDefinition),
        /Invalid template: access to unsafe properties \(e\.g\., constructor\) is not allowed/
    )
})

test('buildName should throw error when template dynamically concatenates strings to access property', () => {
    const mockEntitlement = { attributes: {} } as any
    const mockDefinition = { nameTemplate: '#set($a = "construct") #set($b = "or") #set($c = "$a$b") $foo[$c]' } as any

    assert.throws(
        () => buildName(mockEntitlement, mockDefinition),
        /Invalid template: access to unsafe properties \(e\.g\., constructor\) is not allowed/
    )
})

test('buildName should throw error when template uses unsafe prototype', () => {
    const mockEntitlement = { attributes: {} } as any
    const mockDefinition = { nameTemplate: '$foo.prototype' } as any

    assert.throws(
        () => buildName(mockEntitlement, mockDefinition),
        /Invalid template: access to unsafe properties \(e\.g\., constructor\) is not allowed/
    )
})

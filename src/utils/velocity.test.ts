import test from 'node:test'
import assert from 'node:assert'
import { evaluateVelocityExpression } from './velocity'

test('evaluateVelocityExpression blocks direct prototype access', () => {
    assert.throws(() => evaluateVelocityExpression('$foo.prototype', { foo: {} }), /Invalid template/)
})

test('evaluateVelocityExpression blocks indirect prototype access via set', () => {
    assert.throws(
        () => evaluateVelocityExpression('#set($role = "prototype") $foo[$role]', { foo: {} }),
        /Invalid template/
    )
})

test('evaluateVelocityExpression blocks indirect prototype access via set concatenation', () => {
    assert.throws(
        () =>
            evaluateVelocityExpression('#set($a = "proto") #set($b = "type") #set($c = $a + $b) $foo[$c]', { foo: {} }),
        /Invalid template/
    )
})

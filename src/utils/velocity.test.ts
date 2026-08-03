import { describe, it } from 'node:test'
import assert from 'node:assert'
import { evaluateVelocityExpression } from './velocity'

describe('evaluateVelocityExpression', () => {
    it('should block constructor access', () => {
        assert.throws(() => {
            evaluateVelocityExpression('$foo.constructor', { foo: {} })
        })
    })

    it('should block __proto__ access', () => {
        assert.throws(() => {
            evaluateVelocityExpression('$foo.__proto__', { foo: {} })
        })
    })

    it('should block prototype access', () => {
        assert.throws(() => {
            evaluateVelocityExpression('$foo.prototype', { foo: {} })
        })
    })

    it('should block string index access', () => {
        assert.throws(() => {
            evaluateVelocityExpression('$foo["constructor"]', { foo: {} })
        })
    })

    it('should block macro evaluate', () => {
        assert.throws(() => {
            evaluateVelocityExpression('#evaluate("abc")')
        })
    })

    it('should block SSTI prototype pollution bypass via string concatenation and set', () => {
        assert.throws(() => {
            evaluateVelocityExpression('#set($c = "con" + "structor")\\n$foo[$c]', { foo: {} })
        })
    })
})

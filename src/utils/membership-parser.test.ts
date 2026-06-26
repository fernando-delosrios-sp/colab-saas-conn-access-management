import test from 'node:test'
import assert from 'node:assert'
import { stringToMembership } from './membership-parser'
import { Source, RoleCriteriaKeyType, RoleMembershipSelectorType } from 'sailpoint-api-client'

const mockSources = [
    {
        id: 'source1',
        name: 'ActiveDirectory',
        description: '',
        type: 'ActiveDirectory',
        connector: 'active-directory',
        connectorClass: '',
        connectorAttributes: {},
        managementWorkgroup: { id: '', type: 'GOVERNANCE_GROUP', name: '' },
        owner: { id: '', type: 'IDENTITY', name: '' },
        cluster: { id: '', type: 'CLUSTER', name: '' },
        accountCorrelationConfig: { id: '', type: 'ACCOUNT_CORRELATION_CONFIG', name: '' },
        accountCorrelationRule: { id: '', type: 'RULE', name: '' },
        managerCorrelationMapping: { id: '', type: '', name: '' },
        managerCorrelationRule: { id: '', type: 'RULE', name: '' },
        beforeProvisioningRule: { id: '', type: 'RULE', name: '' },
        schemas: [],
        passwordPolicies: [],
        features: [],
        endpoints: [],
        connectionParameters: [],
        credentialProviderEnabled: false,
        category: '',
        healthy: true,
        status: 'SOURCE_STATUS_UNCHECKED',
        since: '',
        health: { isHealthy: true },
        nameId: '',
        created: '',
        modified: '',
    },
] as Source[]

test('stringToMembership - Identity criteria parsing', async (t) => {
    const result = await stringToMembership('Identity.department eq "Engineering"', mockSources)

    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'OR',
            children: [
                {
                    operation: 'EQUALS',
                    key: {
                        type: RoleCriteriaKeyType.Identity,
                        property: 'attribute.department',
                        sourceId: undefined,
                    },
                    stringValue: 'Engineering',
                },
            ],
        },
    })
})

test('stringToMembership - Source-based attribute parsing', async (t) => {
    const result = await stringToMembership('ActiveDirectory.Attribute.department eq "IT"', mockSources)

    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'OR',
            children: [
                {
                    operation: 'EQUALS',
                    key: {
                        type: RoleCriteriaKeyType.Account,
                        property: 'attribute.department',
                        sourceId: 'source1',
                    },
                    stringValue: 'IT',
                },
            ],
        },
    })
})

test('stringToMembership - Multiple operations AND', async (t) => {
    const result = await stringToMembership(
        'Identity.department eq "Engineering" AND ActiveDirectory.Attribute.department eq "IT"',
        mockSources
    )

    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'OR',
            children: [
                {
                    operation: 'AND',
                    children: [
                        {
                            operation: 'EQUALS',
                            key: {
                                type: RoleCriteriaKeyType.Identity,
                                property: 'attribute.department',
                                sourceId: undefined,
                            },
                            stringValue: 'Engineering',
                        },
                        {
                            operation: 'EQUALS',
                            key: {
                                type: RoleCriteriaKeyType.Account,
                                property: 'attribute.department',
                                sourceId: 'source1',
                            },
                            stringValue: 'IT',
                        },
                    ],
                },
            ],
        },
    })
})

test('stringToMembership - Multiple operations OR', async (t) => {
    const result = await stringToMembership(
        'Identity.department eq "Engineering" OR ActiveDirectory.Attribute.department eq "IT"',
        mockSources
    )

    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'AND',
            children: [
                {
                    operation: 'OR',
                    children: [
                        {
                            operation: 'EQUALS',
                            key: {
                                type: RoleCriteriaKeyType.Identity,
                                property: 'attribute.department',
                                sourceId: undefined,
                            },
                            stringValue: 'Engineering',
                        },
                        {
                            operation: 'EQUALS',
                            key: {
                                type: RoleCriteriaKeyType.Account,
                                property: 'attribute.department',
                                sourceId: 'source1',
                            },
                            stringValue: 'IT',
                        },
                    ],
                },
            ],
        },
    })
})

test('stringToMembership - Nested expressions', async (t) => {
    const result = await stringToMembership(
        '(Identity.department eq "Engineering" OR Identity.department eq "Sales") AND ActiveDirectory.Attribute.department eq "IT"',
        mockSources
    )

    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'AND',
            children: [
                {
                    operation: 'OR',
                    children: [
                        {
                            operation: 'EQUALS',
                            key: {
                                type: RoleCriteriaKeyType.Identity,
                                property: 'attribute.department',
                                sourceId: undefined,
                            },
                            stringValue: 'Engineering',
                        },
                        {
                            operation: 'EQUALS',
                            key: {
                                type: RoleCriteriaKeyType.Identity,
                                property: 'attribute.department',
                                sourceId: undefined,
                            },
                            stringValue: 'Sales',
                        },
                    ],
                },
                {
                    operation: 'EQUALS',
                    key: {
                        type: RoleCriteriaKeyType.Account,
                        property: 'attribute.department',
                        sourceId: 'source1',
                    },
                    stringValue: 'IT',
                },
            ],
        },
    })
})

test('stringToMembership - Error handling: invalid operation', async (t) => {
    await assert.rejects(
        async () => await stringToMembership('Identity.department xx "Engineering"', mockSources),
        (err: Error) => {
            assert.strictEqual(err.message, 'Invalid operator :xx')
            return true
        }
    )
})

test('stringToMembership - Error handling: mixing AND/OR without parentheses', async (t) => {
    await assert.rejects(
        async () =>
            await stringToMembership(
                'Identity.department eq "Eng" AND Identity.department eq "Sales" OR Identity.department eq "Marketing"',
                mockSources
            ),
        (err: Error) => {
            assert.strictEqual(err.message, 'All operators should be either "and" or "or"')
            return true
        }
    )
})

test('stringToMembership - Other comparison operations', async (t) => {
    const ops = [
        { op: 'ne', expected: 'NOT_EQUALS' },
        { op: 'co', expected: 'CONTAINS' },
        { op: 'sw', expected: 'STARTS_WITH' },
        { op: 'ew', expected: 'ENDS_WITH' },
    ]

    for (const { op, expected } of ops) {
        const result = await stringToMembership(`Identity.department ${op} "Engineering"`, mockSources)
        assert.deepStrictEqual(result, {
            type: RoleMembershipSelectorType.Standard,
            criteria: {
                operation: 'OR',
                children: [
                    {
                        operation: expected,
                        key: {
                            type: RoleCriteriaKeyType.Identity,
                            property: 'attribute.department',
                            sourceId: undefined,
                        },
                        stringValue: 'Engineering',
                    },
                ],
            },
        })
    }
})

test('stringToMembership - Literal without quotes (accepted by parser)', async (t) => {
    const result = await stringToMembership('Identity.department eq Engineering', mockSources)
    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'OR',
            children: [
                {
                    operation: 'EQUALS',
                    key: {
                        type: RoleCriteriaKeyType.Identity,
                        property: 'attribute.department',
                        sourceId: undefined,
                    },
                    stringValue: 'Engineering',
                },
            ],
        },
    })
})

test('stringToMembership - Source-based entitlement parsing', async (t) => {
    const result = await stringToMembership('ActiveDirectory.Entitlement.memberOf eq "Admin"', mockSources)

    assert.deepStrictEqual(result, {
        type: RoleMembershipSelectorType.Standard,
        criteria: {
            operation: 'OR',
            children: [
                {
                    operation: 'EQUALS',
                    key: {
                        type: RoleCriteriaKeyType.Entitlement,
                        property: 'attribute.memberOf',
                        sourceId: 'source1',
                    },
                    stringValue: 'Admin',
                },
            ],
        },
    })
})

test('stringToMembership - Invalid source type in string', async (t) => {
    await assert.rejects(
        async () => await stringToMembership('ActiveDirectory.InvalidType.memberOf eq "Admin"', mockSources),
        (err: Error) => {
            assert.strictEqual(err.message, 'Was expecting either attribute or entitlement')
            return true
        }
    )
})

test('stringToMembership - Invalid syntax (missing dot)', async (t) => {
    await assert.rejects(
        async () => await stringToMembership('ActiveDirectory Attribute.memberOf eq "Admin"', mockSources),
        (err: Error) => {
            assert.strictEqual(err.message, "Invalid character  . Expecting '.'")
            return true
        }
    )
})

test('stringToMembership - Missing closing parenthesis', async (t) => {
    await assert.rejects(
        async () => await stringToMembership('(Identity.department eq "Engineering"', mockSources),
        (err: Error) => {
            assert.strictEqual(err.message, '[\\)] not found')
            return true
        }
    )
})

test('stringToMembership - Empty string', async (t) => {
    await assert.rejects(
        async () => await stringToMembership('', mockSources),
        (err: Error) => {
            assert.strictEqual(err.message, 'End of string reached')
            return true
        }
    )
})

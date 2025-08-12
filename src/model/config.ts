export interface Definition {
    name: string
    query: string
    groupByAttribute?: boolean
    groupAttribute?: string
    nameTemplate: string
    requestable: boolean
    requireApproval: boolean
}

export interface AccessProfileDefinition extends Definition {
    approverType?: 'APP_OWNER' | 'OWNER' | 'SOURCE_OWNER' | 'MANAGER'
    groupType?: 'application' | 'accessProfile'
    nameTemplate: string
    createApplication: boolean
}

export interface RoleDefinition extends Definition {
    approverType?: 'OWNER' | 'MANAGER'
    automaticAssignment: boolean
    assignmentDefinition?: string
}

export interface Config {
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    baseurl: string
    clientId: string
    clientSecret: string
    accessProfiles?: AccessProfileDefinition[]
    roles?: RoleDefinition[]
}

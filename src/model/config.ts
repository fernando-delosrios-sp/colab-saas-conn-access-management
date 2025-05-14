export interface Definition {
    name: string
    query: string
    groupByAttribute?: boolean
    groupAttribute?: string
    groupType?: 'application' | 'accessProfile'
    apTemplate: string
    createApplication?: boolean
    requestable: boolean
    approverType?: 'APP_OWNER' | 'OWNER' | 'SOURCE_OWNER' | 'MANAGER'
}

export interface Config {
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    baseurl: string
    clientId: string
    clientSecret: string
    definitions?: Definition[]
}

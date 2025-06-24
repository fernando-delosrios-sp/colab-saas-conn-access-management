# SailPoint Access Management Connector

This connector enables automated creation and management of Access Profiles and Roles in SailPoint Identity Security Cloud (ISC) based on entitlement queries and grouping rules.

## Overview

The Access Management connector allows you to:

-   Define access profile groups based on entitlement queries
-   Define role groups based on entitlement queries
-   Group entitlements by specific attributes (application or access profile for access profiles, custom attributes for roles)
-   Create applications and assign access profiles
-   Configure requestable access profiles and roles with approval workflows
-   Automate the creation of access profiles and roles using Velocity templates
-   Set up automatic role assignment based on membership criteria

## Prerequisites

-   Node.js (v14 or higher)
-   npm (v6 or higher)
-   SailPoint Identity Security Cloud tenant
-   Personal Access Token (PAT) with appropriate permissions

## Installation

1.  Clone this repository

    ```bash
    git clone <repo url>
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Build the connector:

    ```bash
    npm run build
    ```

4.  Package the connector for deployment:

    ```bash
    npm run pack-zip
    ```

## Configuration

The connector requires the following configuration:

### Connection Details

-   **Identity Security Cloud API URL**: Your ISC tenant's API URL
-   **Personal Access Token ID**: Your PAT ID
-   **Personal Access Token Secret**: Your PAT secret

### Access Profiles Configuration

-   **Access Profile Group Name**: Name for the group of access profiles
-   **Entitlement Query**: Filter query for the Entitlement API
-   **Group By Attribute**: Option to group entitlements by specific attributes
-   **Group Type**: Choose between Application or Access Profile grouping
-   **Group Attribute**: Specify the entitlement attribute to group by
-   **Create Application**: Option to create applications and assign access profiles
-   **Access Profile Name Template**: Velocity template for naming access profiles
-   **Requestable**: Configure if access profiles should be requestable
-   **Approval Settings**: Configure approval workflow if requestable
-   **Require Approval**: Enable approval requirement
-   **Approver Type**: Choose approver (Application Owner, Owner, Source Owner, Manager)

### Roles Configuration

-   **Role Group Name**: Name for the group of roles
-   **Entitlement Query**: Filter query for the Entitlement API
-   **Group By Attribute**: Option to group entitlements by specific attributes
-   **Group Attribute**: Specify the entitlement attribute to group by
-   **Role Name Template**: Velocity template for naming roles
-   **Requestable**: Configure if roles should be requestable
-   **Approval Settings**: Configure approval workflow if requestable
-   **Require Approval**: Enable approval requirement
-   **Approver Type**: Choose approver (Owner, Manager)
-   **Automatic Assignment**: Enable automatic role assignment
-   **Assignment Definition**: Define membership criteria for automatic assignment. Thanks to [Yannick Béot](https://github.com/yannick-beot-sp) for this feature.

## Development

### Available Scripts

-   `npm run clean` - Clean the dist directory
-   `npm run build` - Build the connector using ncc
-   `npm run dev` - Run the connector in development mode
-   `npm run debug` - Run the connector in debug mode
-   `npm run prettier` - Format code using Prettier
-   `npm run pack-zip` - Package the connector for deployment

### Building

To build the connector:

```bash
npm run build
```

The build process uses `@vercel/ncc` to create a single-file bundle in the `dist` directory.

### Testing

To test the connection:

```bash
npm run dev
```

## Deployment

1. Build the connector:

```bash
npm run build
```

2. Package the connector:

```bash
npm run pack-zip
```

3. Upload the generated zip file to your SailPoint Identity Security Cloud tenant

## Features

### Access Profile Management

-   Automated access profile creation based on entitlement queries
-   Flexible entitlement grouping by application or access profile
-   Customizable naming templates using Velocity syntax
-   Requestable access profiles with configurable approval workflows
-   Application creation and management
-   Support for multiple approval types (Application Owner, Owner, Source Owner, Manager)

### Role Management

-   Automated role creation based on entitlement queries
-   Flexible entitlement grouping by custom attributes
-   Customizable naming templates using Velocity syntax
-   Requestable roles with configurable approval workflows
-   Automatic role assignment based on membership criteria
-   Support for multiple approval types (Owner, Manager)

### General Features

-   Comprehensive entitlement processing and grouping
-   Velocity template support for dynamic naming
-   Error handling and logging
-   Support for both creation and updates of existing objects
-   Integration with SailPoint Identity Security Cloud APIs

## Velocity Template Variables

The following variables are available in name templates:

-   `$_source`: Source name
-   `$_group`: Group name
-   `$name`: Entitlement name
-   `$value`: Entitlement value
-   Any other attributes from the entitlement schema

## Dependencies

-   @sailpoint/connector-sdk: ^1.1.22
-   form-data: ^4.0.2
-   sailpoint-api-client: ^1.6.0
-   velocityjs: ^2.1.5

### Development Dependencies

-   @vercel/ncc: ^0.34.0
-   cross-env: 7.0.3
-   prettier: ^2.3.2
-   shx: ^0.3.3
-   typescript: ^5.3.3
-   typescript-eslint: ^8.2.0

## Project Structure

```
access-management/
├── src/
│   ├── data/
│   │   └── constants.ts
│   ├── model/
│   │   ├── config.ts
│   │   └── propertyDefinitions.ts
│   ├── utils/
│   │   ├── index.ts
│   │   └── membership-parser.ts
│   ├── index.ts
│   └── isc-client.ts
├── connector-spec.json
├── package.json
├── tsconfig.json
└── README.md
```

## License

This project is private and proprietary.

## Support

For support, please contact your SailPoint representative or open an issue in this repository.

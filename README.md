# SailPoint Access Profile Builder Connector

This connector enables automated creation and management of Access Profiles in SailPoint Identity Security Cloud (ISC) based on entitlement queries and grouping rules.

## Overview

The Access Profile Builder connector allows you to:

-   Define access profile groups based on entitlement queries
-   Group entitlements by specific attributes
-   Create applications and assign access profiles
-   Configure requestable access profiles with approval workflows
-   Automate the creation of access profiles using templates

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

3.  Package the connector for deployment:

    ```bash
    npm run pack-zip
    ```

## Configuration

The connector requires the following configuration:

### Connection Details

-   **Identity Security Cloud API URL**: Your ISC tenant's API URL
-   **Personal Access Token ID**: Your PAT ID
-   **Personal Access Token Secret**: Your PAT secret

### Access Profile Configuration

-   **Access Profile Group Name**: Name for the group of access profiles
-   **Entitlement Query**: Filter query for the Entitlement API
-   **Group By Attribute**: Option to group entitlements by specific attributes
-   **Group Type**: Choose between Application or Access Profile grouping
-   **Access Profile Name Template**: Velocity template for naming access profiles
-   **Requestable**: Configure if access profiles should be requestable
-   **Approval Settings**: Configure approval workflow if requestable

## Development

### Available Scripts

-   `npm run build` - Build the connector
-   `npm run dev` - Run the connector in development mode
-   `npm run debug` - Run the connector in debug mode
-   `npm run prettier` - Format code using Prettier
-   `npm run pack-zip` - Package the connector for deployment

### Building

To build the connector:

```bash
npm run build
```

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

-   Automated access profile creation
-   Flexible entitlement grouping
-   Customizable naming templates
-   Requestable access profiles
-   Configurable approval workflows
-   Application creation and management

## Dependencies

-   @sailpoint/connector-sdk: ^1.1.22
-   form-data: ^4.0.2
-   sailpoint-api-client: ^1.6.0
-   velocityjs: ^2.1.5

## License

This project is private and proprietary.

## Support

For support, please contact your SailPoint representative or open an issue in this repository.

// Copyright 2020 Privacy Research, LLC

import { DynamoDB } from 'aws-sdk'

const dynamoDb = new DynamoDB.DocumentClient()

const TABLE_NAME = process.env.SUBS_TABLE_NAME

export async function addSubscription(sub: string, connectionID: string): Promise<string | null> {
    console.log('addSubscription', sub, connectionID, TABLE_NAME)

    const timestamp = new Date().getTime()

    const params = {
        TableName: TABLE_NAME,
        Item: {
            sub,
            connectionID,
            createdAt: timestamp,
        },
        Expected: { id: { Exists: false } },
    }

    try {
        const result = await dynamoDb.put(params).promise()
        console.log(JSON.stringify(result))
        return sub
    } catch (error) {
        console.error(error)
    }
    return null
}

export async function listConnectionIDsForSub(sub: string): Promise<string[]> {
    console.log(`listConnectionIDsForSub`, sub, TABLE_NAME)

    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: '#hkey = :hkey',
        ExpressionAttributeValues: {
            ':hkey': sub,
        },
        ExpressionAttributeNames: {
            '#hkey': 'sub',
        },
    }

    try {
        const result = await dynamoDb.query(params).promise()
        console.log(JSON.stringify(result.Items))
        return result.Items.map((item) => item.connectionID)
    } catch (error) {
        console.error(error)
    }
    return []
}

export async function getSubsForConnection(connectionID: string): Promise<string[]> {
    console.log(connectionID)
    const params = {
        TableName: TABLE_NAME,
        IndexName: `${TABLE_NAME}-cxn-index`,
        KeyConditionExpression: '#hkey = :hkey',
        ExpressionAttributeValues: {
            ':hkey': connectionID,
        },
        ExpressionAttributeNames: {
            '#hkey': 'connectionID',
        },
    }
    try {
        const result = await dynamoDb.query(params).promise()
        console.log(JSON.stringify(result.Items))
        return result.Items.map((item) => item.sub)
    } catch (error) {
        console.error(error)
    }
    return []
}

export async function removeSubscriptionsForConnections(connectionID: string): Promise<void> {
    console.log(connectionID)
    const subs = await getSubsForConnection(connectionID)
    const deleteRequests = subs.map((sub) => ({ DeleteRequest: { Key: { sub, connectionID } } }))
    const params = {
        RequestItems: {
            [TABLE_NAME]: deleteRequests,
        },
    }
    try {
        const result = await dynamoDb.batchWrite(params).promise()
        console.log(JSON.stringify(result))
    } catch (error) {
        console.error(error)
    }
}

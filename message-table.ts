// Copyright 2020 Privacy Research, LLC

import { DynamoDB } from 'aws-sdk'
import { v4 as uuid } from 'uuid'

const dynamoDb = new DynamoDB.DocumentClient()
const TABLE = process.env.MESSAGE_TABLE_NAME

export interface MessageTableItem {
    address: string
    sortID: string
    message: string
}

export async function storeMessage(address: string, message: string): Promise<MessageTableItem> {
    const sortID = `${Date.now()}-${uuid()}`
    const item: MessageTableItem = { address, sortID, message }

    const params = {
        TableName: TABLE,
        Item: item,
    }

    try {
        const result = await dynamoDb.put(params).promise()
        console.log(JSON.stringify(result))
        return item
    } catch (error) {
        console.error(error)
        return null
    }
}

export async function getMessagesAfter(address: string, timestamp: number): Promise<string[]> {
    const params = {
        TableName: TABLE,
        KeyConditionExpression: `#hkey = :hkey and #rkey > :rkey`,
        ExpressionAttributeValues: {
            ':hkey': address,
            ':rkey': `${timestamp}`,
        },
        ExpressionAttributeNames: {
            '#hkey': 'address',
            '#rkey': 'sortID',
        },
    }

    try {
        const result = await dynamoDb.query(params).promise()
        console.log(JSON.stringify(result))
        if (result.Items.length > 0) {
            const items = result.Items as MessageTableItem[]
            return items.map((item) => item.message)
        }
    } catch (error) {
        console.error(error)
    }
    return []
}
export async function getMessagesBefore(address: string, timestamp: number): Promise<MessageTableItem[]> {
    const params = {
        TableName: TABLE,
        KeyConditionExpression: `#hkey = :hkey and #rkey < :rkey`,
        ExpressionAttributeValues: {
            ':hkey': address,
            ':rkey': `${timestamp}`,
        },
        ExpressionAttributeNames: {
            '#hkey': 'address',
            '#rkey': 'sortID',
        },
    }

    try {
        const result = await dynamoDb.query(params).promise()
        console.log(JSON.stringify(result))
        if (result.Items.length > 0) {
            return result.Items as MessageTableItem[]
        }
    } catch (error) {
        console.error(error)
    }
    return []
}

export async function deleteMessagesBefore(address: string, timestamp: number): Promise<void> {
    const msgs = await getMessagesBefore(address, timestamp)
    const deleteRequests = msgs.map((msg: MessageTableItem) => ({
        DeleteRequest: { Key: { address, sortID: msg.sortID } },
    }))
    const params = {
        RequestItems: {
            [TABLE]: deleteRequests,
        },
    }
    try {
        const result = await dynamoDb.batchWrite(params).promise()
        console.log(JSON.stringify(result))
    } catch (error) {
        console.error(error)
    }
}

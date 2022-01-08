// Copyright 2020 Privacy Research, LLC

import { ApiGatewayManagementApi } from 'aws-sdk'
import {
    Handler,
    APIGatewayProxyEvent,
    APIGatewayEventRequestContext,
    DynamoDBStreamEvent,
    AttributeValue,
} from 'aws-lambda'
import { addSubscription, listConnectionIDsForSub, removeSubscriptionsForConnections } from './subscription-table'
import { storeMessage, getMessagesAfter } from './message-table'

interface RealtimeAPIGatewayEventRequestContext extends APIGatewayEventRequestContext {
    connectionId: string
    connectedAt: number
}

export interface WebsocketAPIGatewayEvent extends APIGatewayProxyEvent {
    requestContext: RealtimeAPIGatewayEventRequestContext
}

export const connect: Handler = async (event: WebsocketAPIGatewayEvent) => {
    console.log(event)
    const { connectionId } = event.requestContext

    return {
        statusCode: 200,
        body: connectionId,
    }
}

export const subscribe: Handler = async (event: WebsocketAPIGatewayEvent) => {
    console.log('subscribe', event)
    const message = JSON.parse(event.body)
    const { connectionId } = event.requestContext
    for (const sub of message.channels) {
        await addSubscription(sub, connectionId)
    }
    return {
        statusCode: 200,
        body: connectionId,
    }
}

export const handleDefault: Handler = async (event: WebsocketAPIGatewayEvent) => {
    console.log('$default route, unexpected data', { event })

    return {
        statusCode: 400,
        body: 'Unrecognized websocket action',
    }
}

export const acceptMessage: Handler = async (event: WebsocketAPIGatewayEvent) => {
    // POST to all address connectionIDs
    let body
    try {
        body = JSON.parse(event.body)
    } catch (err) {
        console.log('Invalid message format', event.body)
        return {
            statusCode: 200,
            body: '',
        }
    }
    // store the message in the database
    const { address } = body

    const item = await storeMessage(address, event.body)
    return {
        statusCode: 200,
        body: JSON.stringify(item),
    }
}

export const onMessageInsert: Handler = async (event: DynamoDBStreamEvent) => {
    for (const record of event.Records) {
        // POST to all address connectionIDs
        if (record.eventName === 'REMOVE') {
            continue
        }
        let message: { [x: string]: AttributeValue }
        try {
            message = record.dynamodb.NewImage
        } catch (err) {
            console.log('Invalid message format', record)
            return {
                statusCode: 200,
                body: '',
            }
        }

        const address = message.address.S
        const msg = message.message.S
        await sendMessage(address, msg)
    }
    return {
        statusCode: 200,
        body: '',
    }
}

const sendMessage = async (address: string, msg: string) => {
    const connectionIDs = await listConnectionIDsForSub(address)
    for (const connectionID of connectionIDs) {
        try {
            await send(connectionID, msg)
        } catch (e) {
            console.error(`Error sending to connection id. Removing connection.`, { connectionID, e })
            await removeSubscriptionsForConnections(connectionID)
        }
    }
}

export const getRecentMessages: Handler = async (event: WebsocketAPIGatewayEvent) => {
    const { connectionId } = event.requestContext
    let body: { address: string }
    try {
        body = JSON.parse(event.body)
    } catch (err) {
        console.log('Invalid message format', event.body)
        return {
            statusCode: 200,
            body: '',
        }
    }
    const { address } = body

    const items = await getMessagesAfter(address, Date.now() - 24 * 60 * 60 * 1000)
    console.log({ items })
    for (const item of items) {
        await send(connectionId, item)
    }

    return {
        statusCode: 200,
        body: '',
    }
}

export const disconnect: Handler = async (event: WebsocketAPIGatewayEvent) => {
    const { connectionId } = event.requestContext
    await removeSubscriptionsForConnections(connectionId)
    return {
        statusCode: 200,
    }
}

function apiGatewayEndpoint() {
    const apiID = process.env[`WEBSOCKETS_API`]
    const region = process.env[`REGION`]
    const stage = process.env[`STAGE`]
    return `https://${apiID}.execute-api.${region}.amazonaws.com/${stage}`
}

const send = async (connectionID: string, message: string) => {
    const apigwManagementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: apiGatewayEndpoint(),
    })

    await apigwManagementApi.postToConnection({ ConnectionId: connectionID, Data: message }).promise()
}

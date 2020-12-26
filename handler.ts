// Copyright 2020 Privacy Research, LLC

/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyHandler } from 'aws-lambda'
import 'source-map-support/register'
import { FullKeyBundle, registerKeyBundle, getPublicPreKeyBundle } from './key-table'
import { getMessagesAfter, storeMessage } from './message-table'

export const register: APIGatewayProxyHandler = async (event, _context) => {
    const { address } = event.pathParameters
    const bundle = JSON.parse(event.body) as FullKeyBundle
    await registerKeyBundle(address, bundle)
    return {
        statusCode: 200,
        body: JSON.stringify(
            {
                message: 'OK',
            },
            null,
            2
        ),
    }
}

export const prekeyBundle: APIGatewayProxyHandler = async (event, _context) => {
    const { address } = event.pathParameters
    const bundle = await getPublicPreKeyBundle(address)
    if (bundle) {
        return {
            statusCode: 200,
            body: JSON.stringify(bundle, null, 2),
        }
    }
    return {
        statusCode: 404,
        body: '',
    }
}

export const messages: APIGatewayProxyHandler = async (event, _context) => {
    const { address } = event.pathParameters
    const { after } = event.queryStringParameters
    const messages = await getMessagesAfter(address, parseInt(after))
    return {
        statusCode: 200,
        body: JSON.stringify(messages, null, 2),
    }
}

export const send: APIGatewayProxyHandler = async (event, _context) => {
    const { address } = event.pathParameters
    const message = event.body
    const item = await storeMessage(address, message)
    return {
        statusCode: 201,
        body: JSON.stringify(item, null, 2),
    }
}

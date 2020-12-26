// Copyright 2020 Privacy Research, LLC

import { DynamoDB } from 'aws-sdk'

const dynamoDb = new DynamoDB.DocumentClient()

// All public heys are in fact base64 encoded byte arrays
export interface PublicPreKey {
    keyId: number
    publicKey: string
}

export interface SignedPublicKey {
    keyId: number
    publicKey: string
    signature: string
}
export interface FullKeyBundle {
    registrationId: number
    identityKey: string
    signedPreKey: SignedPublicKey
    oneTimePreKeys: PublicPreKey[]
}

export interface KeyTableItem extends FullKeyBundle {
    address: string
    created: number
    updated: number
}

export interface PublicPreKeyBundle {
    identityKey: string
    signedPreKey: SignedPublicKey
    preKey?: PublicPreKey
    registrationId: number
}

export async function registerKeyBundle(address: string, bundle: FullKeyBundle): Promise<string> {
    console.log(address, bundle, process.env.KEY_BUNDLE_TABLE_NAME)

    const timestamp = new Date().getTime()
    const item: KeyTableItem = {
        address,
        ...bundle,
        created: timestamp,
        updated: timestamp,
    }

    const params = {
        TableName: process.env.KEY_BUNDLE_TABLE_NAME,
        Item: item,
        Expected: {
            address: {
                Exists: false,
            },
        },
    }

    try {
        const result = await dynamoDb.put(params).promise()
        console.log(JSON.stringify(result))
        return address
    } catch (error) {
        console.error(error)
        return ''
    }
}

export async function getFullKeyBundle(address: string): Promise<KeyTableItem | null> {
    const params = {
        TableName: process.env.KEY_BUNDLE_TABLE_NAME,
        KeyConditionExpression: '#hkey = :hkey',
        ExpressionAttributeValues: {
            ':hkey': address,
        },
        ExpressionAttributeNames: {
            '#hkey': 'address',
        },
    }

    try {
        const result = await dynamoDb.query(params).promise()
        console.log(JSON.stringify(result))
        if (result.Items.length > 0) {
            return result.Items[0] as KeyTableItem
        }
    } catch (error) {
        console.error(error)
    }
    return null
}

export async function replaceSignedPreKey(address: string, signedPublicPreKey: SignedPublicKey): Promise<void> {
    const params = {
        TableName: process.env.KEY_BUNDLE_TABLE_NAME,
        Key: { address },
        AttributeUpdates: {
            signedPublicPreKey: {
                Action: 'PUT',
                Value: signedPublicPreKey,
            },
            updated: {
                Action: 'PUT',
                Value: Date.now(),
            },
        },
    }

    const result = await dynamoDb.update(params).promise()
    console.log(JSON.stringify(result))
}

export async function replaceOneTimePreKeys(address: string, prekeys: PublicPreKey[]): Promise<void> {
    const params = {
        TableName: process.env.KEY_BUNDLE_TABLE_NAME,
        Key: { address },
        AttributeUpdates: {
            oneTimePreKeys: {
                Action: 'PUT',
                Value: prekeys,
            },
            updated: {
                Action: 'PUT',
                Value: Date.now(),
            },
        },
    }

    const result = await dynamoDb.update(params).promise()
    console.log(JSON.stringify(result))
}

export async function removeAddress(address: string): Promise<void> {
    const params = {
        TableName: process.env.KEY_BUNDLE_TABLE_NAME,
        Key: {
            address,
        },
    }

    try {
        const result = await dynamoDb.delete(params).promise()
        console.log(JSON.stringify(result))
        return
    } catch (error) {
        console.error(error)
    }
}

export async function getPublicPreKeyBundle(address: string): Promise<PublicPreKeyBundle | null> {
    const bundle = await getFullKeyBundle(address)
    if (!bundle) {
        return null
    }
    const preKey = bundle.oneTimePreKeys.pop()
    if (preKey) {
        // remove it from the db
        // TODO: we have a race condition here and we could end up storing a key that another
        // request used.  Need to put this in a transaction.
        await replaceOneTimePreKeys(address, bundle.oneTimePreKeys)
    }

    const { registrationId, identityKey, signedPreKey } = bundle
    return { registrationId, identityKey, signedPreKey, preKey }
}

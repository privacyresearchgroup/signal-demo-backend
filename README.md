# Simple Signal Server

This repository implements the server components needed to run a simple signal service: a directory/key service
and a message service.

## Getting Started

Run `yarn` to install all of the needed dependencies, then deploy using the following command:

```
sls deploy --stage mystagename --aws-profile myawsprofile
```

This creates a Websocket and a REST API that are now ready to use. Information about the newly created stack
will appear in the console.

## Enpoints and Resources

The deployment creates the following REST API endpoints:

- `keys/{address} PUT` - Registers the keys for a user with the `address` in the path. Expects a request body of type `FullKeyBundle` as defined in [key-table.ts](https://github.com/privacyresearchgroup/backend/blob/master/signal-service/key-table.ts#L18).
- `keys/{address} GET` - Gets a `PublicPreKeyBundle` as defined in [key-table.ts](https://github.com/privacyresearchgroup/backend/blob/master/signal-service/key-table.ts#L31) containing exactly one of the one-time keys for the user at the given `address`. Removes that one-time key from the database.
- `messages/{address} POST` - Sends a message to an address. In practice these will be base 64 encoded protobuf messages, but can be arbitrary strings.
- `messages/{address} GET` with query string `?after=<timestamp>` - retrieves all messages for a user after the given timestamp.

## Accessing Services from the Command Line

In what follows we will walk through the use of each of the published endpoints and websocket actions
using `curl` and `wscat`. This allows us to test deployments and makes it clear how to access the
resources in code.

### Use the REST API to Upload Keys

To upload a keyset to the service at address `markj` with the following content

```json
{
  "registrationId": 1,
  "identityKey": "ABC123",
  "signedPreKey": {
    "keyId": 2,
    "publicKey": "aPublicKey",
    "signature": "thisigisinvalid"
  },
  "oneTimePreKeys": ["DEF456", "GHI789"]
}
```

store it in a document called `fullkeybundle.json` and run the following command:

```
curl -X PUT -H "Content-Type: application/json" -H "x-api-key: <yourapikey>" -d @./fullkeybundle.json https://<apiID>.execute-api.us-west-2.amazonaws.com/<mystagename>/keys/markj
```

Note the address `markj` in the URL. You will need to substitute your own `apiID` and `yourapikey`.

### Use the REST API to Fetch a PreKey Bundle

To get a PreKey bundle for user `markj`, run the following command:

```
curl -H "x-api-key: <yourapikey>" https://<apiID>.execute-api.us-west-2.amazonaws.com/<mystagename>/keys/markj
```

Run it multiple times and note that the preKey is different each time until the preKeys are all used up, then there is no preKey.

### Use the REST API to send and recieve messages

To send a message to address `markj`:

```
curl -X POST -H "x-api-key: <yourapikey>" -H "Content-Type: application/json" -d "hi markj" https://<apiID>.execute-api.us-west-2.amazonaws.com/<mystagename>/messages/markj
```

and to get all messages to `markj` after timestamp 1596600000000:

```
curl -H "x-api-key: <yourapikey>" https://<apiID>.execute-api.us-west-2.amazonaws.com/<mystagename>/messages/markj?after=1596600000000
```

### Use the Websocket to send a message

First connect to the websocket using `wscat` (which can be installed globally with `npm install -g wscat` if not already):

```
wscat -c wss://<websocketID>.execute-api.us-west-2.amazonaws.com/<mystagename>
```

Then at the prompt subscribe to messages for `markj` and `pantani`:

```
> {"action": "subscribe", "channels": ["markj", "pantani"]}
```

Send a message to `pantani`:

```
> {"action": "sendMessage", "address": "pantani", "message": "somebase64Enc0d3dprotobuf4u"}
```

And if you subscribed to `pantani` you'll see this:

```
< somebase64Enc0d3dprotobuf4u
```

Finally let's get all recent messages for markj

```
> {"action": "recent", "address": "markj"}
```

# License

This project is licensed under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html).

Copyright 2020 - Privacy Research, LLC

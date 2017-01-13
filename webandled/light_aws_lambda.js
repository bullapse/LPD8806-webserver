'use strict';

console.log('Loading function');

const doc = require('dynamodb-doc');

const dynamo = new doc.DynamoDB();
const tableName = "light";


/**
 * Demonstrates a simple HTTP endpoint using API Gateway. You have full
 * access to the request and response payload, including headers and
 * status code.
 *
 * To scan a DynamoDB table, make a GET request with the TableName as a
 * query string parameter. To put, update, or delete an item, make a POST,
 * PUT, or DELETE request respectively, passing in the payload to the
 * DynamoDB API as a JSON body.
 */
exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    switch (event.httpMethod) {
        case 'DELETE':
            dynamo.deleteItem(JSON.parse(event.body), done);
            break;
        case 'GET':
            var params = {
                TableName : tableName
            };
            if (isNameInEvent(event)) {
                params.FilterExpression = "#n = :n";
                params.ExpressionAttributeNames = {"#n" : "name"};
                params.ExpressionAttributeValues = {":n" : event.queryStringParameters.name};
            }
            dynamo.scan(params, done);

            break;
        case 'POST':
            var params = {
                TableName : tableName
            };
            params.Item = JSON.parse(event.body);
            dynamo.putItem(params, done);
            break;
        case 'PUT':
            // Only updates one queryparam other than name
            var params = {
                TableName : tableName
            };
            if (isNameInEvent(event)) {
                params.Item = JSON.parse(event.body);
                var posParams = ["location", "animation", "ip", "user", "description", "mac", "color"];
                var found = false;
                for (var i = 0; i < posParams.length; i++) {
                    if (posParams[i] in event.queryStringParameters) {
                        params.UpdateExpression = "set #n = :qp";
                        params.ExpressionAttributeNames = {"#n" : event.queryStringParameters.name};
                        params.ExpressionAttributeValues = {":qp" : event.queryStringParameters[posParams[i]]};
                        found = true;
                        dynamo.updateItem(params, done);

                    }
                }
                if (!found) {
                    done(new Error("Expected another query param"));
                }
            } else {
                done(new Error("Name is required as a query param to update"));
            }

            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};

function isNameInEvent(event) {
    return event.queryStringParameters !== null && "name" in event.queryStringParameters && event.queryStringParameters.name !== null
}

// console.log('Loading function');

const doc = require('dynamodb-doc');
const AWS = require("aws-sdk");
const dynamo = new doc.DynamoDB();
const tableName = "light";
AWS.config.update({
    region: "us-west-2"
});
const sqs = new AWS.SQS({
    apiVersion: '2012-11-05'
});
const queueUrl = "https://sqs.us-west-2.amazonaws.com/375196554251/Lights";

const validAnimations = {
    "off": 0,
    "rainbow": 1,
    "colorchase": 2,
    "theaterchase": 3,
    "colorwhipe": 4,
    "rainbowcycle": 5,
    "theaterchaserainbow": 6,
};

const validColors = {
    "white" : 0,
    "red" : 1,
    "yellow" : 2,
    "green" : 3,
    "cyan" : 4,
    "blue" : 5,
    "purple" : 6
}

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
    // console.log('Received event:', JSON.stringify(event, null, 2));

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
                var posParams = ["location", "animation", "ip", "user", "description", "mac", "color"];
                var found = false;
                for (var i = 0; i < posParams.length; i++) {
                    // console.log(posParams[i]);
                    if (posParams[i] in event.queryStringParameters) {
                        if (posParams[i] == "animation" && !(event.queryStringParameters.animation in validAnimations)) {
                            done(new Error("Invalid Animation was given: Please give one of the following: off, rainbow, colorchase, theaterchase, colorwhipe, rainbowcycle, theaterchaserainbow"))
                        }
                        if (posParams[i] == "color" && !(event.queryStringParameters.color in validColors)) {
                            done(new Error("Invalid Color was given: Please give one of the followling: white, red, yellow, green, cyan, blue, purple"))
                        }
                        params.Key = {name : event.queryStringParameters.name}
                        params.UpdateExpression = "set #x = :xi";
                        params.ExpressionAttributeNames = {"#x" : posParams[i]};
                        params.ExpressionAttributeValues = {":xi" : event.queryStringParameters[posParams[i]]};
                        found = true;
                        dynamo.updateItem(params, function(err, data) {
                            if (err) {
                                console.log(err)
                            }
                        });
                        sendMessage(event.queryStringParameters.name, posParams[i], event.queryStringParameters[posParams[i]], done);

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


function sendMessage(lightName, paramName, paramValue, callback) {
    var params = {
        DelaySeconds: 0,
        MessageAttributes: {
            "name": {
                DataType: "String",
                StringValue: lightName
            }
        },
        MessageBody: "Update for light",
        QueueUrl: queueUrl
    };
    params.MessageAttributes[paramName] = {
        DataType: "String",
        StringValue: paramValue
    };
    sqs.sendMessage(params, function(err, data) {
        return callback(err, data);
    });
}

function isNameInEvent(event) {
    return event.queryStringParameters !== null && "name" in event.queryStringParameters && event.queryStringParameters.name !== null
}

var AWS = require("aws-sdk");


AWS.config.update({
    region: "us-west-2"
});
const dynamo = new AWS.DynamoDB();
const sqs = new AWS.SQS({
    apiVersion: '2012-11-05'
});

const queueUrl = "https://sqs.us-west-2.amazonaws.com/375196554251/Lights";


/**
 * TODO
 */
exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event, null, 2));

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    var TableName = "light";


    switch (event.httpMethod) {
        case 'GET':
            var SQSparams = {
                AttributeNames: [
                    "All"
                ],
                MaxNumberOfMessages: 1,
                MessageAttributeNames: [
                    "All"
                ],
                QueueUrl: queueUrl,
                VisibilityTimeout: 123,
                WaitTimeSeconds: 0
            };
            if (event.queryStringParameters !== null && "name" in event.queryStringParameters && typeof event.queryStringParameters.name !== undefined) {
                console.log("TODO")
            }
            console.log("recieve message")
            sqs.receiveMessage(SQSparams, done)
            break;
        case 'POST':
            var body = JSON.parse(event.body);
            var animation = isValidAnimation(body);
            if (animation) {
                params.
                params.Item = body;
                dynamo.updateItem(body, function(err, data) {
                    if (err) {
                        console.log(err)
                    } else {
                        console.log(data)
                    }
                });
                sendMessage(body, done);
                //     if (err) {
                //         done("Invalid");
                //     } else {

                //         console.log("Message Sent and DB update complete");
                //     }
                // });
            }
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};

function isValidAnimation(body) {
    // I do not use the animatino value, but it's here to be added to future implementations
    var animations = {
        "off": 0,
        "rainbow": 1,
        "colorchase": 2,
        "theaterchase": 3,
        "colorwhipe": 4,
        "rainbowcycle": 5,
        "theaterchaserainbow": 6,
    };
    var a = body.animation.toLowerCase();
    if (a in animations) {
        return {
            "animation": body.animation.toLowerCase(),
            "value": animations[a]
        };
    }
    return false;
}

function sendMessage(body, callback) {
    var params = {
        DelaySeconds: 0,
        MessageAttributes: {
            "Name": {
                DataType: "String",
                StringValue: body.name
            },
            "Animation": {
                DataType: "String",
                StringValue: body.animation
            },
            "Color": {
                DataType: "String",
                StringValue: body.color
            }
        },
        MessageBody: "Update for light",
        QueueUrl: queueUrl
    };

    sqs.sendMessage(params, function(err, data) {
        return callback(err, data);
    });
}

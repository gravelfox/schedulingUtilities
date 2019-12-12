import AWS from "aws-sdk";
import { findNextLEFromDynamo } from "../libs/utils";


export default class Newsletter{
    
    constructor (newsletterProperties) {
        this.updateNewsletterProps(newsletterProperties);
    }

    static async getNewsletterByUserId (userId) {
        const nextLaunchEvent = await findNextLEFromDynamo();
        //first try custom user newsletters table...
        console.log(nextLaunchEvent);
        let newsletterProps = await this.getUserNewsletterById(nextLaunchEvent.newsletterId, userId); 
        //then, if the user hasn't created a custom newsletter, get the default newsletter...
        if(!newsletterProps) newlsetterProps = await getDefaultNewsletterById(nextLaunchEvent.newsletterId);
        return new Newsletter(newsletterProps);
    }

    static async getUserNewsletterById (newsletterId, userId) {
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: "userNewsletters",
            Key: {
                userId, 
                newsletterId
            },
            ConsistentRead: true
        };
        const dynamoResult = await dynamoDb.get(params).promise();
        return dynamoResult.Item;
    }

    async getDefaultNewsletterById (newsletterId) {
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: "defaultNewsletters",
            Key: {
                newsletterId
            }
        }
        const dynamoResult = await dynamoDb.get(params).promise();
        return dynamoResult.Item;
    }

    updateNewsletterProps (newsletterObject) {
        Object.keys(newsletterObject).forEach(prop => {
            this[prop] = newsletterObject[prop];
        })
    }
}
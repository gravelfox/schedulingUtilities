import AWS from "aws-sdk";
import rp from "request-promise";
import Mailchimp from "mailchimp-api-v3";
import { fillTemplate } from "../libs/templates";
import Newsletter from "./Newsletter";
import LaunchWindow from "./LaunchWindow";


export default class User{
    
    constructor (userProperties) {
        this.updateUserProps(userProperties);
    }

    static async createUserFromId (userId) {
        const userProps = await getFromDynamo(userId);
        return new User(userProps);
    }

    async getFromDynamo (userId = this.userId) {
        //get the user record from dynamo...
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: "tr-users-sandbox",
            Key: { userId }
        }
        const userRecord = await dynamoDb.get(params).promise();
        return userRecord.Item;
    }

    async updateRecord (updatedData) {
        //update user record on dynamo with updatedData return dynamo response...
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: "tr-users-sandbox",
            Key: { userId: this.userId },
            UpdateExpression: this.buildUpdateExpression(updatedData),
            ExpressionAttributeValues: this.buildExpressionAttributeValues(updatedData),
            ReturnValues: "ALL_NEW"
        }
        const dynamoResponse = await dynamoDb.update(params).promise();
        return dynamoResponse.Item;
    }

    async createMailchimpTemplate () {
        //create a new Mailchimp template folder, then template therein, returns new user...
        //adds both props to user and pushes to dynamo.
        const mailchimp =  new Mailchimp(this.apiKey);
        const createFolderParams = {
            method: "post",
            path: `/template-folders`,
            body: {
                name: 'Trusty Raven'
            }
        }
        let createTemplateParams = {
            method: "post",
            path: "/templates",
            body: {
                name: "tr-template",
                folder_id: "",
                html: fillTemplate(this.template, this.color, this, 0)
            }
        }
        const createFolderResponse = await mailchimp(createFolderParams);
        createTemplateParams.body.folder_id = this.templateFolderId;
        const createTemplateResponse =  await mailchimp(createTemplateParams);
        const newProps = {templateFolderId: createFolderResponse.id, templateId: createTemplateResponse.id}
        this.updateUserProps(newProps);
        console.log(await this.updateRecord(newProps));
    }

    async updateMailchimpTemplate () {
        const mailchimp =  new Mailchimp(this.apiKey);
        const params = {
            name: "tr-template",
            html: await fillTemplate(this.template, this.color, this, 0),
            folder_id: this.templateFolderId
        };
        const mailchimpResponse = await mailchimp.request({ 
            method: "patch",
            path: `/templates/${userRecord.templateId}`,
            body: params
        });
        this.updateUserProps({templateId: mailchimpResponse.id});
        console.log(await this.updateRecord({templateId: mailchimpResponse.id}));
    }

    updateUserProps (userObject) {
        Object.keys(userObject).forEach(prop => {
            this[prop] = userObject[prop];
        })
    }

    buildUpdateExpression (userObject) {
        //create an UpdateExpression string for dynamoDb update parameters...
        let outputString = "SET ";
        const parameters = Object.keys(userObject);
        parameters.forEach(prop => {
            if(outputString.length > 4) outputString += ", ";
            outputString += prop + " = :" + prop;
        })
        return outputString;
    }

    buildExpressionAttributeValues (userObject) {
        //create an ExpressionAttributeValues object for dynamoDb update parameters...
        let outputObject = {}
        let parameters = Object.keys(userObject);
        parameters.forEach(prop => {
            outputObject[`:${prop}`] = userObject[prop];
        })
        return outputObject;
    }

    async createMailchimpCampaign () {
        if(!this.userId || !this.firstName || !this.lastName || !this.templateId || !this.listId || !this.apiKey)
            throw new Error("User is missing properties necessary to create campaign.");
        if(this.campaignId)
            throw new Error("User already has campaignId. Please archive or otherwise dispose of it before creating a new one.");
        
        const mailchimp =  new Mailchimp(this.apiKey);
        const newsletter = await Newsletter.getNewsletterByUserId(this.userId);
        const params = {
            type: "regular",
            recipients: {
                list_id: this.listId
            },
            settings: {
                subject_line: newsletter.subject,
                title: newsletter.newsletterId,
                from_name: `${this.firstName} ${this.lastName}`,
                template_id: this.templateId
            }
        }
        const mailchimpResult = await mailchimp.request({
            method: "post",
            path: `/campaigns`,
            body: params
        })
        const campaignId = mailchimpResult.id;
        this.updateUserProps({campaignId});
        console.log(await this.updateRecord({campaignId}));
    }

    async uploadHeaderImage () {
        if(!this.userId || !this.apiKey)
            throw new Error("User is missing properties necessary to upload header image.");
        if(this.headerImageURL)
            throw new Error("User already has headerImageURL. Please archive or otherwise dispose of it before creating a new one.");

        const mailchimp =  new Mailchimp(this.apiKey);
        const newsletter = await Newsletter.getNewsletterByUserId(this.userId);
        const imageData = await rp(newsletter.headerImageURL,{encoding:null});
        const buffer = new Buffer(imageData);
        const base64Image = buffer.toString('base64');
        const fileName = newsletter.headerImageURL.substring(newsletter.headerImageURL.indexOf(".com/")+5);
        const mailchimpResponse = await mailchimp.request({
            method: "post",
            path: "/file-manager/files",
            body: {
                name: fileName,
                file_data: base64Image
            }
        })
        const headerImageURL = mailchimpResponse.full_size_url;
        this.updateUserProps({headerImageURL});
        console.log(await this.updateRecord({headerImageURL}));
    }

    async updateMailchimpCampaignContent () {
        if(!this.userId || !this.apiKey || !this.headerImageURL || !this.campaignId || !this.templateId)
            throw new Error("User is missing properties necessary to upload header image.");
        const mailchimp = new Mailchimp(this.apiKey);
        const headerImageTag = `<img src="${this.headerImageURL}" alt="header" width=100% class="g-img" />`;
        const newsletter = await Newsletter.getNewsletterByUserId(this.userId);
        const params = {
            template: {
                id: this.templateId,
                sections: {
                    header: headerImageTag,
                    body: newsletter.contentHTML
                }
            }
        };
        await mailchimp.request({
            method: "put",
            path: `/campaigns/${this.campaignId}/content`,
            body: params
        });
    }

    async sendCampaignTest (toAddress = this.emailAddress) {
        //sends a mailchimp test email, to the user by default...
        if(!this.apiKey || !this.campaignId || !toAddress)
            throw new Error("User is missing properties necessary to send test email.");
        const mailchimp = new Mailchimp(this.apiKey);
        console.log(await mailchimp.request({
            method: "post",
            path: `/campaigns/${this.campaignId}/actions/test`,
            body: {
                test_emails: [toAddress],
                send_type: "html"
            }})
        )
    }

    async archiveCampaign () {
        if(!this.userId || !this.campaignId || !this.headerImageURL){console.log(this);
            throw new Error("User is missing properties necessary to archive campaign.");
        }
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const newsletter = await Newsletter.getNewsletterByUserId(this.userId);
        const now = new Date();
        
        async function writeCampaignToUsedTable () {
            const params = {
                TableName: "used-campaigns",
                Item: {
                    userId: this.userId,
                    newsletter: newsletter.newsletterId,
                    campaignId: this.campaignId,
                    headerImageURL: this.headerImageURL,
                    archiveStamp: now.getTime()
                }
            };
            return await dynamoDb.put(params).promise();
        }

        async function removeCampaignFromUserRecord () {
            const params = {
                TableName: "tr-users-sandbox",
                Key: {
                    userId: this.userId
                },
                UpdateExpression: "REMOVE campaignId, headerImageURL"
            };
    
            return await dynamoDb.update(params).promise();
        }

        console.log(await writeCampaignToUsedTable());
        const removeResponse = await removeCampaignFromUserRecord();
        return removeResponse;
    }

    getLaunchTime () {
        //gets the launch date for the user for the current or upcoming launch window...
        const launchWindow = new LaunchWindow();
        const launchDate = new Date(launchWindow.defaultDate);
        if(this.delayDays && this.delayDays > 0){
            launchDate.setDate(launchDate.getDate() + this.delayDays);
        }
        if(this.delayTime && this.delayTime !== "1000"){
            launchDate.setHours(this.delayTime.substring(0,2),this.delayTime.substring(2),0,0);
        }
        return launchDate;
    }
    
    async sendCampaign () {
        if(!this.apiKey || !this.campaignId)
            throw new Error("User is missing properties necessary to send campaign.");
        let mailchimp = new Mailchimp(this.apiKey);
        return await mailchimp.request({
            method: "post",
            path: `/campaigns/${this.campaignId}/actions/send`
        })
    }
}
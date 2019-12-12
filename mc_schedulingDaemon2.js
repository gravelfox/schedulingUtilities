import AWS from "aws-sdk";
import { sendEmail, createPacificDate, fixTime } from "./libs/utils";
import User from "./classes/User";
import LaunchWindow from "./classes/LaunchWindow";


export async function main() {

    async function getUserTable(){
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: "tr-users-sandbox",
            ProjectionExpression: "firstName, lastName, userId, apiKey, delayDays, delayTime, campaignId, emailAddress, headerImageURL"
        } 
        return await dynamoDb.scan(params).promise(); 
    }

    function buildLaunchArray(userTable) {
        let launchArray = [];
        userTable.Items.forEach(userDetails => {
            let user = new User(userDetails);
            let launchTime = user.getLaunchTime();
            if(now.getTime() === launchTime.getTime()){
                launchArray.push(user.sendCampaign());
                launchArray.push(sendEmail("support@trustyraven.com", `${user.firstName} ${user.lastName}'s newsletter has entered a launch condition and 
                has been sent.`, `${user.firstName} ${user.lastName}'s newsletter is launching.`));
                launchArray.push(user.archiveCampaign());
            }
        });
        return launchArray;
    }

    function buildPrelaunchArray(userTable) {
        let prelaunchArray = [];
        userTable.Items.forEach(userDetails => {
            let user = new User(userDetails);
            let launchTime = user.getLaunchTime();
            launchTime.setDate(launchTime.getDate()-1);
            if(now.getTime() === launchTime.getTime()){
                prelaunchArray.push(user.sendCampaignTest("support@trustyraven.com"));                
                prelaunchArray.push(sendPrelaunchEmail(user));
            }
        });
        return prelaunchArray;
    }

    async function sendPrelaunchEmail (user) {
        function ordinalIndicator(number){
            if(number > 10 && number < 14 ) number = 0;
            number = number % 10;
            switch (number) {
                case 1:
                    return "st";
                case 2:
                    return "nd";
                case 3:
                    return "rd";
                default:
                    return "th"
            }
        }
        const mondayDate = launchWindow.closeDate.getDate();
        const mondayString = `Monday the ${mondayDate}${ordinalIndicator(mondayDate)}`;
        const fullBodyString = 
            `Hello friend,<br />
            <br />
            Your Trusty Raven newsletter is scheduled for its glorious launch in 24 hours.<br />
            <br />
            If you’d like more time to spruce and streamline, you can delay your newsletter to launch as late as 11:45pm on ${mondayString}. That option is located in <a href="https://trustyraven.com/settings">the settings section</a> under the timing header.<br />
            <br />
            Please respond to this message if you have any questions or comments or know a good raven joke.<br />
            <br />
            Happy launching!<br />
            <br />
            Warmly,<br />
            <br />
            Your Trusty Raven`;
        const subjectString = "FRIENDLY REMINDER: 24 hours until your newsletter launch! :)";
        return await sendEmail(user.emailAddress, fullBodyString, subjectString);
    }

    const launchWindow = new LaunchWindow();
    let now = fixTime(createPacificDate());
    if(!launchWindow.isOpen()){    //check to see if we're in a launch Window and quit if we're not...
        console.log("Outside launch window, exiting...");
        return;
    }
    try{
        let userTable = await getUserTable();
        let results = await Promise.all(buildLaunchArray(userTable).concat(buildPrelaunchArray(userTable)));
        console.log(results);
    } catch (err) {
        console.log(err)
        await sendEmail("support@trustyraven.com", `The following error occured running the scheduling daemon: <br />${err}`, "! A Scheduling Error Has Occured !" );
    }
}

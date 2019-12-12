import { fixTime } from "../libs/utils";

export default class LaunchWindow{
    
    constructor () {
        let now = fixTime(this.createPacificDate());
        this.openDate = this.findCurrentOrNextLaunch(now.getMonth());
        this.closeDate = new Date(this.openDate);
        this.closeDate.setDate(this.closeDate.getDate() + 6);
        this.closeDate.setHours(23,45,0,0);
        this.defaultDate = new Date(this.openDate);
        this.defaultDate.setHours(10);
    }

    findCurrentOrNextLaunch (month) {
        const now = this.createPacificDate();
        const firstTuesday = this.getFirstTuesday(month);
        const endOfWindow = new Date(firstTuesday);
        endOfWindow.setDate(endOfWindow.getDate()+6);
        endOfWindow.setHours(23,45);
        if(now > endOfWindow){
            return this.findCurrentOrNextLaunch(month + 1);
        }
        return firstTuesday;
    }

    createPacificDate () {
        let date = new Date();
        let pacificDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        return pacificDate;
    }

    getFirstTuesday (month) {
        var date = this.createPacificDate();
        date.setDate(1);
        date.setMonth(month);
        while(date.getDay() !== 2){
            date.setDate(date.getDate() + 1);
        }
        date.setHours(0,0,0,0);
        return date;
    }

    isOpen () {
        const now = fixTime(this.createPacificDate());
        const adjustedOpenDate = new Date(this.openDate);
        adjustedOpenDate.setDate(adjustedOpenDate.getDate()-1);  //push the open date one day earlier to accommodate prelaunches...
        if(now >= adjustedOpenDate && now <= this.closeDate) return true;
        return false;
    }
}
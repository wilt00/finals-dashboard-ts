/*global moment*/
import moment from "moment";

class Exam {
    public start: moment.Moment;
    public end: moment.Moment;
    public past: boolean;
}

window.onload = function () {
    const times: Exam[] = [];
    const now = moment();

    // Template creates divs with class "final" for each final
    // Filter out finals with dates in the past, and add the class "past",
    //  which will apply a style to hide the element
    const finalCards = Array.from(document.getElementsByClassName("final")).filter((f: HTMLDivElement) => {
        if (moment(f.dataset.finalEnd).dayOfYear < now.dayOfYear) {
            f.classList.add("past");
            return false;
        }
        return true;
    });

    // Only need to add countdown to finals which are in the future
    const finalCountdowns = Array.from(document.getElementsByClassName("finalCountdown"))
        .filter((f) => !f.parentElement.classList.contains("past"));

    // Account for dead panels in monitor wall
    // Panels are numbered from the top left corner, starting from 0
    // 0, 1, ... 4
    // 5, 6, ... etc
    // The first card lands in panel 5, so we only do anything when the panel
    //  number is between 5 and 19 inclusive
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("deadPanels")) {
        const finalsContainer = document.getElementById("finalsContainer");
        const deadIndices = urlParams.get("deadPanels")
            .split(",")
            .map((p) => parseInt(p) - 5)  // for some reason, .map(parseInt) doesn't work
            .filter((p) => !(isNaN(p)) && p >= 0 && p <= 14)
            .sort();
        for (let i = 0; i < deadIndices.length; i++) {
            let refCard = finalCards[deadIndices[i]];
            if (!refCard) { refCard = null; }
            const deadCard = document.createElement("div");
            deadCard.classList.add("final");
            finalsContainer.insertBefore(deadCard, refCard);

            // There is now one more card in the list; decrement all following
            //  locations by one
            // Indices are sorted
            for (let j = i + 1; j < deadIndices.length; j++) {
                deadIndices[j] -= 1;
            }
        }
    }

    Array.from(document.getElementsByClassName("finalTime"))
        .filter((f) => !f.parentElement.classList.contains("past"))
        .map((ft: HTMLDivElement, i) => {
            const final = ft.parentNode as HTMLDivElement;
            const start = moment(final.dataset.finalStart);
            const end = moment(final.dataset.finalEnd);
            const past = (end.dayOfYear() < now.dayOfYear());
            times[i] = { start, end, past };
            ft.innerHTML = start.format("ddd MMM DD, hh:mm A");
            if (past) {
                final.classList.add("past");
            }
        });

    const gradTime = times.slice(-1)[0].end;

    function updateCountdowns() {
        const now = moment();

        finalCountdowns.map((fc, i) => {
            if (times[i].past) { return; }
            const diff = moment.duration(times[i].start.diff(now));
            const hrs = Math.floor(diff.asHours());
            if (hrs < 0) {
                fc.parentElement.classList.remove("countdownWarning");
                if (times[i].start.unix() < now.unix() && times[i].end.unix() > now.unix()) {
                    fc.parentElement.classList.add("inProgress");
                    fc.innerHTML = "ongoing";
                }
                if (times[i].end.unix() < now.unix()) {
                    fc.parentElement.classList.remove("inProgress");
                    fc.parentElement.classList.add("past");
                    fc.parentElement.classList.add("countdownExpired");
                    times[i].past = (times[i].end.dayOfYear() < now.dayOfYear());
                    fc.innerHTML = "00:00:00";
                }
                return;
            }
            if (hrs < 2) {
                fc.parentElement.classList.add("countdownWarning");
            }

            const mins = diff.minutes();
            let minsString = mins.toString()
            if (mins <= 0) { minsString = "00"; } else if (mins < 10) { minsString = `0${minsString}`; }

            const secs = diff.seconds();
            let secsSeconds = secs.toString();
            if (secs <= 0) { secsSeconds = "00"; } else if (secs < 10) { secsSeconds = `0${secsSeconds}`; }

            fc.innerHTML = `${hrs.toString().padStart(2, "0")}:${minsString}:${secsSeconds}`;
        });
        const gradTimeDiff = moment.duration(gradTime.diff(moment()));
        if (Math.floor(gradTimeDiff.asHours()) > 0 || gradTimeDiff.minutes() > 0 || gradTimeDiff.seconds() > 0) {
            document.getElementById("gradCountdown").innerHTML = `${
                Math.floor(gradTimeDiff.asHours()).toString().padStart(2, "0")
            }:${
                gradTimeDiff.minutes().toString().padStart(2, "0")
            }:${
                gradTimeDiff.seconds().toString().padStart(2, "0")
            }`;
        } else {
            document.getElementById("gradCountdown").innerHTML = "00:00:00";
        }
    }
    window.setInterval(updateCountdowns, 1000);
};

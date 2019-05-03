/*global moment*/

window.onload = function () {
    const times = [];
    const now = moment();

    const finalCards = Array.from(document.getElementsByClassName("final"))
        .filter((f) => {
            if (moment(f.dataset.finalEnd).dayOfYear < now.dayOfYear) {
                f.classList.add("past");
                return false;
            }
            return true;
        });

    const finalCountdowns = Array.from(document.getElementsByClassName("finalCountdown"))
        .filter((f) => !f.parentElement.classList.contains("past"));

    // Account for dead panels in monitor wall
    // Panels are numbered from the top left corner, starting from 0
    // 0, 1, ... 4
    // 5, 6, ... etc
    // The first card lands in panel 5, so we only do anything when the panel
    //  number is between 5 and 19 inclusive
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('deadPanels')) {
        const finalsContainer = document.getElementById("finalsContainer");
        urlParams.get('deadPanels')
            .split(',')
            .map(parseInt)
            .filter((p) => !(!p || p < 5 || p > 19))  // Double negation to short-circuit NaN
            .map((p) => {
                let refCard = finalCards[p - 5];
                if (!refCard) refCard = null;
                const deadCard = document.createElement("div");
                deadCard.classList.add("final");
                finalsContainer.insertBefore(deadCard, refCard);
            });
    }

    Array.from(document.getElementsByClassName("finalTime"))
        .filter((f) => !f.parentElement.classList.contains("past"))
        .map((ft, i) => {
            const final = ft.parentNode;
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
            if (times[i].past) return;
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

            let mins = diff.minutes();
            if (mins <= 0) mins = "00";
            else if (mins < 10) mins = `0${mins}`;

            let secs = diff.seconds();
            if (secs <= 0) secs = "00";
            else if (secs < 10) secs = `0${secs}`;

            fc.innerHTML = `${hrs.toString().padStart(2, 0)}:${mins}:${secs}`;
        });
        const gradTimeDiff = moment.duration(gradTime.diff(moment()));
        document.getElementById("gradCountdown").innerHTML = `${
            Math.floor(gradTimeDiff.asHours()).toString().padStart(2, 0)
            }:${
            gradTimeDiff.minutes().toString().padStart(2, 0)
            }:${
            gradTimeDiff.seconds().toString().padStart(2, 0)
            }`;
    }
    window.setInterval(updateCountdowns, 1000);
};
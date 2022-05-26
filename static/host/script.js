import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage } from '../shared.js';

// Constants
const ERROR_TIMEOUT_MS = 3000;

// Initialize notification handling
const notifier = new AWN({
    durations: {
        error: ERROR_TIMEOUT_MS
    },
    maxNotifications: 5,
    icons: {
        prefix: '<i class="bi bi-',
        suffix: '"></i>',
        tip: 'chat-dots',
        info: 'info-circle',
        success: 'check-circle',
        warning: 'slash-circle',
        alert: 'exclamation-circle',
        confirm: 'check-circle'
    }
});
let lastAlert = null,
    lastWarn = null,
    currentErrorMessage = null,
    offset = 0;

function syncTime(serverTime) {
    // Average between old and new offset
    offset = ((serverTime - Date.now()) + offset) / 2;
}

// Connect to server

let ws;

function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws') + '/quiz?host=true');
}

connect();

let id = null,
    gameState = null,
    secondsRemainingInterval = -1;

// Get element references
let rawGameState = document.getElementById('rawgamestate'),
    loadQuizButton = document.getElementById('loadquiz'),
    progressState = document.getElementById('progressstate'),
    numPlayers = document.getElementById('numplayers'),
    notification = document.getElementById('notification'),
    notifyButton = document.getElementById('notify'),
    removeNotificationButton = document.getElementById('removenotify'),
    notifyPreset = document.getElementById('notifypreset'),
    notifyPresets = document.getElementById('notifypresets'),
    playersTable = document.getElementById('players'),
    reset = document.getElementById('reset'),
    toggleImage = document.getElementById('toggleimage'),
    toggleAllocations = document.getElementById('toggleallocations'),
    quizname = document.getElementById('quizname'),
    questionname = document.getElementById('questionname'),
    optiona = document.getElementById('optiona'),
    optionb = document.getElementById('optionb'),
    optionc = document.getElementById('optionc'),
    optiond = document.getElementById('optiond'),
    optionATotalAllocationThisRound = document.getElementById('optionATotalAllocationThisRound'),
    optionBTotalAllocationThisRound = document.getElementById('optionBTotalAllocationThisRound'),
    optionCTotalAllocationThisRound = document.getElementById('optionCTotalAllocationThisRound'),
    optionDTotalAllocationThisRound = document.getElementById('optionDTotalAllocationThisRound'),
    percentReady = document.getElementById('percentready'),
    lockedInPercent = document.getElementById('lockedinpercent'),
    leaderboard = document.getElementById('leaderboard'),
    numteams = document.getElementById('numteams'),
    stateGameAnswer = document.getElementById('stategameanswer'),
    statePregame = document.getElementById('statepregame'),
    stateScores = document.getElementById('statescores'),
    stateFinish = document.getElementById('statefinish'),
    noQuizLoaded = document.getElementById('noquizloaded'),
    winnersEl = document.getElementById('winners'),
    achievementsEl = document.getElementById('achievements'),
    knockoutsEl = document.getElementById('knockouts'),
    additionalInfo = document.getElementById('additionalinfo');

function kick(theId) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.KICK, { kick: theId }, id);
}

progressState.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.PROGRESS_STATE, {}, id);
});

loadQuizButton.addEventListener('click', () => {
    let input = document.createElement('input');
    input.type = 'file';
    input.onchange = _ => {

        let r = gameState.quizName === null ? true : confirm(`'${gameState.quizName}' is already loaded, are you sure you want to override it?`);
        if (r) {
            let file = Array.from(input.files)[0];

            let formData = new FormData();
            formData.append('quiz', file);

            fetch('/quiz/upload-quiz', {
                method: 'POST',
                body: formData
            });
        }
    };
    input.click();
});

reset.addEventListener('click', () => {
    let r = confirm('Are you sure?');
    if (r) {
        sendMessage(ws, MESSAGE_TYPE.CLIENT.RESET, {}, id);
    }
});

notifyButton.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.NOTIFY, { message: notification.value }, id);
});

removeNotificationButton.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.REMOVE_NOTIFY, {}, id);
});

notifyPreset.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.NOTIFY, { message: notifyPresets.value }, id);
});

toggleImage.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.TOGGLE_IMAGE);
});

toggleAllocations.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.TOGGLE_ALLOCATIONS);
});

/* === Begin Handler functions === */

// Handle a pong from the server
function handlePong(ws, data) {
    if (data.now) {
        syncTime(data.now);
    }
}

function handleConnectionId(ws, data) {
    id = data.id;

    setInterval(() => {
        sendMessage(ws, MESSAGE_TYPE.CLIENT.PING, {}, id);
    }, 5000);
}

// Handle the state of the game changing
function handleStateChange(ws, data) {

    // Sync with server time
    if (data.now) {
        syncTime(data.now);
    }

    gameState = data.state;
    rawGameState.innerHTML = JSON.stringify(gameState, null, 4);
}

function handleErrorMessage(ws, data) {
    if (currentErrorMessage && data.message === currentErrorMessage && !(lastAlert && !lastAlert.parentElement)) {
        // Skip duplicate errors
        return;
    }

    currentErrorMessage = data.message;

    if (lastAlert && lastAlert.parentElement) {
        notifier.container.removeChild(lastAlert);
    }

    lastAlert = notifier.alert(currentErrorMessage, {durations: {alert: 0}});
}

function handleRateLimit(ws, data) {

    if (lastWarn && lastWarn.parentElement) {
        notifier.container.removeChild(lastWarn);
    }

    lastWarn = notifier.warning(data.message, {durations: {warning: data.timeout || 0}});
}

// Register event handlers
ws.onmessage = (msg) => handleMessage(ws, msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: { handler: handlePong },
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: { handler: handleConnectionId },
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: { handler: handleStateChange },
    [MESSAGE_TYPE.SERVER.ERROR_MESSAGE]: { handler: handleErrorMessage },
    [MESSAGE_TYPE.SERVER.RATE_LIMIT]: { handler: handleRateLimit }
}, updateUI);

/* === End Handler Functions === */

function getSecondsLeftInQuestion() {
    const now = Date.now();
    const secondsElapsed = Math.round(((now + offset) - gameState.activeQuestion.timeBegan) / 1000);
    let secondsRemaining = gameState.secondsPerQuestion - secondsElapsed;
    if (secondsRemaining < 0) {
        secondsRemaining = 0;
    }
    return secondsRemaining;
}

function updateAdditionalInfoWithSecondsRemaining() {
    additionalInfo.innerHTML = `${getSecondsLeftInQuestion()}s remaining`;
}

function updateUI() {
    if (gameState === null) {
        return;
    }

    if (gameState.scene === 'pregame') {
        statePregame.hidden = false;
        stateGameAnswer.hidden = true;
        stateScores.hidden = true;
        stateFinish.hidden = true;

        if (gameState.quizName === null) {
            noQuizLoaded.hidden = false;
        } else {
            noQuizLoaded.hidden = true;
        }
    } else if (gameState.scene === 'game' || gameState.scene === 'answer') {
        statePregame.hidden = true;
        stateGameAnswer.hidden = false;
        stateScores.hidden = true;
        stateFinish.hidden = true;
    } else if (gameState.scene === 'scores') {
        statePregame.hidden = true;
        stateGameAnswer.hidden = true;
        stateScores.hidden = false;
        stateFinish.hidden = true;

        knockoutsEl.innerHTML = `£${numberWithCommas(gameState.totalLostThisRound)} lost this round, £${numberWithCommas(gameState.totalGainedThisRound)} gained.`;

        if (gameState.teamsKnockedOutThisRound && gameState.teamsKnockedOutThisRound.length > 0) {
            knockoutsEl.innerHTML += `Lost everything this round: ${JSON.stringify(gameState.teamsKnockedOutThisRound)}`;
        }

    } else if (gameState.scene === 'finish') {
        statePregame.hidden = true;
        stateGameAnswer.hidden = true;
        stateScores.hidden = true;
        stateFinish.hidden = false;

        if (gameState.winners && gameState.winners.length > 1) {
            winnersEl.innerHTML = `There were multiple winners: ${gameState.winners.join(', ')}`;
        } else if (gameState.winners && gameState.winners.length === 1) {
            winnersEl.innerHTML = `Winner: ${gameState.winners[0]}`;
        }

        achievementsEl.innerHTML = `Achievements: ${JSON.stringify(gameState.achievements)}`;
    }

    // Update button states
    if (((gameState.quizName === null || gameState.teams.length === 0) && gameState.scene === 'pregame') || gameState.scene === 'finish') {
        progressState.disabled = true;
    } else {
        progressState.disabled = false;
    }

    if (gameState.scene === 'pregame') {
        progressState.innerHTML = 'Start quiz';
    } else if (gameState.scene === 'game') {
        progressState.innerHTML = 'Show answer';
    } else if (gameState.scene === 'answer') {
        progressState.innerHTML = 'Show scores';
    } else if (gameState.scene === 'scores') {
        progressState.innerHTML = 'Next question';
    } else if (gameState.scene === 'finish') {
        progressState.innerHTML = 'Quiz finished';
    }
    
    if (gameState.showImage) {
        toggleImage.innerHTML = 'Hide image';
    } else {
        toggleImage.innerHTML = 'Show image';
    }

    if (gameState.showAllocations) {
        toggleAllocations.innerHTML = 'Hide allocations';
    } else {
        toggleAllocations.innerHTML = 'Show allocations';
    }

    if (gameState.activeQuestion && gameState.activeQuestion.imageUrl && (gameState.scene === 'game' || gameState.scene === 'answer')) {
        toggleImage.disabled = false;
    } else {
        toggleImage.disabled = true;
    }

    if (gameState.scene !== 'answer') {
        toggleAllocations.disabled = true;
    } else {
        toggleAllocations.disabled = false;
    }

    let inumTeams = gameState.teams.length;
    numteams.innerHTML = inumTeams;
    let inumPlayers = gameState.teams.reduce((p, t) => p + t.members.length, 0);
    let inumPlayersReady = gameState.teams.reduce((p, t) => p.concat(t.members), []).reduce((p, tm) => p + (tm.ready ? 1 : 0), 0);
    let numTeamsLockedIn = gameState.teams.reduce((p ,t) => p + (t.lockedIn ? 1 : 0), 0);

    percentReady.innerHTML = inumPlayersReady;
    additionalInfo.hidden = true;
    if (gameState.scene === 'game' && gameState.secondsPerQuestion) {
        additionalInfo.hidden = false;

        updateAdditionalInfoWithSecondsRemaining();
        if (secondsRemainingInterval === -1) {
            secondsRemainingInterval = setInterval(updateAdditionalInfoWithSecondsRemaining, 1000);
        }
    } else {
        clearInterval(secondsRemainingInterval);
        secondsRemainingInterval = -1;
    }
    
    if (gameState.scene === 'answer') {
        lockedInPercent.innerHTML = `Answer: ${gameState.activeQuestion.answer.toUpperCase()}`;
        additionalInfo.hidden = false;
        additionalInfo.innerHTML = gameState.activeQuestion.additionalText ? gameState.activeQuestion.additionalText : '';
    } else {
        lockedInPercent.innerHTML = `${numTeamsLockedIn} / ${gameState.teams.length} locked in`;
    }

    // Update question info
    if (gameState.quizName) {
        quizname.innerHTML = gameState.quizName;
    } else {
        quizname.innerHTML = 'Quiz';
    }

    if (gameState.activeQuestion) {
        let aAllocated = 0, bAllocated = 0, cAllocated = 0, dAllocated = 0, totalMoneyToSpend = 0;
        for (let team of gameState.teams) {
            aAllocated += team.optionsAllocated.a;
            bAllocated += team.optionsAllocated.b;
            cAllocated += team.optionsAllocated.c;
            dAllocated += team.optionsAllocated.d;
            totalMoneyToSpend += team.remainingMoney;
        }

        questionname.innerHTML = `${gameState.activeQuestionIndex + 1}: ${gameState.activeQuestion.text}`;
        optiona.innerHTML = `A: ${gameState.activeQuestion.options.a}`;
        optionb.innerHTML = `B: ${gameState.activeQuestion.options.b}`;
        optionc.innerHTML = `C: ${gameState.activeQuestion.options.c}`;
        optiond.innerHTML = `D: ${gameState.activeQuestion.options.d}`;
        optionATotalAllocationThisRound.innerHTML = `£${numberWithCommas(aAllocated)} (${Math.round(aAllocated / totalMoneyToSpend * 100)}%)`;
        optionBTotalAllocationThisRound.innerHTML = `£${numberWithCommas(bAllocated)} (${Math.round(bAllocated / totalMoneyToSpend * 100)}%)`;
        optionCTotalAllocationThisRound.innerHTML = `£${numberWithCommas(cAllocated)} (${Math.round(cAllocated / totalMoneyToSpend * 100)}%)`;
        optionDTotalAllocationThisRound.innerHTML = `£${numberWithCommas(dAllocated)} (${Math.round(dAllocated / totalMoneyToSpend * 100)}%)`;
    } else {
        questionname.innerHTML = 'Waiting for next question...';
        optiona.innerHTML = '';
        optionb.innerHTML = '';
        optionc.innerHTML = '';
        optiond.innerHTML = '';
        optionATotalAllocationThisRound.innerHTML = '';
        optionBTotalAllocationThisRound.innerHTML = '';
        optionCTotalAllocationThisRound.innerHTML = '';
        optionDTotalAllocationThisRound.innerHTML = '';
    }

    // Number players
    numPlayers.innerHTML = inumPlayers;

    // Players table
    let playersTableHTML = '<tr><th>Name</th><th>Team</th><th>Solo</th><th>Ready</th><th>Control</th></tr>';

    for (let team of gameState.teams.sort((a,b) => a.teamName.localeCompare(b.teamName))) {
        for (let tm of team.members) {
            playersTableHTML += `<tr><td>${tm.name}</td><td>${team.teamName}</td><td>${team.solo ? '<span class="bi bi-check-circle"/>' : ''}</td><td>${tm.ready ? '<span class="bi bi-check-circle"/>' : ''}</td><td><button class="kick btn btn-danger w-100 btn-sm" data-id="${tm.id}" data-name="${tm.name}">Kick</button></td>`
        }
    }

    let numTeamsWithActiveHints = gameState.teams.reduce((p, t) => p + (t.activeHint ? 1 : 0), 0);
    let leaderboardHTML = `<tr><th>Name</th><th>Score</th><th>Locked In (${numTeamsLockedIn})</th><th>Hints Remaining</th><th>Active Hints (${numTeamsWithActiveHints})</th></tr>`;
    for (let team of gameState.teams.sort((a, b) => b.remainingMoney - a.remainingMoney)) {
        leaderboardHTML += `<tr><td>${team.teamName}</td><td>£${numberWithCommas(team.score)}</td><td>${team.lockedIn ? '<span class="bi bi-check-circle"/>' : ''}</td><td>${team.remainingHints}</td><td>${team.activeHint ? JSON.stringify(team.activeHint.sort((a,b) => a.localeCompare(b))) : ''}</td></tr>`;
    }
    leaderboard.innerHTML = leaderboardHTML;

    playersTable.innerHTML = playersTableHTML;

    let kickButtons = document.getElementsByClassName('kick');
    for (let b of kickButtons) {
        b.addEventListener('click', () => {
            let playerId = b.getAttribute('data-id');
            let playerName = b.getAttribute('data-name');
            let r = confirm(`Are you sure you want to kick '${playerName}'?`);
            if (r) {
                kick(playerId);
            }
        });
    }
};

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
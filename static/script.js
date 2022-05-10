import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage, REACTIONS, MAX_TEAM_SIZE, interpolateColour, ACHIEVEMENT_DATA, LOG_TYPE } from './shared.js';

// Connect to server

let ws;

function connect() {
    id = JSON.parse(window.localStorage.getItem('id'));

    if (id !== null) {
        ws = new WebSocket(location.origin.replace(/^http/, 'ws') + `/quiz?id=${id.id}`);
    } else {
        ws = new WebSocket(location.origin.replace(/^http/, 'ws') + '/quiz');
    }
}

connect();

// Constants
const ERROR_TIMEOUT_MS = 3000;

// Get elements
var pregameContainer = document.getElementById('pregame'),
    gameContainer = document.getElementById('game'),
    errorMessage = document.getElementById('errormessage'),
    notification = document.getElementById('notification'),
    inProgMessage = document.getElementById('inprogmessage'),
    inProgJoinTeam = document.getElementById('inprogjointeam'),
    inProgNoTeam  = document.getElementById('inprognoteam'),
    quizName = document.getElementById('quizname'),
    // teamName = document.getElementById('teamname'),
    questionNumber = document.getElementById('questionnumber'),
    questionText = document.getElementById('questiontext'),
    remaining = document.getElementById('remaining'),
    allocatedA = document.getElementById('allocateda'),
    allocatedB = document.getElementById('allocatedb'),
    allocatedC = document.getElementById('allocatedc'),
    allocatedD = document.getElementById('allocatedd'),
    optionA = document.getElementById('optiona'),
    optionB = document.getElementById('optionb'),
    optionC = document.getElementById('optionc'),
    optionD = document.getElementById('optiond'),
    minusA = document.getElementById('minusa'),
    addA = document.getElementById('adda'),
    minusB = document.getElementById('minusb'),
    addB = document.getElementById('addb'),
    minusC = document.getElementById('minusc'),
    addC = document.getElementById('addc'),
    minusD = document.getElementById('minusd'),
    addD = document.getElementById('addd'),
    addRemainingA = document.getElementById('addremaininga'),
    addRemainingB = document.getElementById('addremainingb'),
    addRemainingC = document.getElementById('addremainingc'),
    addRemainingD = document.getElementById('addremainingd'),
    removeAllA = document.getElementById('removealla'),
    removeAllB = document.getElementById('removeallb'),
    removeAllC = document.getElementById('removeallc'),
    removeAllD = document.getElementById('removealld'),
    reset = document.getElementById('reset'),
    lockIn = document.getElementById('lockin'),
    help = document.getElementById('help'),
    joinSoloButton = document.getElementById('joinsolo'),
    createTeamButton = document.getElementById('createteam'),
    teamsTitle = document.getElementById('teamstitle'),
    teams = document.getElementById('teams'),
    solosTitle = document.getElementById('solostitle'),
    solos = document.getElementById('solos'),
    soloPlayerCount = document.getElementById('soloplayercount'),
    teamCount = document.getElementById('teamcount'),
    pregameStatusWidget = document.getElementById('pregamestatuswidget'),
    pregameStatusWidgetReady = document.getElementById('pregamestatuswidgetready'),
    pregameStatusWidgetName = document.getElementById('pregamestatuswidgetname'),
    pregameStatusWidgetSolo = document.getElementById('pregamestatuswidgetsolo'),
    pregameStatusWidgetTeam = document.getElementById('pregamestatuswidgetteam'),
    pregameStatusWidgetReadyButton = document.getElementById('pregamestatuswidgetreadybutton'),
    pregameStatusWidgetLeave = document.getElementById('pregamestatuswidgetleave'),
    inputGroup = document.getElementById('inputgroup'),
    thenText = document.getElementById('thentext'),
    enterNamePrompt = document.getElementById('enternameprompt'),
    enterTeamNamePrompt = document.getElementById('enterteamnameprompt'),
    scores = document.getElementById('scores'),
    scoresTable = document.getElementById('scorestable'),
    answer = document.getElementById('answer'),
    answerText = document.getElementById('answertext'),
    remainingAfter = document.getElementById('remainingafter'),
    finish = document.getElementById('finish'),
    winnerText = document.getElementById('winnertext'),
    log = document.getElementById('log'),
    // teamMembers = document.getElementById('teammembers'),
    chatMessage = document.getElementById('chatmessage'),
    sendChatMessage = document.getElementById('sendchatmessage'),
    laughReactButton = document.getElementById('laugh'),
    cryReactButton = document.getElementById('cry'),
    shockReactButton = document.getElementById('shock'),
    loveReactButton = document.getElementById('love'),
    laughReactButton2 = document.getElementById('laugh2'),
    cryReactButton2 = document.getElementById('cry2'),
    shockReactButton2 = document.getElementById('shock2'),
    loveReactButton2 = document.getElementById('love2'),
    laughReactButton3 = document.getElementById('laugh3'),
    cryReactButton3 = document.getElementById('cry3'),
    shockReactButton3 = document.getElementById('shock3'),
    loveReactButton3 = document.getElementById('love3'),
    preImage = document.getElementById('preimage'),
    postImage = document.getElementById('postimage'),
    useHintButton = document.getElementById('usehint'),
    numHintsRemaining = document.getElementById('numhintsremaining'),
    showPreImageButton = document.getElementById('showpreimage'),
    optionABox = document.getElementById('optionabox'),
    optionBBox = document.getElementById('optionbbox'),
    optionCBox = document.getElementById('optioncbox'),
    optionDBox = document.getElementById('optiondbox'),
    timerBar = document.getElementById('timerbar'),
    infoModal = document.getElementById('infomodal'),
    infoModalClose = document.getElementById('infomodalclose'),
    infoModalOpen = document.getElementById('infomodalopen'),
    achievementsEl = document.getElementById('achievements'),
    logHint = document.getElementById('loghint');

function updateJoinButtons() {
    const playerName = document.getElementById('name').value;
    const teamName = document.getElementById('team').value;

    const playerNameValid = !(!playerName || /^\s*$/.test(playerName));
    const teamNameValid = !(!teamName || /^\s*$/.test(teamName));

    let didMatchAny = false;
    for (const team of gameState.teams) {
        if (teamName === team.teamName) {
            didMatchAny = true;
        }
    }
    if (didMatchAny) {
        createTeamButton.innerHTML = '<i class="bi bi-people"></i> Join existing team';
    } else {
        createTeamButton.innerHTML = '<i class="bi bi-people"></i> Create team';
    }

    if (playerNameValid) {
        joinSoloButton.disabled = false;
    } else {
        joinSoloButton.disabled = true;
    }

    if (playerName && teamNameValid) {
        createTeamButton.disabled = false;
    } else {
        createTeamButton.disabled = true;
    }

    for (const el of document.getElementsByClassName('teambutton')) {
        el.disabled = !playerNameValid;
    }
}

// Register event listeners
joinSoloButton.addEventListener('click', () => { joinGameSolo(); });
document.getElementById('name').addEventListener('input', updateJoinButtons);
createTeamButton.addEventListener('click', () => createTeam());
document.getElementById('team').addEventListener('input', updateJoinButtons);
pregameStatusWidgetLeave.addEventListener('click', () => leaveTeam());
pregameStatusWidgetReadyButton.addEventListener('click', () => toggleReady());

minusA.addEventListener('click', () => minusOption('a'));
addA.addEventListener('click', () => addOption('a'));
minusB.addEventListener('click', () => minusOption('b'));
addB.addEventListener('click', () => addOption('b'));
minusC.addEventListener('click', () => minusOption('c'));
addC.addEventListener('click', () => addOption('c'));
minusD.addEventListener('click', () => minusOption('d'));
addD.addEventListener('click', () => addOption('d'));

reset.addEventListener('click', () => resetState());
lockIn.addEventListener('click', () => {

    let r = confirm('Are you sure you want to lock in?');
    if (r) {
        setLockedIn();
    }    
});

addRemainingA.addEventListener('click', () => addRemaining('a'));
addRemainingB.addEventListener('click', () => addRemaining('b'));
addRemainingC.addEventListener('click', () => addRemaining('c'));
addRemainingD.addEventListener('click', () => addRemaining('d'));

removeAllA.addEventListener('click', () => removeAll('a'));
removeAllB.addEventListener('click', () => removeAll('b'));
removeAllC.addEventListener('click', () => removeAll('c'));
removeAllD.addEventListener('click', () => removeAll('d'));

laughReactButton.addEventListener('click', () => sendReaction(REACTIONS.LAUGH));
cryReactButton.addEventListener('click', () => sendReaction(REACTIONS.CRY));
shockReactButton.addEventListener('click', () => sendReaction(REACTIONS.SHOCK));
loveReactButton.addEventListener('click', () => sendReaction(REACTIONS.LOVE));
laughReactButton2.addEventListener('click', () => sendReaction(REACTIONS.LAUGH));
cryReactButton2.addEventListener('click', () => sendReaction(REACTIONS.CRY));
shockReactButton2.addEventListener('click', () => sendReaction(REACTIONS.SHOCK));
loveReactButton2.addEventListener('click', () => sendReaction(REACTIONS.LOVE));
laughReactButton3.addEventListener('click', () => sendReaction(REACTIONS.LAUGH));
cryReactButton3.addEventListener('click', () => sendReaction(REACTIONS.CRY));
shockReactButton3.addEventListener('click', () => sendReaction(REACTIONS.SHOCK));
loveReactButton3.addEventListener('click', () => sendReaction(REACTIONS.LOVE));

showPreImageButton.addEventListener('click', () => {
    showPreImage = !showPreImage;
    showPreImageButton.innerHTML = showPreImage ? '<i class="bi bi-image-alt"></i> Hide image' : '<i class="bi bi-image"></i> Show image';
    updateUI();
});

sendChatMessage.addEventListener('click', () => {
    const msg = chatMessage.value;
    if (!msg || /^\s*$/.test(msg)) {
        return;
    }
    sendMessage(ws, MESSAGE_TYPE.CLIENT.TEAM_CHAT, { message: msg }, id);
    // Clear the textbox after sending
    chatMessage.value = '';
});

chatMessage.addEventListener('keyup', (e) => {
    const msg = chatMessage.value;
    const isEmpty = !msg || /^\s*$/.test(msg);

    if (isEmpty) {
        sendChatMessage.disabled = true;
        return;
    } else {
        sendChatMessage.disabled = false;
    }

    if (e.key === 'Enter') {        
        sendMessage(ws, MESSAGE_TYPE.CLIENT.TEAM_CHAT, { message: msg }, id);
        // Clear the textbox after sending
        chatMessage.value = '';
        sendChatMessage.disabled = true;
    }
});

useHintButton.addEventListener('click', () => {
    let r = confirm('Are you sure you want to use a hint?');
    if (r) {
        sendMessage(ws, MESSAGE_TYPE.CLIENT.USE_HINT, {}, id); 
    }
});

infoModalClose.addEventListener('click', () => {
    infoModal.hidden = true;
});

infoModalOpen.addEventListener('click', () => {
    infoModal.hidden = false;
});

// Game State
var id = null,
    team = null,
    playerName = null,
    ready = false,
    solo = null,
    gameState = {
        scene: GAME_STATE.PREGAME,
        init: true
    },
    currentErrorMessage = null,
    currentErrorMessageTimeout = null,
    currentNotification = null,
    showPreImage = false;

let timerBarInterval = -1;

/* === Begin Handler functions === */

// Handle a pong from the server
function handlePong() {
    console.log('Received pong');
}

// Handle receiving an Id
function handleConnectionId(data) {
    id = data;

    window.localStorage.setItem('id', JSON.stringify(id));
}

// Handle the state of the game changing
function handleStateChange(data) {

    if (gameState.scene === GAME_STATE.SCORES && data.state.scene === GAME_STATE.GAME) {
        while (log.firstChild !== log.lastChild) {
            log.removeChild(log.firstChild);
        }
    }
    
    gameState = data.state;
    team = assertTeam();
}

function handleAcknowledgeName(data) {
    playerName = data.name;
    solo = data.solo ? true : false;
}

function handleAcknowledgeReady(data) {
    ready = data.ready;
}

function handleReset() {
    playerName = null;
    team = null;
    solo = null;
    ready = false;
    while (log.firstChild !== log.lastChild) {
        log.removeChild(log.firstChild);
    }
    currentErrorMessage = '';
    currentErrorMessageTimeout = null;
    currentNotification = null;
}

function handleErrorMessage(data) {
    currentErrorMessage = data.message;
    errorMessage.innerHTML = currentErrorMessage;
    errorMessage.hidden = false;

    if (currentErrorMessageTimeout !== null) {
        clearTimeout(currentErrorMessageTimeout);
    }

    currentErrorMessageTimeout = setTimeout(() => {
        errorMessage.hidden = true;
        currentErrorMessageTimeout = null;
    }, ERROR_TIMEOUT_MS);
}

function handleNotify(data) {
    currentNotification = data.message;
    notification.innerHTML = currentNotification;
    notification.hidden = false;
}

function handleRemoveNotify() {
    currentNotification = null;
    notification.innerHTML = '';
    notification.hidden = true;
}

function handleChatMessage(data) {
    // log.innerHTML = `${data.name} said: ${data.message}\n` + log.innerHTML;

    addMessageToLog(LOG_TYPE.CHAT, `${data.name}: `, data.message);
}

function handleLog(data) {
    
    const _team = getTeamByName(team);

    let p = null;
    for (let tm of _team.members) {
        if (tm.id === data.id) {
            p = tm.name;
        }
    }

    if (p === null) {
        return;
    }

    let logText;
    if (data.type === 'add') {
        logText = `added money to option ${data.option}`;
    } else if (data.type === 'minus') {
        logText = `subtracted money from option ${data.option}`;
    } else if (data.type === 'resetAllocation') {
        logText = `reset all money allocations`;
    } else if (data.type === 'lock') {
        logText = `locked us in`;
    }

    // log.innerHTML = logText + '\n' + log.innerHTML;
    addMessageToLog(data.type, `${p}`, logText);
}

function addMessageToLog(logType, subject, message) {
    let icon = 'bi-chat';
    if (logType === LOG_TYPE.ADD || logType === LOG_TYPE.MINUS) {
        icon = 'bi-piggy-bank';
    } else if (logType === LOG_TYPE.RESET) {
        icon = 'bi-arrow-clockwise';
    } else if (logType === LOG_TYPE.LOCK) {
        icon = 'bi-lock';
    }

    log.innerHTML = `<div class="logmessage ${logType}">
        <i class="bi ${icon}"></i> <span class="logmessagesubject">${subject} </span>${message}
    </div>` + log.innerHTML;
}

function getTeamByName(teamName) {
    for (let team of gameState.teams) {
        if (team.teamName === teamName) {
            return team;
        }
    }

    console.error('Attempted to find a non-existent team!');
}

// Register event handlers
ws.onmessage = (msg) => handleMessage(ws, msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: { handler: handlePong },
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: { handler: handleConnectionId },
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: { handler: handleStateChange },
    [MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME]: { handler: handleAcknowledgeName },
    [MESSAGE_TYPE.SERVER.ACKNOWLEDGE_READY]: { handler: handleAcknowledgeReady },
    [MESSAGE_TYPE.SERVER.RESET]: { handler: handleReset },
    [MESSAGE_TYPE.SERVER.LOG]: { handler: handleLog },
    [MESSAGE_TYPE.SERVER.ERROR_MESSAGE]: { handler: handleErrorMessage },
    [MESSAGE_TYPE.SERVER.NOTIFY]: { handler: handleNotify },
    [MESSAGE_TYPE.SERVER.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
    [MESSAGE_TYPE.SERVER.TEAM_CHAT]: { handler: handleChatMessage }
}, updateUI);

/* === End Handler Functions === */

/* === Begin Sender functions === */

function joinGameSolo() {
    // TODO: Check for null/empty values
    let playerName = document.getElementById('name').value;
    console.log(`Joining as solo player ${playerName}`);
    
    sendMessage(ws, MESSAGE_TYPE.CLIENT.JOIN_SOLO, { as: playerName }, id);
}

function createTeam() {
    // TODO: Check for null/empty values
    let playerName = document.getElementById('name').value;
    let teamName = document.getElementById('team').value;
    console.log(`Creating a team ${teamName} as ${playerName}`);

    sendMessage(ws, MESSAGE_TYPE.CLIENT.CREATE_TEAM, { as: playerName, team: teamName }, id);
}

function joinTeam(teamName) {
    // TODO: Check for null/empty values
    let playerName = document.getElementById('name').value;
    console.log(`Joining team ${teamName} as ${playerName}`);

    sendMessage(ws, MESSAGE_TYPE.CLIENT.JOIN_TEAM, { as: playerName, team: teamName }, id);
}

function toggleReady() {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.TOGGLE_READY, { ready: !ready }, id);
}

function leaveTeam() {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.LEAVE_TEAM, { as: playerName, team: team }, id);
}

function setLockedIn() {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.LOCK_IN, { team: team }, id);
}

function resetState() {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.RESET_ALLOCATION, { team: team }, id);
}

function addOption(optionChar) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.ADD_OPTION, { team: team, option: optionChar }, id);
}

function minusOption(optionChar) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.MINUS_OPTION, { team: team, option: optionChar }, id);
}

function addRemaining(optionChar) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.ADD_REMAINING, { team: team, option: optionChar }, id);
}

function removeAll(optionChar) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.REMOVE_ALL, { team: team, option: optionChar }, id);
}

function sendReaction(reaction) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.EMOTE, { emote: reaction });
}

/* === End Sender Functions === */

function getTimerBarWidth() {
    const now = Date.now();
    const secondsElapsed = (now - gameState.activeQuestion.timeBegan) / 1000;
    let percentOfLimit = 100 - ((secondsElapsed / gameState.secondsPerQuestion) * 100);
    if (percentOfLimit < 0) {
        percentOfLimit = 0;
    }
    return percentOfLimit;
}

function updateTimerBar() {
    const percentageRemaining = getTimerBarWidth();
    timerBar.style.width = `${percentageRemaining}%`;
    timerBar.style.backgroundColor = interpolateColour('rgb(234, 60, 59)', 'rgb(0, 152, 121)', percentageRemaining / 100);
}

function updateUI() {

    if (gameState.init) {
        return;
    }
    
    if (!currentErrorMessageTimeout) {
        errorMessage.hidden = true;
    }
    
    if (currentNotification === null) {
        notification.hidden = true;
    }

    if (gameState.scene === 'pregame' || playerName === null) {
        
        pregameContainer.hidden = false;
        gameContainer.hidden = true;
        answer.hidden = true;
        scores.hidden = true;
        finish.hidden = true;
        timerBar.hidden = true;
        clearInterval(timerBarInterval);
        timerBarInterval = -1;
        
        if (gameState.quizName) {
            quizName.innerHTML = gameState.quizName;
        }

        if (playerName !== null) {
            document.getElementById('name').hidden = true;
            document.getElementById('team').hidden = true;
            joinSoloButton.hidden = true;
            createTeamButton.hidden = true;
            pregameStatusWidgetReady.innerHTML = ready ? 'Ready' : 'Waiting';
            pregameStatusWidgetName.innerHTML = playerName;
            pregameStatusWidgetSolo.innerHTML = solo ? 'solo ' : '';
            pregameStatusWidgetTeam.innerHTML = team;
            pregameStatusWidget.hidden = false;
            inputGroup.style.display = 'none';
            thenText.hidden = true;
            enterNamePrompt.hidden = true;
            enterTeamNamePrompt.hidden = true;
            pregameStatusWidgetReadyButton.innerHTML = ready ? '<i class="bi bi-x-circle"></i> I\'m not ready' : '<i class="bi bi-check-circle"></i> I\'m ready';
        } else {
            document.getElementById('name').hidden = false;
            document.getElementById('team').hidden = false;
            pregameStatusWidget.hidden = true;

            if (gameState.scene === GAME_STATE.PREGAME) {
                inputGroup.style.display = 'grid';
                thenText.hidden = false;
                joinSoloButton.hidden = false;
                createTeamButton.hidden = false;
                enterTeamNamePrompt.hidden = false;
            } else {
                inputGroup.style.display = 'none';
                thenText.hidden = true;
                joinSoloButton.hidden = true;
                createTeamButton.hidden = true;
                enterTeamNamePrompt.hidden = true;
            }

            enterNamePrompt.hidden = false;
        }

        let solosHTML = '';
        let numSolos = 0;
        let teamsHTML = '';
        let numTeams = 0;
        let wasTeamAvailableToJoin = false;
        for (let _team of gameState.teams) {
            if (_team.solo) {
                solosHTML += `<tr class="${_team.teamName === team ? 'active-row' : ''}"><td>${_team.teamName}</td><td>${_team.members[0].ready ? 'Ready' : 'Not ready'}</td></tr></tr>`;
                numSolos++;
            } else {
                wasTeamAvailableToJoin |= _team.members.length !== MAX_TEAM_SIZE;
                let joinButtonHTML = _team.members.length !== MAX_TEAM_SIZE ? `<button class="teambutton" data-team="${_team.teamName}"><i class="bi bi-people"></i> Join Team</button>` : '';
                let leaveButtonHTML = '<button class="leavebutton"><i class="bi bi-box-arrow-left"></i> Leave Team</button>';
                let membersHTML = '';
                let isAlreadyInTeam = false;
                for (let tm of _team.members) {
                    if (tm.name === playerName) {
                        isAlreadyInTeam = true;
                    }
                    membersHTML += `<tr class="${tm.name === playerName ? 'active-row' : ''}"><td>${tm.name}</td><td>${tm.ready ? 'Ready' : 'Not ready'}</td></tr>`;
                }
                
                teamsHTML += `<table class="styledtable"><thead><tr><th>${`${_team.teamName} (${_team.members.length}/${MAX_TEAM_SIZE})`}</th><th>${isAlreadyInTeam ? leaveButtonHTML : joinButtonHTML}</th></tr></thead><tbody>${membersHTML}</tbody>`;
                teamsHTML += `</table>`;
                numTeams++;
            }
        }
        solos.innerHTML = solosHTML;
        teams.innerHTML = teamsHTML;

        soloPlayerCount.innerHTML = numSolos;
        teamCount.innerHTML = numTeams;

        for (let element of document.getElementsByClassName('teambutton')) {
            
            const teamName = element.getAttribute('data-team');
            
            if (teamName) {
                element.addEventListener('click', () => joinTeam(teamName));
            }
        }

        updateJoinButtons();

        for (let element of document.getElementsByClassName('leavebutton')) {
            element.addEventListener('click', () => leaveTeam());
        }

        if (numSolos === 0) {
            solosTitle.hidden = true;
        } else {
            solosTitle.hidden = false;
        }

        if (numTeams === 0) {
            teamsTitle.hidden = true;
        } else {
            teamsTitle.hidden = false;
        }

        solos.hidden = false;

        // Late joins
        if (!playerName && gameState.scene !== GAME_STATE.PREGAME) {
            inProgMessage.hidden = false;
            solos.hidden = true;
            solosTitle.hidden = true;
            if (wasTeamAvailableToJoin) {
                inProgJoinTeam.hidden = false;
                inProgNoTeam.hidden = true;
            } else {
                inProgJoinTeam.hidden = true;
                inProgNoTeam.hidden = false;
                enterNamePrompt.hidden = true;
                document.getElementById('name').hidden = true;
            }
        } else {
            inProgMessage.hidden = true;
        }
    } else if (gameState.scene === 'game') {
        let _team = getTeamByName(team);

        pregameContainer.hidden = true;
        gameContainer.hidden = false;
        finish.hidden = true;
        answer.hidden = true;
        scores.hidden = true;
        log.hidden = chatMessage.hidden = sendChatMessage.hidden = solo || _team.members.length === 1;
        timerBar.hidden = false;

        if (timerBarInterval === -1 && getTimerBarWidth() !== 0) {
            updateTimerBar();
            timerBarInterval = setInterval(updateTimerBar, 1000);
        }
        if (timerBarInterval !== -1 && getTimerBarWidth() === 0) {
            clearInterval(timerBarInterval);
            timerBarInterval = -1;
        }

        if (gameState.activeQuestion.imageUrl) {
            // showPreImageButton.hidden = false;
            showPreImageButton.hidden = true; // DISABLE PRE-IMAGE BUTTON FOR NOW
            preImage.src = gameState.activeQuestion.imageUrl;

            if (showPreImage) {
                preImage.hidden = false;
            } else {
                preImage.hidden = true;
            }
        } else {
            showPreImageButton.hidden = true;
            preImage.hidden = true;
        }

        // teamName.innerHTML = _team.teamName;
        
        questionNumber.innerHTML = gameState.activeQuestionIndex + 1;
        questionText.innerHTML = gameState.activeQuestion.text;

        // let teamMembersHTML = '';
        // for (let tm of _team.members) {
        //     teamMembersHTML += `<li>${tm.name}</li>`;
        // }
        // teamMembers.innerHTML = teamMembersHTML;

        logHint.innerHTML = `Playing as team '${_team.teamName}' with ${_team.members.map(tm => tm.name).join(', ')}. Messages will appear below...`;

        remaining.innerHTML = numberWithCommas(moneyRemainingThisTurn());

        optionA.innerHTML = gameState.activeQuestion.options.a;
        optionB.innerHTML = gameState.activeQuestion.options.b;
        optionC.innerHTML = gameState.activeQuestion.options.c;
        optionD.innerHTML = gameState.activeQuestion.options.d;

        allocatedA.innerHTML = numberWithCommas(_team.optionsAllocated['a']);
        allocatedB.innerHTML = numberWithCommas(_team.optionsAllocated['b']);
        allocatedC.innerHTML = numberWithCommas(_team.optionsAllocated['c']);
        allocatedD.innerHTML = numberWithCommas(_team.optionsAllocated['d']);

        removeAllA.disabled = _team.optionsAllocated['a'] === 0;
        removeAllB.disabled = _team.optionsAllocated['b'] === 0;
        removeAllC.disabled = _team.optionsAllocated['c'] === 0;
        removeAllD.disabled = _team.optionsAllocated['d'] === 0;

        let mrtt = moneyRemainingThisTurn();

        if (mrtt === _team.remainingMoney) {
            if (!_team.lockedIn) {
                help.innerHTML = 'You haven\'t allocated any money yet!<br/>';
            } else {
                help.innerHTML = '';
            }
        } else  if (mrtt !== _team.remainingMoney) {
            help.innerHTML = '';
        }
        
        if (gameState.secondsPerQuestion && getTimerBarWidth() < 40 && !_team.lockedIn) {
            help.innerHTML += 'Heads up, you\'re running out of time';
        }

        if (mrtt === 0) {
            addA.disabled = true;
            addB.disabled = true;
            addC.disabled = true;
            addD.disabled = true;
            addRemainingA.disabled = true;
            addRemainingB.disabled = true;
            addRemainingC.disabled = true;
            addRemainingD.disabled = true;
        } else {
            addA.disabled = false;
            addB.disabled = false;
            addC.disabled = false;
            addD.disabled = false;
            addRemainingA.disabled = false;
            addRemainingB.disabled = false;
            addRemainingC.disabled = false;
            addRemainingD.disabled = false;
        }

        minusA.disabled = _team.optionsAllocated['a'] === 0;
        minusB.disabled = _team.optionsAllocated['b'] === 0;
        minusC.disabled = _team.optionsAllocated['c'] === 0;
        minusD.disabled = _team.optionsAllocated['d'] === 0;

        reset.disabled = mrtt === _team.remainingMoney;
        lockIn.disabled = false;

        if (_team.lockedIn) {
            addA.disabled = true;
            addB.disabled = true;
            addC.disabled = true;
            addD.disabled = true;
            minusA.disabled = true;
            minusB.disabled = true;
            minusC.disabled = true;
            minusD.disabled = true;
            addRemainingA.disabled = true;
            addRemainingB.disabled = true;
            addRemainingC.disabled = true;
            addRemainingD.disabled = true;
            reset.disabled = true;
            lockIn.disabled = true;
            
            if (mrtt === _team.remainingMoney) {
                help.innerHTML = 'You skipped this question.';
            } else {
                help.innerHTML = 'You\'re locked in!';
            }
        }

        if (gameState.allowHints) {
            useHintButton.hidden = false;
            numHintsRemaining.innerHTML = _team.remainingHints;

            if (_team.remainingHints && _team.activeHint === null && !_team.lockedIn) {
                useHintButton.disabled = false;
            } else {
                useHintButton.disabled = true;
            }

            optionABox.classList = 'option';
            optionBBox.classList = 'option';
            optionCBox.classList = 'option';
            optionDBox.classList = 'option';

            if (_team.activeHint) {
                for (let hint of _team.activeHint) {
                    if (hint === 'a') {
                        optionABox.classList = 'option wrong';
                        addA.disabled = true;
                        minusA.disabled = true;
                        addRemainingA.disabled = true;
                        removeAllA.disabled = true;
                    }
                    if (hint === 'b') {
                        optionBBox.classList = 'option wrong';
                        addB.disabled = true;
                        minusB.disabled = true;
                        addRemainingB.disabled = true;
                        removeAllB.disabled = true;
                    }
                    if (hint === 'c') {
                        optionCBox.classList = 'option wrong';
                        addC.disabled = true;
                        minusC.disabled = true;
                        addRemainingC.disabled = true;
                        removeAllC.disabled = true;
                    }
                    if (hint === 'd') {
                        optionDBox.classList = 'option wrong';
                        addD.disabled = true;
                        minusD.disabled = true;
                        addRemainingD.disabled = true;
                        removeAllD.disabled = true;
                    }
                }
            }
        } else {
            useHintButton.hidden = true;
        }
    } else if (gameState.scene === 'answer') {
        let _team = getTeamByName(team);

        pregameContainer.hidden = true;
        gameContainer.hidden = true;
        finish.hidden = true;
        answer.hidden = false;
        scores.hidden = true;
        timerBar.hidden = true;
        clearInterval(timerBarInterval);
        timerBarInterval = -1;

        if (gameState.activeQuestion.imageUrl) {
            postImage.hidden = false;
            postImage.src = gameState.activeQuestion.imageUrl;
        } else {
            postImage.hidden = true;
        }

        answerText.innerHTML = gameState.activeQuestion.answer.toUpperCase() + ": " + gameState.activeQuestion.options[gameState.activeQuestion.answer];
        remainingAfter.innerHTML = numberWithCommas(_team.remainingMoney);
    } else if (gameState.scene === 'scores') {
        pregameContainer.hidden = true;
        gameContainer.hidden = true;
        answer.hidden = true;
        scores.hidden = false;
        finish.hidden = true;
        timerBar.hidden = true;
        clearInterval(timerBarInterval);
        timerBarInterval = -1;

        let scoresTableHtml = '<thead><tr><th></th><th>Team</th><th>Money</th><th>Change</th><th></th></tr></thead><tbody>';
        gameState.teams.sort((a, b) => b.remainingMoney - a.remainingMoney);
        for (let i = 0; i < gameState.teams.length; i++) {
            let scoreDidChange = gameState.teams[i].lastChange !== 0;
            let changeIconHtml = '';
            let changeAmountHtml = '-';
            let changeClass = '';
            if (scoreDidChange) {
                // let largeChange = Math.abs(gameState.teams[i].lastChange) > gameState.teams[i].lastMoney / 2;
                const placesMoved = gameState.teams[i].placesMoved;
                const largeChange = Math.abs(placesMoved) > 4;
                
                if (placesMoved < 0) {
                    changeIconHtml = `<i class="bi bi-chevron${largeChange ? '-double' : ''}-down red"></i>`;
                } else if (placesMoved > 0) {
                    changeIconHtml = `<i class="bi bi-chevron${largeChange ? '-double' : ''}-up green"></i>`;
                }

                if (gameState.teams[i].lastChange < 0) {
                    changeClass = 'red';
                    changeAmountHtml = `-£${numberWithCommas(Math.abs(gameState.teams[i].lastChange))}`;
                } else {
                    changeClass = 'green';
                    changeAmountHtml = `+£${numberWithCommas(gameState.teams[i].lastChange)}`;
                }
            }

            let fastestFingerIconHtml = '';
            if (gameState.teams[i].teamName === gameState.fastestTeam) {
                fastestFingerIconHtml = '<i class="bi bi-lightning-charge red" title="Clumsiest thumbs"></i>';
            }
            if (gameState.teams[i].teamName === gameState.fastestTeamCorrect) {
                fastestFingerIconHtml = '<i class="bi bi-lightning-charge green" title="Fastest fingers"></i>';
            }
            scoresTableHtml += `<tr class="${gameState.teams[i].remainingMoney === 0 ? 'eliminated' : ''}"><td>${changeIconHtml} ${i + 1}</td><td>${gameState.teams[i].teamName}</td><td>£${numberWithCommas(gameState.teams[i].remainingMoney)}</td><td class="${changeClass}">${changeAmountHtml}</td><td>${gameState.teams[i].activeHint !== null ? '<i class="bi bi-lightbulb" title="Used hint"></i>': ''}${gameState.teams[i].lastAllIn ? '<i class="bi bi-exclamation-triangle" title="All in"></i>': ''}${fastestFingerIconHtml}</td></tr>`;
        }
        scoresTableHtml += '</tbody>';
        scoresTable.innerHTML = scoresTableHtml;
    } else if (gameState.scene === 'finish') {
        pregameContainer.hidden = true;
        gameContainer.hidden = true;
        answer.hidden = true;
        scores.hidden = true;
        finish.hidden = false;
        timerBar.hidden = true;
        clearInterval(timerBarInterval);
        timerBarInterval = -1;

        if (gameState.winners.length === 0) {
            winnerText.innerHTML = 'Nobody won x-(';
        } else if (gameState.winners.length > 1) {
            winnerText.innerHTML = 'You were one of multiple winners!';
        } else {
            winnerText.innerHTML = gameState.winners[0] === team ? 'You won!' : 'You lost!';
        }

        let _team = getTeamByName(team);
        achievementsEl.innerHTML = '';
        for (const achievement of _team.achievements) {
            achievementsEl.innerHTML += `<div><img src="${ACHIEVEMENT_DATA[achievement].imagePath}" /><p>${ACHIEVEMENT_DATA[achievement].title}</p><p>${ACHIEVEMENT_DATA[achievement].description}</p></div>`;
        }
    }
}

function assertTeam() {
    for (let team of gameState.teams) {
        for (let tm of team.members) {
            if (tm.id === id.id) {
                return team.teamName;
            }
        }
    }
}

// Utility method for money remaining per turn
function moneyRemainingThisTurn() {
    const _team = getTeamByName(team);

    return _team.remainingMoney
        - (_team.optionsAllocated.a
            + _team.optionsAllocated.b
            + _team.optionsAllocated.c
            + _team.optionsAllocated.d);
}

setInterval(() => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.PING, {}, id, (reason) => handleErrorMessage({ message: reason }));
}, 5000);

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage } from './shared.js';

// Connect to server

let ws;

function connect() {
    id = JSON.parse(window.localStorage.getItem('id'));

    if (id !== null) {
        ws = new WebSocket(location.origin.replace(/^http/, 'ws') + `?id=${id.id}`);
    } else {
        ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
    }
}

connect();

// Constants
const ERROR_TIMEOUT_MS = 5000;

// Get elements
var pregameContainer = document.getElementById('pregame'),
    gameContainer = document.getElementById('game'),
    errorMessage = document.getElementById('errormessage'),
    teamName = document.getElementById('teamname'),
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
    pregameStatusWidgetName = document.getElementById('pregamestatuswidgetname'),
    pregameStatusWidgetSolo = document.getElementById('pregamestatuswidgetsolo'),
    pregameStatusWidgetTeam = document.getElementById('pregamestatuswidgetteam'),
    pregameStatusWidgetLeave = document.getElementById('pregamestatuswidgetleave'),
    enterNamePrompt = document.getElementById('enternameprompt'),
    enterTeamNamePrompt = document.getElementById('enterteamnameprompt'),
    answer = document.getElementById('answer'),
    answerText = document.getElementById('answertext'),
    remainingAfter = document.getElementById('remainingafter'),
    finish = document.getElementById('finish'),
    winnerText = document.getElementById('winnertext'),
    log = document.getElementById('log'),
    teamMembers = document.getElementById('teammembers'),
    containerino = document.getElementById('containerino');

// Register event listeners
joinSoloButton.addEventListener('click', () => joinGameSolo());
createTeamButton.addEventListener('click', () => createTeam());
pregameStatusWidgetLeave.addEventListener('click', () => leaveTeam());

minusA.addEventListener('click', () => minusOption('a'));
addA.addEventListener('click', () => addOption('a'));
minusB.addEventListener('click', () => minusOption('b'));
addB.addEventListener('click', () => addOption('b'));
minusC.addEventListener('click', () => minusOption('c'));
addC.addEventListener('click', () => addOption('c'));
minusD.addEventListener('click', () => minusOption('d'));
addD.addEventListener('click', () => addOption('d'));

reset.addEventListener('click', () => resetState());
lockIn.addEventListener('click', () => setLockedIn());

addRemainingA.addEventListener('click', () => addRemaining('a'));
addRemainingB.addEventListener('click', () => addRemaining('b'));
addRemainingC.addEventListener('click', () => addRemaining('c'));
addRemainingD.addEventListener('click', () => addRemaining('d'));

// Game State
var id = null,
    team = null,
    playerName = null,
    solo = null,
    gameState = {
        scene: GAME_STATE.PREGAME
    },
    killswitch = true,
    currentErrorMessage = null,
    currentErrorMessageTimeout = null;

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

    if (killswitch === true && data.state.scene !== GAME_STATE.PREGAME) {
        // Game already in progress
        containerino.innerHTML = 'The game is already in progress!';
        ws.close();
    } else {
        killswitch = false;
    }

    if (gameState.state === GAME_STATE.ANSWER && data.state === GAME_STATE.GAME) {
        log.innerHTML = '';
    }
    
    gameState = data.state;
    team = assertTeam();
}

function handleAcknowledgeName(data) {
    playerName = data.name;
    solo = data.solo ? true : false;
}

function handleReset() {
    playerName = null;
    team = null;
    solo = null;
    log.innerHTML = '';
    killswitch = true;
    currentErrorMessage = '';
    currentErrorMessageTimeout = null;
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
        logText = `${p} added money to option ${data.option}`;
    } else if (data.type === 'minus') {
        logText = `${p} subtracted money from option ${data.option}`;
    } else if (data.type === 'resetAllocation') {
        logText = `${p} reset all money allocations`;
    } else if (data.type === 'lock') {
        logText = `${p} locked us in`;
    }

    log.innerHTML = logText + '\n' + log.innerHTML;
}

function getTeamByName(teamName) {
    for (let team of gameState.teams) {
        if (team.name === teamName) {
            return team;
        }
    }

    console.error('Attempted to find a non-existent team!');
}

// Register event handlers
ws.onmessage = (msg) => handleMessage(msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: handlePong,
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: handleConnectionId,
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: handleStateChange,
    [MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME]: handleAcknowledgeName,
    [MESSAGE_TYPE.SERVER.RESET]: handleReset,
    [MESSAGE_TYPE.SERVER.LOG]: handleLog,
    [MESSAGE_TYPE.SERVER.ERROR_MESSAGE]: handleErrorMessage
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

function leaveTeam() {
    console.log(`Leaving team ${team} as ${playerName}`);
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

/* === End Sender Functions === */

function updateUI() {

    if (!currentErrorMessageTimeout) {
        errorMessage.hidden = true;
    }

    if (!killswitch) {
        if (gameState.scene === 'pregame') {
            pregameContainer.hidden = false;
            gameContainer.hidden = true;
            answer.hidden = true;
            finish.hidden = true;
    
            if (playerName !== null) {
                document.getElementById('name').hidden = true;
                document.getElementById('team').hidden = true;
                joinSoloButton.hidden = true;
                createTeamButton.hidden = true;
                pregameStatusWidgetName.innerHTML = playerName;
                pregameStatusWidgetSolo.innerHTML = solo ? 'solo ' : '';
                pregameStatusWidgetTeam.innerHTML = team;
                pregameStatusWidget.hidden = false;
                enterNamePrompt.hidden = true;
                enterTeamNamePrompt.hidden = true;
            } else {
                document.getElementById('name').hidden = false;
                document.getElementById('team').hidden = false;
                joinSoloButton.hidden = false;
                createTeamButton.hidden = false;
                pregameStatusWidget.hidden = true;
                enterNamePrompt.hidden = false;
                enterTeamNamePrompt.hidden = false;
            }

            let solosHTML = '';
            let numSolos = 0;
            let teamsHTML = '';
            let numTeams = 0;
            for (let team of gameState.teams) {
                if (team.solo) {
                    solosHTML += `<tr><td>${team.teamName}</td></tr>`;
                    numSolos++;
                } else {
                    let joinButtonHTML = `<button class="teambutton" data-team="${team.teamName}">Join Team</button>`;
                    let leaveButtonHTML = '<button class="leavebutton">Leave Team</button>';
                    let membersHTML = '';
                    let isAlreadyInTeam = false;
                    for (let tm of team.members) {
                        membersHTML += `<tr><td>${tm.name}</td></tr>`;
                        if (tm.name === playerName) {
                            isAlreadyInTeam = true;
                        }
                    }
                    
                    teamsHTML += `<table><tr><th>${`${team.teamName} (${team.members.length})`}</th><th>${isAlreadyInTeam ? leaveButtonHTML : joinButtonHTML}</th></tr>${membersHTML}`;
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
        }
    
        if (gameState.scene === 'game') {
            let _team = getTeamByName(team);

            pregameContainer.hidden = true;
            answer.hidden = true;
    
            teamName.innerHTML = _team.teamName;
            
            questionNumber.innerHTML = gameState.activeQuestion.number;
            questionText.innerHTML = gameState.activeQuestion.text;
    
            let teamMembersHTML = '';
            for (let tm of _team.members) {
                teamMembersHTML += `<li>${tm.name}</li>`;
            }
            teamMembers.innerHTML = teamMembersHTML;
    
            remaining.innerHTML = numberWithCommas(moneyRemainingThisTurn());
    
            optionA.innerHTML = gameState.activeQuestion.options.a;
            optionB.innerHTML = gameState.activeQuestion.options.b;
            optionC.innerHTML = gameState.activeQuestion.options.c;
            optionD.innerHTML = gameState.activeQuestion.options.d;
    
            allocatedA.innerHTML = numberWithCommas(_team.optionsAllocated['a']);
            allocatedB.innerHTML = numberWithCommas(_team.optionsAllocated['b']);
            allocatedC.innerHTML = numberWithCommas(_team.optionsAllocated['c']);
            allocatedD.innerHTML = numberWithCommas(_team.optionsAllocated['d']);
    
            if (moneyRemainingThisTurn() !== 0) {
                lockIn.disabled = true;
                help.innerHTML = 'You need to allocate all of your money!';
            } else {
                lockIn.disabled = false;
                help.innerHTML = '';
            }
    
            if (moneyRemainingThisTurn() === 0) {
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
    
            reset.disabled = moneyRemainingThisTurn() === _team.remainingMoney;
    
            if (_team.lockedIn) {
                addA.disabled = true;
                addB.disabled = true;
                addC.disabled = true;
                addD.disabled = true;
                minusA.disabled = true;
                minusB.disabled = true;
                minusC.disabled = true;
                minusD.disabled = true;
                reset.disabled = true;
                lockIn.disabled = true;
                
                help.innerHTML = 'You\'re locked in!';
            }
    
            gameContainer.hidden = false;
        }
        
        if (gameState.scene === 'answer') {
            let _team = getTeamByName(team);

            pregameContainer.hidden = true;
            gameContainer.hidden = true;
            finish.hidden = true;
            answer.hidden = false;
    
            answerText.innerHTML = gameState.answer.toUpperCase() + ": " + gameState.activeQuestion.options[gameState.answer];
            remainingafter.innerHTML = _team.remainingMoney;
        }
    
        if (gameState.scene === 'finish') {
            pregameContainer.hidden = true;
            gameContainer.hidden = true;
            answer.hidden = true;
            finish.hidden = false;
    
            if (gameState.winner === 'nobody') {
                winnerText.innerHTML = 'Nobody won x-(';
            } else if (gameState.winner === 'tie') {
                winnerText.innerHTML = 'You were one of multiple winners!';
            } else {
                winnerText.innerHTML = gameState.winner === team ? 'You won!' : 'You lost!';
            }
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

    console.log(`Remaining money: ${_team.remainingMoney}`);
    console.log(`Allocated money: ${(_team.optionsAllocated.a
        + _team.optionsAllocated.b
        + _team.optionsAllocated.c
        + _team.optionsAllocated.d)}`)

    return _team.remainingMoney
        - (_team.optionsAllocated.a
            + _team.optionsAllocated.b
            + _team.optionsAllocated.c
            + _team.optionsAllocated.d);
}

setInterval(() => {
    console.log('Sending ping');

    sendMessage(ws, MESSAGE_TYPE.CLIENT.PING, {}, id, (reason) => handleErrorMessage({ message: reason }));
}, 5000);

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
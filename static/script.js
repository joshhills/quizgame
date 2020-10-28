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

// Get elements
var pregameContainer = document.getElementById('pregame'),
    gameContainer = document.getElementById('game'),
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
    join = document.getElementById('join'),
    pregameStatus = document.getElementById('pregamestatus'),
    enterNamePrompt = document.getElementById('enternameprompt'),
    answer = document.getElementById('answer'),
    answerText = document.getElementById('answertext'),
    remainingAfter = document.getElementById('remainingafter'),
    finish = document.getElementById('finish'),
    winnerText = document.getElementById('winnertext'),
    log = document.getElementById('log'),
    teamMembers = document.getElementById('teammembers'),
    containerino = document.getElementById('containerino');

// Register event listeners
join.addEventListener('click', () => joinGame());

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
    gameState = {
        scene: GAME_STATE.PREGAME
    },
    killswitch = true;

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
    if (killswitch && data.scene !== GAME_STATE.PREGAME) {
        // Game already in progress
        containerino.innerHTML = 'The concierge is busy...';
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
}

function handleReset() {
    playerName = null;
    team = null;
    log.innerHTML = '';
}

function handleLog(data) {
    
    let p = null;
    for (let tm of gameState.teams[team].members) {
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

// Register event handlers
ws.onmessage = (msg) => handleMessage(msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: handlePong,
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: handleConnectionId,
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: handleStateChange,
    [MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME]: handleAcknowledgeName,
    [MESSAGE_TYPE.SERVER.RESET]: handleReset,
    [MESSAGE_TYPE.SERVER.LOG]: handleLog
}, updateUI);

/* === End Handler Functions === */

/* === Begin Sender functions === */

function joinGame() {
    let playerName = document.getElementById('name').value;
    console.log(`Joining as ${playerName}`);
    
    sendMessage(ws, MESSAGE_TYPE.CLIENT.JOIN, { as: playerName }, id);
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
    if (gameState.scene === 'pregame') {
        pregameContainer.hidden = false;
        gameContainer.hidden = true;
        answer.hidden = true;
        finish.hidden = true;

        if (playerName !== null) {
            document.getElementById('name').hidden = true;
            join.hidden = true;
            pregameStatus.innerHTML = "Waiting...";
            enterNamePrompt.hidden = true;
        } else {
            document.getElementById('name').hidden = false;
            join.hidden = false;
            pregameStatus.innerHTML = "";
            enterNamePrompt.hidden = false;
        }
    }

    if (gameState.scene === 'game') {
        pregameContainer.hidden = true;
        answer.hidden = true;

        teamName.innerHTML = gameState.teams[team].teamName;
        if (team === 'x') {
            teamName.className = 'yellow';
        } else {
            teamName.className = 'purple';
        }

        questionNumber.innerHTML = gameState.activeQuestion.number;
        questionText.innerHTML = gameState.activeQuestion.text;

        let teamMembersHTML = '';
        for (let tm of gameState.teams[team].members) {
            teamMembersHTML += `<li>${tm.name}</li>`;
        }
        teamMembers.innerHTML = teamMembersHTML;

        remaining.innerHTML = numberWithCommas(moneyRemainingThisTurn());

        optionA.innerHTML = gameState.activeQuestion.options.a;
        optionB.innerHTML = gameState.activeQuestion.options.b;
        optionC.innerHTML = gameState.activeQuestion.options.c;
        optionD.innerHTML = gameState.activeQuestion.options.d;

        allocatedA.innerHTML = numberWithCommas(gameState.teams[team].optionsAllocated['a']);
        allocatedB.innerHTML = numberWithCommas(gameState.teams[team].optionsAllocated['b']);
        allocatedC.innerHTML = numberWithCommas(gameState.teams[team].optionsAllocated['c']);
        allocatedD.innerHTML = numberWithCommas(gameState.teams[team].optionsAllocated['d']);

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

        minusA.disabled = gameState.teams[team].optionsAllocated['a'] === 0;
        minusB.disabled = gameState.teams[team].optionsAllocated['b'] === 0;
        minusC.disabled = gameState.teams[team].optionsAllocated['c'] === 0;
        minusD.disabled = gameState.teams[team].optionsAllocated['d'] === 0;

        reset.disabled = moneyRemainingThisTurn() === gameState.teams[team].remainingMoney;

        if (gameState.teams[team].lockedIn) {
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
        pregameContainer.hidden = true;
        gameContainer.hidden = true;
        finish.hidden = true;
        answer.hidden = false;

        answerText.innerHTML = gameState.answer.toUpperCase() + ": " + gameState.activeQuestion.options[gameState.answer];
        remainingafter.innerHTML = gameState.teams[team].remainingMoney;
    }

    if (gameState.scene === 'finish') {
        pregameContainer.hidden = true;
        gameContainer.hidden = true;
        answer.hidden = true;
        finish.hidden = false;

        if (gameState.winner === 'nobody') {
            winnerText.innerHTML = 'Nobody won';
        } else if (gameState.winner === 'both') {
            winnerText.innerHTML = 'You both won';
        } else {
            winnerText.innerHTML = gameState.winner === team ? 'You won!' : 'You lost!';
        }
    }
}

function assertTeam() {
    let team = null;
    for (let tm of gameState.teams.x.members) {
        if (tm.id === id.id) {
            team = 'x';
            break;
        }
    }
    if (team === null) {
        team = 'y';
    }
    return team;
}

// Utility method for money remaining per turn
function moneyRemainingThisTurn() {
    console.log(`Remaining money: ${gameState.teams[team].remainingMoney}`);
    console.log(`Allocated money: ${(gameState.teams[team].optionsAllocated.a
        + gameState.teams[team].optionsAllocated.b
        + gameState.teams[team].optionsAllocated.c
        + gameState.teams[team].optionsAllocated.d)}`)

    return gameState.teams[team].remainingMoney
        - (gameState.teams[team].optionsAllocated.a
            + gameState.teams[team].optionsAllocated.b
            + gameState.teams[team].optionsAllocated.c
            + gameState.teams[team].optionsAllocated.d);
}

setInterval(() => {
    console.log('Sending ping');

    sendMessage(ws, MESSAGE_TYPE.CLIENT.PING, {}, id);
}, 5000);

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
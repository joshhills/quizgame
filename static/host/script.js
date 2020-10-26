import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage } from '../shared.js';

// Connect to server

let ws;

function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
}

connect();

let id = null,
    gameState = null;

// Get element references
let rawGameState = document.getElementById('rawgamestate'),
    progressState = document.getElementById('progressstate'),
    numPlayers = document.getElementById('numplayers'),
    playersTable = document.getElementById('players'),
    reset = document.getElementById('reset');

// Register event listeners
function swapTeam(theId) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.SWAP_TEAM, { swap: theId }, id);
}

progressState.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.PROGRESS_STATE, {}, id);
});

reset.addEventListener('click', () => {
    let r = confirm('Are you sure?');
    if (r) {
        sendMessage(ws, MESSAGE_TYPE.CLIENT.RESET, {}, id);
    }
});

/* === Begin Handler functions === */

// Handle a pong from the server
function handlePong() {
    console.log('Received pong');
}

function handleConnectionId(data) {
    id = data.id;
}

// Handle the state of the game changing
function handleStateChange(data) {
    gameState = data.state;
    rawGameState.innerHTML = JSON.stringify(gameState, null, 4);
}

// Register event handlers
ws.onmessage = (msg) => handleMessage(msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: handlePong,
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: handleConnectionId,
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: handleStateChange
}, updateUI);

/* === End Handler Functions === */

function updateUI() {
    if (gameState === null) {
        return;
    }

    let inumPlayers = gameState.teams.x.members.length + gameState.teams.y.members.length;

    if ((gameState.scene === GAME_STATE.PREGAME && inumPlayers > 1)
        || (gameState.scene === GAME_STATE.GAME && gameState.teams.x.lockedIn && gameState.teams.y.lockedIn)
        || gameState.scene === GAME_STATE.ANSWER) {
        progressState.disabled = false;
    } else {
        progressState.disabled = true;
    }

    // Number players
    numPlayers.innerHTML = inumPlayers;

    // Players table
    let playersTableHTML = '<tr><th>Name</th><th>Id</th><th>Team</th><th>Control</th></tr>';
    for (let tm of gameState.teams.x.members) {
        playersTableHTML += `<tr><td>${tm.name}</td><td>${tm.id}</td><td>x</td><td><button class="swap-team" data-id="${tm.id}">Swap Team</button></td>`
    }
    for (let tm of gameState.teams.y.members) {
        playersTableHTML += `<tr><td>${tm.name}</td><td>${tm.id}</td><td>y</td><td><button class="swap-team" data-id="${tm.id}">Swap Team</button></td>`
    }
    playersTable.innerHTML = playersTableHTML;
    let swapTeamButtons = document.getElementsByClassName('swap-team');
    for (let b of swapTeamButtons) {
        b.addEventListener('click', () => {
            let playerId = b.getAttribute('data-id');
            swapTeam(playerId);
        });
    }
};
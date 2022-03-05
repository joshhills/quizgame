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
    notification = document.getElementById('notification'),
    notifyButton = document.getElementById('notify'),
    removeNotificationButton = document.getElementById('removenotify'),
    notifyPreset = document.getElementById('notifypreset'),
    notifyPresets = document.getElementById('notifypresets'),
    playersTable = document.getElementById('players'),
    reset = document.getElementById('reset');

function kick(theId) {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.KICK, { kick: theId }, id);
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

notifyButton.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.NOTIFY, { message: notification.value }, id);
});

removeNotificationButton.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.REMOVE_NOTIFY, {}, id);
});

notifyPreset.addEventListener('click', () => {
    sendMessage(ws, MESSAGE_TYPE.CLIENT.NOTIFY, { message: notifyPresets.value }, id);
});

/* === Begin Handler functions === */

// Handle a pong from the server
function handlePong() {
    console.log('Received pong');
}

function handleConnectionId(data) {
    id = data;

    setInterval(() => {
        console.log('Sending ping');

        sendMessage(ws, MESSAGE_TYPE.CLIENT.PING, {}, id);
    }, 5000);
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

    let inumPlayers = gameState.teams.reduce((p, t) => p + t.members.length, 0);

    // Number players
    numPlayers.innerHTML = inumPlayers;

    // Players table
    let playersTableHTML = '<tr><th>Name</th><th>Id</th><th>Team</th><th>Solo</th><th>Control</th></tr>';

    for (let team of gameState.teams) {
        for (let tm of team.members) {
            playersTableHTML += `<tr><td>${tm.name}</td><td>${tm.id}</td><td>${team.teamName}</td><td>${team.solo ? '✅' : ''}</td><td><button class="kick" data-id="${tm.id}">Kick</button></td>`
        }
    }

    playersTable.innerHTML = playersTableHTML;

    let kickButtons = document.getElementsByClassName('kick');
    for (let b of kickButtons) {
        b.addEventListener('click', () => {
            let playerId = b.getAttribute('data-id');
            kick(playerId);
        });
    }
};
import { MESSAGE_TYPE, GAME_STATE, sendMessage, formatMessage, handleMessage, getClientById } from './static/shared.js';

import express from 'express';
import pkg from 'ws';
const { Server } = pkg;
import * as uuid from 'uuid';
import url from 'url';

const PORT = process.env.PORT || 3000;

const server = express()
  .use(express.static('./static'))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });

/** Bootstrap game state */

const STARTING_MONEY = 100000;

const questions = [
    {
        number: 1,
        text: 'This is a test question 1, the answer is a',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        }
    },
    {
        number: 1,
        text: 'This is a test question 2, the answer is b',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        }
    },
    {
        number: 1,
        text: 'This is a test question 3, the answer is c',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        }
    }
];

const answers = [
    'a',
    'b',
    'c'
];

let state = GAME_STATE.PREGAME,
    activeQuestion = null,
    answer = null,
    teams = null,
    winner = null;

reset();

/** Handle WS Messaging */

// Clear the game state
function reset() {
    state = GAME_STATE.PREGAME;
    activeQuestion = null;
    teams = [];
    answer = null,
    winner = null;
}

function broadcastGameState() {

    const gameState = {
        scene: state,
        activeQuestion: activeQuestion,
        answer: answer,
        teams: teams,
        winner: winner
    };

    wss.clients.forEach((c) => {
        sendMessage(c, MESSAGE_TYPE.SERVER.STATE_CHANGE, {state: gameState});
    });
}

function handleProgressState() {

    if (state === GAME_STATE.PREGAME && teams.length > 1) {
        state = GAME_STATE.GAME;
        activeQuestion = questions[0];
    } else if (state === GAME_STATE.GAME) {
        state = GAME_STATE.ANSWER;
        answer = answers[activeQuestion.number - 1];
        
        // Compute new totals
        for (let team of teams) {
            team.remainingMoney = team.optionsAllocated[answer];
        }
    } else if (state === GAME_STATE.ANSWER) {

        // TODO: Progress to scores screen
    } else if (state === GAME_STATE.SCORES) {
        const _allTeamsBankrupt = allTeamsBankrupt();
        if (activeQuestion.number === questions.length || _allTeamsBankrupt /* TODO: Make this function! */) {
            state = GAME_STATE.FINISH;
            
            if (_allTeamsBankrupt) {
                winner = 'nobody';
            } else {
                const winners = getTeamsWithMostMoney();

                if (winners.length > 1) {
                    winner = 'tie';
                } else {
                    winner = winners[0].teamName;
                }
            }
        } else {
            answer = null;
            activeQuestion = questions[activeQuestion.number];

            for (let team of teams) {
                team.optionsAllocated = {
                    a: 0,
                    b: 0,
                    c: 0,
                    d: 0
                };
                team.lockedIn = false;
            }

            state = GAME_STATE.GAME;
        }
    }

    broadcastGameState();
}

function handleLockIn(data) {
    let team = getTeamByName(data.team);

    team.lockedIn = true;
    
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'lock'
    });

    broadcastGameState();
}

function handleResetAllocation(data) {
    let team = getTeamByName(data.team);

    team.optionsAllocated = {
        a: 0,
        b: 0,
        c: 0,
        d: 0
    };

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'resetAllocation'
    });

    broadcastGameState();
}

function handleAddOption(data) {
    let team = getTeamByName(data.team);

    let step = getDenomination(data.team);
    if (moneyRemainingThisTurn(data.team) >= step) {
        team.optionsAllocated[data.option] += step;
    }

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'add',
        option: data.option
    });

    broadcastGameState();
}

function handleCreateTeam(data) {

    let tws = getClientById(wss, data.id.id);

    let teamName = data.team;
    let playerName = data.as;

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team with an empty team name!" });
        return;
    }

    if (!playerName || /^\s*$/.test(playerName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team with an empty player name!" });
        return;
    }

    // Does team already exist?
    for (let team of teams) {
        if (teamName === team.teamName) {
            handleJoinTeam(data);
            return;
        }
    }

    // Otherwise, create and add it
    teams.push(
        {
            teamName: teamName,
            members: [
                {
                    name: playerName,
                    id: data.id.id
                }
            ],
            remainingMoney: STARTING_MONEY,
            optionsAllocated: {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            },
            lockedIn: false,
            solo: false
        }
    );

    sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: playerName });
    broadcastGameState();
}

function handleJoinTeam(data) {
    
    let teamName = data.team;
    let playerName = data.as;

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team with an empty name!" });
        return;
    }

    if (!playerName || /^\s*$/.test(playerName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team with an empty player name!" });
        return;
    }

    // Check to see if this player is already part of another game...
    for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams[i].members.length; j++) {
            if (teams[i].members[j].id === data.id.id) {
                // They are, so remove them from the team
                teams[i].members.splice(j, 1);

                // If the team is now empty, remove it
                if (teams[i].members.length === 0) {
                    teams.splice(i, 1);
                }

                break;
            }
        }
    }

    // Find the team to add the player to
    for (let team of teams) {
        if (teamName === team.teamName) {
            team.members.push({
                name: playerName,
                id: data.id.id
            });

            let tws = getClientById(wss, data.id.id);
            sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: data.as });
            broadcastGameState();
            return;
        }
    }

    sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Team not found" });
}

function handleJoinSolo(data) {

    let tws = getClientById(wss, data.id.id);
    let teamName = data.as;

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot play solo with an empty player name!" });
        return;
    }

    // As we're using the player's name as their team name, prevent conflicts
    let attempts = 0;
    let didRename = false;
    let checkingForDuplicates = true;
    while (checkingForDuplicates) {
        attempts++;
        for (let team of teams) {
            if (team.teamName === teamName) {
                teamName = `${teamName} (${attempts})`;
                didRename = true;
                continue;
            }
        }
        checkingForDuplicates = false;
    }

    teams.push(
        {
            teamName: teamName,
            members: [
                {
                    name: data.as,
                    id: data.id.id
                }
            ],
            remainingMoney: STARTING_MONEY,
            optionsAllocated: {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            },
            lockedIn: false,
            solo: true
        }
    );

    if (didRename) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: `Changed your solo team name as there was already a '${data.as}'` });
    }
    sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: data.as, solo: true });
    broadcastGameState();
}

function handleLeaveTeam(data) {

    let tws = getClientById(wss, data.id.id);
    console.log(data.id.id);

    // Find the team the player is on...
    let team = null;
    for (let _team of teams) {
        for (let tm of _team.members) {
            if (tm.id === data.id.id) {
                team = _team;
                break;
            }
        }

        if (team) {
            break;
        }
    }

    if (!team) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Unable to find team to leave" });
        return;
    }

    // Check to see if this player is already part of another game...
    for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams[i].members.length; j++) {
            if (teams[i].members[j].id === data.id.id) {
                // They are, so remove them from the team
                teams[i].members.splice(j, 1);

                // If the team is now empty, remove it
                if (teams[i].members.length === 0) {
                    teams.splice(i, 1);
                }

                break;
            }
        }
    }

    // Reset that person's client
    sendMessage(tws, MESSAGE_TYPE.SERVER.RESET, {});
    broadcastGameState();
    return;
}

function handleAddRemaining(data) {
    if (moneyRemainingThisTurn(data.team) > 0) {
        let team = getTeamByName(data.team); 
        team.optionsAllocated[data.option] += moneyRemainingThisTurn(data.team);
    }

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'add',
        option: data.option
    });

    broadcastGameState();
}

function handleMinusOption(data) {
    let step = getDenomination(data.team);
    let team = getTeamByName(data.team);
    if (team.optionsAllocated[data.option] != 0) {
        team.optionsAllocated[data.option] -= step;
    }
    
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'minus',
        option: data.option
    });

    broadcastGameState();
}

function handleReset() {
    reset();
    broadcast(MESSAGE_TYPE.SERVER.RESET, {});
    broadcastGameState();
}

function handleKick(data) {
    let idToSwap = data.kick;
    let ix = null;
    let team = null;

    // Find the person who's being kicked
    for (let _team of teams) {
        for (let i = 0; i < _team.members.length; i++) {
            if (_team.members[i].id === idToSwap) {
                ix = i;
                team = _team;
                break;
            }
        }
    }

    if (team !== null) {
        team.members.splice(ix, 1);
    }

    // Find the person that's been kicked
    let tws;
    wss.clients.forEach(c => {
        if (c.id === idToSwap) {
            tws = c;
        }
    });

    // Reset that person's client
    sendMessage(tws, MESSAGE_TYPE.SERVER.RESET, {});

    broadcastGameState();
}

// Handle disconnection
function handleClose() {
    console.log(`Client ${this.id} disconnected`);
}
  
function handlePing(data) {
    let tws = getClientById(wss, data.id.id);
    sendMessage(tws, MESSAGE_TYPE.SERVER.PONG, {});
}

// Handle connection and register listeners
wss.on('connection', (ws, req) => {
    
    let preId = url.parse(req.url, true).query.id;
    let found = false;
    let player = null;
    if (preId !== null) {
        for (let team of teams) {
            for (let tm of team.members) {
                if (tm.id === preId) {
                    found = true;
                    player = tm;
                    break;
                }
            }
        }
    }

    if (found) {
        ws.id = preId;

        sendMessage(ws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: player.name });
    } else {
        ws.id = uuid.v4();
    }
  
    ws.on('close', handleClose);
    ws.on('message', (msg) => handleMessage(msg, {
        [MESSAGE_TYPE.CLIENT.PING]: handlePing,        
        [MESSAGE_TYPE.CLIENT.JOIN_SOLO]: handleJoinSolo,
        [MESSAGE_TYPE.CLIENT.JOIN_TEAM]: handleJoinTeam,
        [MESSAGE_TYPE.CLIENT.CREATE_TEAM]: handleCreateTeam,
        [MESSAGE_TYPE.CLIENT.LEAVE_TEAM]: handleLeaveTeam,
        [MESSAGE_TYPE.CLIENT.PROGRESS_STATE]: handleProgressState,
        [MESSAGE_TYPE.CLIENT.LOCK_IN]: handleLockIn,
        [MESSAGE_TYPE.CLIENT.RESET_ALLOCATION]: handleResetAllocation,
        [MESSAGE_TYPE.CLIENT.ADD_OPTION]: handleAddOption,
        [MESSAGE_TYPE.CLIENT.ADD_REMAINING]: handleAddRemaining,
        [MESSAGE_TYPE.CLIENT.MINUS_OPTION]: handleMinusOption,
        [MESSAGE_TYPE.CLIENT.RESET]: handleReset,
        [MESSAGE_TYPE.CLIENT.KICK]: handleKick
    }));
  
    sendMessage(ws, MESSAGE_TYPE.SERVER.CONNECTION_ID, { id: ws.id });
  
    broadcastGameState();
});

/**
 * Send an object to all connected websockets
 * 
 * @param {MESSAGE_TYPE} type to inject into message 
 * @param {any} obj to encode and send 
 */
function broadcast(type, obj) {
    let blobStr = formatMessage(type, obj);
    wss.clients.forEach((c) => c.send(blobStr));
}

// Utility method for money denominations
function getDenomination(teamName) {
    const team = getTeamByName(teamName);

    if (team.remainingMoney < 100) {
        return 1;
    }
    if (team.remainingMoney < 1000) {
        return 10;
    }
    if (team.remainingMoney < 5000) {
        return 50;
    }
    if (team.remainingMoney < 10000) {
        return 100;
    }
    if (team.remainingMoney < 25000) {
        return 500;
    }
    if (team.remainingMoney < 50000) {
        return 1000;
    }
    return 5000;
}

// Utility method for money remaining per turn
function moneyRemainingThisTurn(teamName) {
    const team = getTeamByName(teamName);

    return team.remainingMoney
        - (team.optionsAllocated.a
            + team.optionsAllocated.b
            + team.optionsAllocated.c
            + team.optionsAllocated.d);
}

function getTeamByName(teamName) {

    for (let team of teams) {
        if (team.name === teamName) {
            return team;
        }
    }

    console.error('Attempted to find a non-existent team!');
}

function allTeamsBankrupt() {
    for (let team of teams) {
        if (team.remainingMoney > 0) {
            return false;
        }   
    }

    return true;
}

function getTeamsWithMostMoney() {
    let teamsWithMostMoney = [];

    let highestSoFar = -1;
    for (let team of teams) {
        if (team.remainingMoney > highestSoFar) {
            teamsWithMostMoney = [team];
        } else if (team.remainingMoney === highestSoFar) {
            teamsWithMostMoney.push(team);
        }
    }

    return teamsWithMostMoney;
}
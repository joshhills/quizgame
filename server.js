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
        text: 'This is a test question 1, the answer is a',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Intelligent-Systems-Nintendo-DS-Nitro-Burner.jpg',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        },
        answer: 'a'
    },
    {
        text: 'This is a test question 2, the answer is b',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Sony_CRX310S-Internal-PC-DVD-Drive-Opened.jpg/800px-Sony_CRX310S-Internal-PC-DVD-Drive-Opened.jpg',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        },
        answer: 'b'
    },
    {
        text: 'This is a test question 3, the answer is c',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Apple-USB-SuperDrive.jpg',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        },
        answer: 'c'
    }
];

let state = GAME_STATE.PREGAME,
    activeQuestion = null,
    activeQuestionIndex = 0,
    teams = null,
    winners = null;

reset();

/** Handle WS Messaging */

// Clear the game state
function reset() {
    state = GAME_STATE.PREGAME;
    activeQuestion = null;
    activeQuestionIndex = 0;
    teams = [];
    winners = null;
}

function broadcastGameState() {

    let _activeQuestion = null;
    if (activeQuestion) {
        _activeQuestion = {
            text: activeQuestion.text,
            options: activeQuestion.options,
            // Don't send answer to clients if they're mid-guessing!
            answer: state === GAME_STATE.GAME ? null : activeQuestion.answer
        };
    }

    const gameState = {
        scene: state,
        activeQuestion: _activeQuestion,
        activeQuestionIndex: activeQuestionIndex,
        teams: teams,
        winners: winners
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
        
        // Compute new totals
        for (let team of teams) {
            team.remainingMoney = team.optionsAllocated[questions[activeQuestionIndex].answer];
        }
    } else if (state === GAME_STATE.ANSWER) {
        state = GAME_STATE.SCORES;
    } else if (state === GAME_STATE.SCORES) {
        const _allTeamsOrAllButOneBankrupt = allTeamsOrAllButOneBankrupt();
        if (activeQuestionIndex === questions.length - 1 || _allTeamsOrAllButOneBankrupt) {
            state = GAME_STATE.FINISH;
            
            winners = getTeamsWithMostMoney();
        } else {
            activeQuestionIndex++;
            activeQuestion = questions[activeQuestionIndex];

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
    
    // TODO: only send to teammates
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

    // TODO: only send to teammates
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

    // TODO: only send to teammates
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
                    id: data.id.id,
                    ready: false
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

function handleNotify(data) {
    const message = data.message;

    wss.clients.forEach((c) => {
        sendMessage(c, MESSAGE_TYPE.SERVER.NOTIFY, { message: message });
    });
}

function handleRemoveNotify() {
    wss.clients.forEach((c) => {
        sendMessage(c, MESSAGE_TYPE.SERVER.REMOVE_NOTIFY, {});
    });
}

function handleTeamChat(data) {
    
    let tws = getClientById(wss, data.id.id);

    // Find the team the player is on...
    let team = null;
    let player = null;
    for (let _team of teams) {
        for (let tm of _team.members) {
            if (tm.id === data.id.id) {
                team = _team;
                player = tm;
                break;
            }
        }

        if (team) {
            break;
        }
    }

    if (!team) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Unable to find team to message!" });
        return;
    }

    for (let tm of team.members) {
        let _tws = getClientById(wss, tm.id);
        sendMessage(_tws, MESSAGE_TYPE.SERVER.TEAM_CHAT, { name: player.name, message: data.message });
    }
}

function handleJoinTeam(data) {

    let tws = getClientById(wss, data.id.id);
    
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
                id: data.id.id,
                ready: false
            });

            sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: data.as });
            broadcastGameState();
            return;
        }
    }

    sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Team not found" });
}

function handleJoinSolo(data) {

    // let foo = 10000000000;
    // while (foo > 0) {
    //     foo--;
    // }

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
    let originalTeamName = teamName;
    while (checkingForDuplicates) {
        attempts++;
        let skip = false;
        for (let team of teams) {
            if (team.teamName === teamName) {
                teamName = `${originalTeamName} (${attempts})`;
                didRename = true;
                skip = true;
                break;
            }
        }
        if (skip) {
            continue;
        }
        checkingForDuplicates = false;
    }

    teams.push(
        {
            teamName: teamName,
            members: [
                {
                    name: data.as,
                    id: data.id.id,
                    ready: false
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

function handleToggleReady(data) {

    let tws = getClientById(wss, data.id.id);

    // Find team of player
    let found = false;
    let newReady = null;
    for (let team of teams) {
        for (let tm of team.members) {
            if (tm.id === data.id.id) {
                tm.ready = !tm.ready;
                newReady = tm.ready;
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    
    
    if (!found) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Unable to find team to ready up in" });
        return;
    }

    sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_READY, { ready: newReady });
    broadcastGameState();
}

function handleAddRemaining(data) {
    if (moneyRemainingThisTurn(data.team) > 0) {
        let team = getTeamByName(data.team); 
        team.optionsAllocated[data.option] += moneyRemainingThisTurn(data.team);
    }

    // TODO: only send to teammates
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
    
    // TODO: only send to teammates
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
    let teamIx = null;
    let ix = null;
    let team = null;

    // Find the person who's being kicked
    for (var i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams[j].members.length; j++) {
            if (teams[i].members[j].id === idToSwap) {
                teamIx = i;
                ix = j;
                team = teams[i];
                break;
            }
        }
    }

    if (team !== null) {
        if (team.members.length === 1) {
            // Remove team...
            teams.splice(teamIx, 1);
        } else {
            team.members.splice(ix, 1);
        }
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
    ws.on('message', (msg) => handleMessage(ws, msg, {
        [MESSAGE_TYPE.CLIENT.PING]: { handler: handlePing },
        [MESSAGE_TYPE.CLIENT.JOIN_SOLO]: { handler: handleJoinSolo, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.JOIN_TEAM]: { handler: handleJoinTeam },
        [MESSAGE_TYPE.CLIENT.CREATE_TEAM]: { handler: handleCreateTeam },
        [MESSAGE_TYPE.CLIENT.LEAVE_TEAM]: { handler: handleLeaveTeam },
        [MESSAGE_TYPE.CLIENT.TOGGLE_READY]: { handler: handleToggleReady },
        [MESSAGE_TYPE.CLIENT.PROGRESS_STATE]: { handler: handleProgressState },
        [MESSAGE_TYPE.CLIENT.LOCK_IN]: { handler: handleLockIn },
        [MESSAGE_TYPE.CLIENT.RESET_ALLOCATION]: { handler: handleResetAllocation },
        [MESSAGE_TYPE.CLIENT.ADD_OPTION]: { handler: handleAddOption },
        [MESSAGE_TYPE.CLIENT.ADD_REMAINING]: { handler: handleAddRemaining },
        [MESSAGE_TYPE.CLIENT.MINUS_OPTION]: { handler: handleMinusOption },
        [MESSAGE_TYPE.CLIENT.RESET]: { handler: handleReset },
        [MESSAGE_TYPE.CLIENT.KICK]: { handler: handleKick },
        [MESSAGE_TYPE.CLIENT.NOTIFY]: { handler: handleNotify },
        [MESSAGE_TYPE.CLIENT.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
        [MESSAGE_TYPE.CLIENT.TEAM_CHAT]: { handler: handleTeamChat }
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
        if (team.teamName === teamName) {
            return team;
        }
    }

    console.error('Attempted to find a non-existent team!');
}

function allTeamsOrAllButOneBankrupt() {
    let numTeamsWithMoney = 0;

    for (let team of teams) {
        if (team.remainingMoney > 0) {
            numTeamsWithMoney++;
        }   
    }

    return numTeamsWithMoney < 2;
}

function getTeamsWithMostMoney() {
    let teamsWithMostMoney = [];

    let highestSoFar = 0;
    for (let team of teams) {
        if (team.remainingMoney > highestSoFar) {
            teamsWithMostMoney = [team.teamName];
            highestSoFar = team.remainingMoney;
        } else if (highestSoFar !== 0 && team.remainingMoney === highestSoFar) {
            teamsWithMostMoney.push(team.teamName);
        }
    }

    return teamsWithMostMoney;
}
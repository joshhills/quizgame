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
        text: "What is the surname of the current president of Nintendo America?",
        options: {
            a: 'Mario',
            b: 'Bowser',
            c: 'Toad',
            d: 'Yoshi'
        },
        answer: 'b',
        preImageUrl: 'https://mario.wiki.gallery/images/thumb/2/21/DougBowser.jpg/1200px-DougBowser.jpg',
        postImageUrl: 'https://gbatemp.net/attachments/doug-bowser-original-jpg.258904/'
    },
    {
        text: "What prompted the first 'Easter Egg' in a video game?",
        options: {
            a: 'An accidental bug',
            b: 'A developer\'s birthday',
            c: 'A dispute over credits',
            d: 'A crazed fan'
        },
        answer: 'c',
        postImageUrl: 'https://csanyk.com/rants/wp-content/uploads/2015/09/tumblr_lyq4oaXr2M1qzmhdko1_5001.gif'
    },
    {
        text: "Which of these was accidentally included in 'The Last of Us'?",
        options: {
            a: 'The number to a real-world phone sex hotline',
            b: 'A Nazi flag',
            c: 'Candid audio of the developers getting drunk',
            d: 'A giraffe with 8 legs'
        },
        answer: 'a',
        postImageUrl: 'https://cdn.vox-cdn.com/assets/2855671/last_of_us.jpg'
    }
];

let state = GAME_STATE.PREGAME,
    activeQuestion = null,
    activeQuestionIndex = 0,
    teams = null,
    winners = null,
    showImage = false,
    showAllocations = false,
    optionATotalAllocationThisRound = 0,
    optionBTotalAllocationThisRound = 0,
    optionCTotalAllocationThisRound = 0,
    optionDTotalAllocationThisRound = 0,
    totalLostThisRound = 0,
    teamsKnockedOutThisRound = [],
    totalAllocationAllThisRound = 0;

reset();

/** Handle WS Messaging */

// Clear the game state
function reset() {
    state = GAME_STATE.PREGAME;
    activeQuestion = null;
    activeQuestionIndex = 0;
    teams = [];
    winners = null;
    showImage = false;
    showAllocations = false;
    optionATotalAllocationThisRound = 0;
    optionBTotalAllocationThisRound = 0;
    optionCTotalAllocationThisRound = 0;
    optionDTotalAllocationThisRound = 0;
    totalLostThisRound = 0;
    teamsKnockedOutThisRound = [];
    totalAllocationAllThisRound = 0;
}

function broadcastGameState() {

    let _activeQuestion = null;
    if (activeQuestion) {
        _activeQuestion = {
            text: activeQuestion.text,
            options: activeQuestion.options,
            // Don't send answer to clients if they're mid-guessing!
            answer: state === GAME_STATE.GAME ? null : activeQuestion.answer,
            imageUrl: state === GAME_STATE.GAME ? activeQuestion.preImageUrl : activeQuestion.postImageUrl
        };
    }

    const gameState = {
        scene: state,
        activeQuestion: _activeQuestion,
        activeQuestionIndex: activeQuestionIndex,
        teams: teams,
        winners: winners,
        showImage: showImage,
        showAllocations: showAllocations,
        optionATotalAllocationThisRound: optionATotalAllocationThisRound,
        optionBTotalAllocationThisRound: optionBTotalAllocationThisRound,
        optionCTotalAllocationThisRound: optionCTotalAllocationThisRound,
        optionDTotalAllocationThisRound: optionDTotalAllocationThisRound,
        totalLostThisRound: totalLostThisRound,
        teamsKnockedOutThisRound: teamsKnockedOutThisRound,
        totalAllocationAllThisRound: totalAllocationAllThisRound
    };

    broadcast(MESSAGE_TYPE.SERVER.STATE_CHANGE, {state: gameState});
}

function handleProgressState() {

    if (state === GAME_STATE.PREGAME && teams.length > 1) {
        state = GAME_STATE.GAME;
        activeQuestion = questions[0];
    } else if (state === GAME_STATE.GAME) {
        state = GAME_STATE.ANSWER;
        showImage = false;
        
        // Compute total allocations for this round
        optionATotalAllocationThisRound = 0;
        optionBTotalAllocationThisRound = 0;
        optionCTotalAllocationThisRound = 0;
        optionDTotalAllocationThisRound = 0;
        
        totalLostThisRound = 0;

        teamsKnockedOutThisRound = [];

        for (let team of teams) {
            let wasAlive = false;
            if (team.remainingMoney !== 0) {
                wasAlive = true;
            }

            optionATotalAllocationThisRound += team.optionsAllocated.a;
            optionBTotalAllocationThisRound += team.optionsAllocated.b;
            optionCTotalAllocationThisRound += team.optionsAllocated.c;
            optionDTotalAllocationThisRound += team.optionsAllocated.d;

            // Compute new team totals
            let beforeDeduction = team.remainingMoney;

            team.remainingMoney = team.optionsAllocated[questions[activeQuestionIndex].answer];

            // Compute total lost for this round
            totalLostThisRound += beforeDeduction - team.remainingMoney;

            // Compute those who were knocked out this round
            if (wasAlive && team.remainingMoney === 0) {
                teamsKnockedOutThisRound.push(team.teamName);
            }
        }

        totalAllocationAllThisRound = optionATotalAllocationThisRound
            + optionBTotalAllocationThisRound
            + optionCTotalAllocationThisRound
            + optionDTotalAllocationThisRound;

        // TODO: Compute running totals...
    } else if (state === GAME_STATE.ANSWER) {
        showImage = false;
        showAllocations = false;
        state = GAME_STATE.SCORES;
    } else if (state === GAME_STATE.SCORES) {
        showImage = false;
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

            optionATotalAllocationThisRound = 0;
            optionBTotalAllocationThisRound = 0;
            optionCTotalAllocationThisRound = 0;
            optionDTotalAllocationThisRound = 0;
            totalLostThisRound = 0;
            teamsKnockedOutThisRound = [];
            totalAllocationAllThisRound = 0;

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

    broadcast(MESSAGE_TYPE.SERVER.NOTIFY, { message: message });
}

function handleRemoveNotify() {
    broadcast(MESSAGE_TYPE.SERVER.REMOVE_NOTIFY, {});
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

    let tws = getClientById(wss, data.id.id);
    let teamName = data.as;

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot play solo with an empty player name!" });
        return;
    }

    // Ensure this person isn't already in a solo team already
    for (let team of teams) {
        for (let tm of team.members) {
            if (tm.id === data.id.id) {
                sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join your own solo team twice!" });
                return;
            }
        }
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

function handleToggleImage() {
    showImage = !showImage;

    // TODO: Only send update to spectators...
    broadcastGameState();
}

function handleToggleAllocations() {
    showAllocations = !showAllocations;

    // TODO: Only send update to spectators...
    broadcastGameState();
}

function handleEmote(data) {
    if (data.emote) {
        broadcast(MESSAGE_TYPE.SERVER.EMOTE, { emote: data.emote }, (c) => c.isSpectator);
    }
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
    let isSpectator = url.parse(req.url, true).query.spectate;
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

    if (isSpectator) {
        ws.isSpectator = true;
    }
  
    ws.on('close', handleClose);
    ws.on('message', (msg) => handleMessage(ws, msg, {
        [MESSAGE_TYPE.CLIENT.PING]: { handler: handlePing },
        [MESSAGE_TYPE.CLIENT.JOIN_SOLO]: { handler: handleJoinSolo, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.JOIN_TEAM]: { handler: handleJoinTeam, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.CREATE_TEAM]: { handler: handleCreateTeam, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.LEAVE_TEAM]: { handler: handleLeaveTeam, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.TOGGLE_READY]: { handler: handleToggleReady, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.PROGRESS_STATE]: { handler: handleProgressState, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.LOCK_IN]: { handler: handleLockIn },
        [MESSAGE_TYPE.CLIENT.RESET_ALLOCATION]: { handler: handleResetAllocation },
        [MESSAGE_TYPE.CLIENT.ADD_OPTION]: { handler: handleAddOption },
        [MESSAGE_TYPE.CLIENT.ADD_REMAINING]: { handler: handleAddRemaining },
        [MESSAGE_TYPE.CLIENT.MINUS_OPTION]: { handler: handleMinusOption },
        [MESSAGE_TYPE.CLIENT.RESET]: { handler: handleReset },
        [MESSAGE_TYPE.CLIENT.KICK]: { handler: handleKick },
        [MESSAGE_TYPE.CLIENT.NOTIFY]: { handler: handleNotify },
        [MESSAGE_TYPE.CLIENT.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
        [MESSAGE_TYPE.CLIENT.TEAM_CHAT]: { handler: handleTeamChat },
        [MESSAGE_TYPE.CLIENT.TOGGLE_IMAGE]: { handler: handleToggleImage },
        [MESSAGE_TYPE.CLIENT.TOGGLE_ALLOCATIONS]: { handler: handleToggleAllocations },
        [MESSAGE_TYPE.CLIENT.EMOTE]: { handler: handleEmote, rateLimit: { rate: 1000 } }
    }));
  
    sendMessage(ws, MESSAGE_TYPE.SERVER.CONNECTION_ID, { id: ws.id });
  
    broadcastGameState();
});

/**
 * Send an object to all connected websockets
 * 
 * @param {MESSAGE_TYPE} type to inject into message 
 * @param {any} obj to encode and send
 * @param {function} predicate a filter rule for clients
 */
function broadcast(type, obj = {}, predicate = null) {
    let blobStr = formatMessage(type, obj);
    wss.clients.forEach((c) => {
        if (predicate === null || predicate(c)) {
            c.send(blobStr);
        }
    });
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
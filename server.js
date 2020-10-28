import { MESSAGE_TYPE, GAME_STATE, sendMessage, formatMessage, handleMessage, getClientById } from './static/shared.js';

import express from 'express';
import pkg from 'ws';
const { Server } = pkg;
import * as uuid from 'uuid';
import e from 'express';
import url from 'url';

const PORT = process.env.PORT || 3000;

const server = express()
  .use(express.static('./static'))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });

/** Bootstrap game state */

const questions = [
    {
        number: 1,
        text: 'Which of the following is NOT a ghost from the original Pac-Man?',
        options: {
            a: 'Winky',
            b: 'Clyde',
            c: 'Blinky',
            d: 'Inky'
        }
    },
    {
        number: 2,
        text: 'Which of the following Scrabble tiles has the highest value?',
        options: {
            a: 'K',
            b: 'Q',
            c: 'J',
            d: 'X'
        }
    },
    {
        number: 3,
        text: 'Which of the following is a genuine Pokémon type?',
        options: {
            a: 'Earth',
            b: 'Dark',
            c: 'Air',
            d: 'Light'
        }
    },
    {
        number: 4,
        text: 'Under what name did Mario debut in 1981\'s Donkey Kong?',
        options: {
            a: 'Luigi',
            b: 'Jumpman',
            c: 'Plumberman',
            d: 'Mario'
        }
    },
    {
        number: 5,
        text: 'Which Nintendo console was part of the sixth generation of video game consoles along with the Sony Playstation 2 and the Microsoft Xbox?',
        options: {
            a: 'Wii',
            b: 'SNES',
            c: 'Gamecube',
            d: 'Nintendo 64'
        }
    },
    {
        number: 6,
        text: 'What genre of video game is League of Legends?',
        options: {
            a: 'MOBA',
            b: 'MMOFPS',
            c: 'MMORPG',
            d: 'MMORTS'
        }
    },
    {
        number: 7,
        text: 'Which of the following is NOT a game mode in Minecraft?',
        options: {
            a: 'Hardcore',
            b: 'Spectator',
            c: 'Adventure',
            d: 'Explorer'
        }
    },
    {
        number: 8,
        text: 'Which game in the Final Fantasy franchise was the first to spawn a direct sequel?',
        options: {
            a: 'FFVII',
            b: 'FFX',
            c: 'FFV',
            d: 'FFXII'
        }
    },
    {
        number: 9,
        text: 'Which of the following consoles was released by Sega?',
        options: {
            a: 'Gamecube',
            b: 'Zodiac',
            c: 'Dreamcast',
            d: 'Jaguar'
        }
    },
    {
        number: 10,
        text: 'Which of the following model building toys was developed in Denmark?',
        options: {
            a: 'K\'NEX',
            b: 'Lego',
            c: 'Fischertechnik',
            d: 'Meccano'
        }
    },
    {
        number: 11,
        text: 'Which is NOT a dungeon in The Legend of Zelda: Ocarina of Time?',
        options: {
            a: 'Spirit Temple',
            b: 'Fire Temple',
            c: 'Shadow Temple',
            d: 'Light Temple'
        }
    }
];

const answers = [
    'a',
    'b',
    'b',
    'b',
    'c',
    'a',
    'd',
    'b',
    'c',
    'b',
    'd'
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
    teams = {
        x: {
            teamName: 'The Lingering Lades',
            members: [],
            remainingMoney: 100000,
            optionsAllocated: {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            },
            lockedIn: false
        },
        y: {
            teamName: 'The Marauding Mentlegen',
            members: [],
            remainingMoney: 100000,
            optionsAllocated: {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            },
            lockedIn: false
        }
    };
    answer = null,
    winner = null;
}

function broadcastGameState() {
    wss.clients.forEach((c) => {
        let gameState = {
            scene: state,
            activeQuestion: activeQuestion,
            answer: answer,
            teams: teams,
            winner: winner
        };

        sendMessage(c, MESSAGE_TYPE.SERVER.STATE_CHANGE, {state: gameState});
    });
}

function handleJoin(data) {

    let player = {
        name: data.as,
        id: data.id.id
    };

    if (teams.x.members.length === teams.y.members.length || teams.x.members.length < teams.y.members.length) {
        teams.x.members.push(player);
    } else {
        teams.y.members.push(player);
    }

    let tws = getClientById(wss, data.id.id);

    sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: data.as });
    broadcastGameState();
}

function handleSwapTeam(data) {
    let idToSwap = data.swap;
    let ix = null;
    let team = null;
    let member = null;
    for (let i = 0; i < teams.x.members.length; i++) {
        if (teams.x.members[i].id === idToSwap) {
            ix = i;
            team = 'x';
            member = teams.x.members[i];
            break;
        }
    }
    if (ix === null) {
        for (let i = 0; i < teams.y.members.length; i++) {
            if (teams.y.members[i].id === idToSwap) {
                ix = i;
                team = 'y';
                member = teams.y.members[i];
                break;
            }
        }
    }

    if (team === 'x') {
        teams.x.members.splice(ix, 1);
        teams.y.members.push(member);
    } else {
        teams.y.members.splice(ix, 1);
        teams.x.members.push(member);
    }

    broadcastGameState();
}

function handleProgressState() {

    if (state === GAME_STATE.PREGAME) {
        state = GAME_STATE.GAME;
        activeQuestion = questions[0];
    } else if (state === GAME_STATE.GAME && teams.x.lockedIn && teams.y.lockedIn) {
        state = GAME_STATE.ANSWER;
        answer = answers[activeQuestion.number - 1];
        
        // Compute new totals
        teams.x.remainingMoney = teams.x.optionsAllocated[answer];
        teams.y.remainingMoney = teams.y.optionsAllocated[answer];

    } else if (state === GAME_STATE.ANSWER) {
        if (activeQuestion.number === questions.length || teams.x.remainingMoney === 0 || teams.y.remainingMoney === 0) {
            state = GAME_STATE.FINISH;
            
            if (teams.x.remainingMoney === 0 && teams.y.remainingMoney === 0) {
                winner = 'nobody';
            } else if (teams.x.remainingMoney === 0 || teams.y.remainingMoney > teams.x.remainingMoney) {
                winner = 'y';
            } else if (teams.y.remainingMoney === 0 || teams.x.remainingMoney > teams.y.remainingMoney) {
                winner = 'x';
            } else {
                winner = 'both';
            }
        } else {
            answer = null;
            activeQuestion = questions[activeQuestion.number];
            teams.x.optionsAllocated = {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            }
            teams.y.optionsAllocated = {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            }
    
            teams.x.lockedIn = false;
            teams.y.lockedIn = false;

            state = GAME_STATE.GAME;
        }
    }

    broadcastGameState();
}

function handleLockIn(data) {
    teams[data.team].lockedIn = true;
    
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'lock'
    });

    broadcastGameState();
}

function handleResetAllocation(data) {
    teams[data.team].optionsAllocated = {
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
    let step = getDenomination(data.team);
    if (moneyRemainingThisTurn(data.team) >= step) {
        teams[data.team].optionsAllocated[data.option] += step;
    }

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'add',
        option: data.option
    });

    broadcastGameState();
}

function handleAddRemaining(data) {
    if (moneyRemainingThisTurn(data.team) > 0) {
        teams[data.team].optionsAllocated[data.option] += moneyRemainingThisTurn(data.team);
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
    if (teams[data.team].optionsAllocated[data.option] != 0) {
        teams[data.team].optionsAllocated[data.option] -= step;
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
    let member = null;
    for (let i = 0; i < teams.x.members.length; i++) {
        if (teams.x.members[i].id === idToSwap) {
            ix = i;
            team = 'x';
            member = teams.x.members[i];
            break;
        }
    }
    if (ix === null) {
        for (let i = 0; i < teams.y.members.length; i++) {
            if (teams.y.members[i].id === idToSwap) {
                ix = i;
                team = 'y';
                member = teams.y.members[i];
                break;
            }
        }
    }

    if (team === 'x') {
        teams.x.members.splice(ix, 1);
    } else {
        teams.y.members.splice(ix, 1);
    }

    let tws;
    wss.clients.forEach(c => {
        if (c.id === idToSwap) {
            tws = c;
        }
    });

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
        for (let tm of teams.x.members) {
            if (tm.id === preId) {
                found = true;
                player = tm;
                break;
            }
        }
        if (!found) {
            for (let tm of teams.y.members) {
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
        [MESSAGE_TYPE.CLIENT.JOIN]: handleJoin,
        [MESSAGE_TYPE.CLIENT.SWAP_TEAM]: handleSwapTeam,
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
function getDenomination(team) {
    if (teams[team].remainingMoney < 100) {
        return 1;
    }
    if (teams[team].remainingMoney < 1000) {
        return 10;
    }
    if (teams[team].remainingMoney < 5000) {
        return 50;
    }
    if (teams[team].remainingMoney < 10000) {
        return 100;
    }
    if (teams[team].remainingMoney < 25000) {
        return 500;
    }
    if (teams[team].remainingMoney < 50000) {
        return 1000;
    }
    if (teams[team].remainingMoney <= 100000) {
        return 5000;
    }
}

// Utility method for money remaining per turn
function moneyRemainingThisTurn(team) {
    return teams[team].remainingMoney
        - (teams[team].optionsAllocated.a
            + teams[team].optionsAllocated.b
            + teams[team].optionsAllocated.c
            + teams[team].optionsAllocated.d);
}
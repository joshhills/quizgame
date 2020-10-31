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
        text: 'There’s a spooky, scary skeleton inside all of us. But in Among Us, how many bones are there inside each (human) crewmate?',
        options: {
            a: '270',
            b: '206',
            c: '20',
            d: '1'
        }
    },
    {
        number: 2,
        text: 'In the video game Lemmings, you attempt to lead a group of tiny animals to safety that are simultaneously difficult to keep alive. In real life, while Lemmings do migrate in herds, they are perfectly normal animals. Which of these is not a myth about Lemmings?',
        options: {
            a: 'They commit mass suicide by falling off cliffs',
            b: 'They are spontaneously generated in the sky and fall to the earth like rain',
            c: 'They explode when they become sufficiently angry',
            d: 'They charge when they see the colour red'
        }
    },
    {
        number: 3,
        text: 'While there is no end to the game Tetris, after level 29 the game begins to glitch out. What is this state referred to, due to the difficulty doubling between level 28 and 29?',
        options: {
            a: 'Kill Screen',
            b: 'End Zone',
            c: 'Speedrun Gold',
            d: 'Tetronimo'
        }
    },
    {
        number: 4,
        text: 'A 2014 game spawned a meme due to a poor-taste quick-time event whereby the player is asked to “press F to pay respects” at the grave of a fallen soldier. Which game?',
        options: {
            a: 'Call of Duty: Black Ops',
            b: 'Call of Duty: Modern Resurgence',
            c: 'Call of Duty: Advanced Warfare',
            d: 'Medal of Honor: Warfighter'
        }
    },
    {
        number: 5,
        text: 'When Naughty dog were localising ‘Crash Bandicoot 2: Cortex Strikes Back’ for the Japanese market, they replaced one of the twenty-six death animations in the game, where Crash would be crushed to death leaving only his severed head and shoes. What was the reason for this censorship?',
        options: {
            a: 'The shoes were Air Jordans',
            b: 'It reminded people of a serial killer on the loose',
            c: 'Cultural etiquette forbade unattended shoes outdoors',
            d: 'The death was deemed too brutal for the intended age rating'
        }
    },
    {
        number: 6,
        text: 'In the month after Dark Souls II’s release in 2014, how many players died on average every second?',
        options: {
            a: '4',
            b: '42',
            c: '110',
            d: '2,410'
        }
    },
    {
        number: 7,
        text: 'In the Greek mythology that inspired the game Hades, there are six rivers visible in the underworld. Their names were meant to reflect the emotions associated with death. Which of these is not a river?',
        options: {
            a: 'Phobos (Fear)',
            b: 'Lethe (Forgetfulness)',
            c: 'Phlegethon (Fire)',
            d: 'Styx (Hatred)'
        }
    },
    {
        number: 8,
        text: 'The 1980s dungeon crawling game Rogue was the first game to feature ‘permadeath’, which inspired a subgenre of “roguelikes”; should the player lose all their health from combat or other means, they must start afresh without loading from a saved state. Why was intentional design choice made?',
        options: {
            a: 'To pad the runtime as publishers thought content was lacking',
            b: 'The Amiga did not have enough memory to support large save files',
            c: 'Playtesters were repeatedly reloading save files to obtain the best results',
            d: 'The developers wanted to make the hardest game ever made'
        }
    },
    {
        number: 9,
        text: 'In the core series of Pokémon games, when all of the Pokémon on the your team faint, you’re greeted with something comparable to a game over screen with a message. In Japanese versions of the first generation games, the player is said to “lose hope”, before typically reappearing at a Pokémon centre. Which of these is not a game over message to appear in the English versions?',
        options: {
            a: '<player> whited out!',
            b: 'You were overwhelmed by your defeat!',
            c: '<player> blacked out!',
            d: 'You faded away…'
        }
    },
    {
        number: 10,
        text: 'Which of these video game characters could survive skinny-dipping?',
        options: {
            a: 'Blue Pikmin',
            b: 'Altair',
            c: 'John Marston',
            d: 'Tommy Vercetti'
        }
    },
    {
        number: 11,
        text: 'The void is the name given to the empty space below the overworld in Minecraft, barred by an impenetrable protective layer of ‘bedrock’ at the bottom. You can reach it by digging directly down, but how many layers of bedrock are there at the bottom of the world, separating you from this void?',
        options: {
            a: '1',
            b: '3',
            c: '5',
            d: '7'
        }
    },
    {
        number: 12,
        text: 'In GTA: London, which was a DLC pack for the original GTA game, the “WASTED” message that appears when you die is replaced by which message?',
        options: {
            a: 'You’re apples and pears!',
            b: 'You’re brown bread!',
            c: 'You’re nicked!',
            d: 'You’re cozzers!'
        }
    },
    {
        number: 13,
        text: 'Muammar al-Gaddafi was a Libyan politician who was assassinated in 2011, after 41 years of totalitarian rule. Watching a supposed mobile camera capture from the ruins of his ousted regime, gaming news sites spotted something strange on one of the walls – a giant reproduction of the cover art to a 2004 game. It seems Moatassem-Billah Gaddafi, son to an overthrown ruler, with his long, dark hair, had found some parallels with the main character depicted. Which video game series was the art work from?',
        options: {
            a: 'Prince of Persia',
            b: 'Assassin’s Creed',
            c: 'Castlevania',
            d: 'Fire Emblem'
        }
    },
    {
        number: 14,
        text: 'According to a report by Game, as of September 2020, Fortnite is the most-played game worldwide in terms of cumulative time spent in-game. With the knowledge that modern humans have been on the planet for 200,000 years, how many more times than that has Fortnite been played?',
        options: {
            a: '52 times longer than humans have been on the planet',
            b: '2 times longer than humans have been on the planet',
            c: '20 times longer than humans have been on the planet',
            d: '6 times longer than humans been on the planet'
        }
    },
    {
        number: 15,
        text: 'Sometimes developers have been known to include memorials in their games to people who have passed away. Which of these games does not have an in-game memorial added by developers?',
        options: {
            a: 'Star Trek Online',
            b: 'Overwatch',
            c: 'Middle-Earth: Shadow of War',
            d: 'Amnesia: The Dark Descent'
        }
    }
];

const answers = [
    'd',
    'd',
    'a',
    'c',
    'b',
    'b',
    'a',
    'c',
    'd',
    'a',
    'c',
    'b',
    'a',
    'a',
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
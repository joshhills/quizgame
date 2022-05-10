import { MESSAGE_TYPE, GAME_STATE, sendMessage, formatMessage, handleMessage, getClientById, MAX_TEAM_SIZE, QUESTION_BUFFER_TIME_MS, SHOW_ALLOCATIONS_TIMER_MS, ACHIEVEMENT, sanitizeHTML } from './static/shared.js';

import express from 'express';
import fetch from 'node-fetch';
import fileUpload from 'express-fileupload';
import pkg from 'ws';
const { Server } = pkg;
import * as uuid from 'uuid';
import url from 'url';

const PORT = process.env.PORT || 3000;

let server = express()
  .use('/quiz', express.static('./static'))
  .use(fileUpload());

// Support quiz file upload
server.post('/quiz/upload-quiz', async (req, res) => {
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            // Use the name of the input field (i.e. "avatar") to retrieve the uploaded file
            let quiz = req.files.quiz;

            if (quiz.data) {
                // console.log(quiz.data.toString('ascii'));
                let quizObj = JSON.parse(quiz.data.toString());

                if (quizObj.name && quizObj.questions && quizObj.questions.length > 0) {
                    quizName = quizObj.name;
                    questions = quizObj.questions;
                    allowHints = quizObj.allowHints;
                    numHints = quizObj.numHints;
                    secondsPerQuestion = quizObj.secondsPerQuestion;
                    startingMoney = quizObj.startingMoney;
                    incrementEachRound = quizObj.incrementEachRound;

                    if (state === GAME_STATE.PREGAME) {
                        for (let team of teams) {
                            team.remainingHints = numHints;
                            team.remainingMoney = startingMoney;
                        }
                    }

                    broadcastGameState();

                    res.send({
                        status: true
                    });
                } else {
                    res.send({
                        status: false,
                        message: 'Malformed input'
                    });
                }
            }
        }
    } catch (err) {
        console.log(err);

        res.status(500).send(err);
    }
});

server.get('/quiz/imageExists', async(req, res) => {
    const imageUrl = decodeURIComponent(req.query.url);

    try {
        await fetch(imageUrl)
        .then(newRes => {
            if (newRes.ok) {
                res.sendStatus(200);
            } else {
                res.sendStatus(204);
            }
        }).catch(() => {
            res.sendStatus(204);
        });
    }
    catch (e) {
        res.sendStatus(204);
    }
});

server = server.listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server, path: '/quiz' });

/** Bootstrap game state */

let startingMoney  = 100;
let allowHints = true;
let numHints = 1;
let secondsPerQuestion = 60;
let incrementEachRound = 100;
let fastestFingerBonus = 0;

let state = GAME_STATE.PREGAME,
    questions = [],
    quizName = null,
    activeQuestion = null,
    activeQuestionIndex = 0,
    teams = null,
    winners = null,
    showImage = false,
    showAllocations = false,
    historicData = {},
    optionATotalAllocationThisRound = 0,
    optionBTotalAllocationThisRound = 0,
    optionCTotalAllocationThisRound = 0,
    optionDTotalAllocationThisRound = 0,
    totalLostThisRound = 0,
    totalGainedThisRound = 0,
    teamsKnockedOutThisRound = [],
    totalAllocationAllThisRound = 0,
    advanceTimer = -1,
    fastestTime = null,
    fastestTeam = null,
    fastestTimeCorrect = null,
    fastestTeamCorrect = null;

reset();

/** Handle WS Messaging */

// Clear the game state
function reset() {
    state = GAME_STATE.PREGAME;
    activeQuestion = null;
    activeQuestionIndex = 0;
    teams = [];
    winners = null;
    historicData = {};
    showImage = false;
    showAllocations = false;
    optionATotalAllocationThisRound = 0;
    optionBTotalAllocationThisRound = 0;
    optionCTotalAllocationThisRound = 0;
    optionDTotalAllocationThisRound = 0;
    totalLostThisRound = 0;
    totalGainedThisRound = 0;
    teamsKnockedOutThisRound = [];
    totalAllocationAllThisRound = 0;
    fastestTime = null;
    fastestTeam = null;
    fastestTimeCorrect = null;
    fastestTeamCorrect = null;
}

function broadcastGameState() {

    let _activeQuestion = null;
    if (activeQuestion) {
        _activeQuestion = {
            text: activeQuestion.text,
            options: activeQuestion.options,
            // Don't send answer to clients if they're mid-guessing!
            answer: state === GAME_STATE.GAME ? null : activeQuestion.answer,
            imageUrl: state === GAME_STATE.GAME ? activeQuestion.preImageUrl : activeQuestion.postImageUrl,
            additionalText: activeQuestion.additionalText ? activeQuestion.additionalText : '',
            timeBegan: activeQuestion.timeBegan
        };
    }

    const gameState = {
        quizName: quizName,
        scene: state,
        allowHints: allowHints,
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
        totalGainedThisRound: totalGainedThisRound,
        teamsKnockedOutThisRound: teamsKnockedOutThisRound,
        totalAllocationAllThisRound: totalAllocationAllThisRound,
        secondsPerQuestion: secondsPerQuestion,
        fastestTime: fastestTime,
        fastestTeam: fastestTeam,
        fastestTimeCorrect: fastestTimeCorrect,
        fastestTeamCorrect: fastestTeamCorrect
    };

    broadcast(MESSAGE_TYPE.SERVER.STATE_CHANGE, {state: gameState});
}

function handleProgressState() {

    if (state === GAME_STATE.PREGAME && teams.length > 0 && questions.length > 0) {
        state = GAME_STATE.GAME;
        activeQuestion = questions[0];
        activeQuestion.timeBegan = Date.now();
    
        // Auto-advance question if we have a time-limit per question
        if (secondsPerQuestion > 0) {
            clearTimeout(advanceTimer);
            advanceTimer = setTimeout(() => {
                handleProgressState();
            }, secondsPerQuestion * 1000 + QUESTION_BUFFER_TIME_MS);
        }

        // Force ready everyone up
        for (let team of teams) {
            for (let tm of team.members)
            tm.ready = true;
        }
    } else if (state === GAME_STATE.GAME) {
        state = GAME_STATE.ANSWER;
        showImage = false;
        showAllocations = false;

        // Set up historic data
        if (!historicData.perTurn) {
            historicData.perTurn = {};
        }

        historicData.perTurn[activeQuestionIndex] = {
            teams: {},
            allocations: {}
        };
        historicData.globalData = {
            teams: {}
        }
        
        // Compute total allocations for this round
        optionATotalAllocationThisRound = 0;
        optionBTotalAllocationThisRound = 0;
        optionCTotalAllocationThisRound = 0;
        optionDTotalAllocationThisRound = 0;
        
        totalLostThisRound = 0;
        totalGainedThisRound = 0;

        teamsKnockedOutThisRound = [];

        const currentAnswer = activeQuestion.answer;
        const currentAnswerTime = activeQuestion.timeBegan;

        // Make sure values are reset
        fastestTime = null;
        fastestTeam = null;
        let fastestTeamWasSloppy = false;
        fastestTimeCorrect = null;
        fastestTeamCorrect = null;

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

            team.lastAllIn = beforeDeduction === team.optionsAllocated.a
                || beforeDeduction === team.optionsAllocated.b
                || beforeDeduction === team.optionsAllocated.c
                || beforeDeduction === team.optionsAllocated.d;

            // team.remainingMoney = team.optionsAllocated[questions[activeQuestionIndex].answer];
            let losses = 0;
            let winnings = team.optionsAllocated[currentAnswer];
            for (let option of ['a', 'b', 'c', 'd']) {
                if (option !== currentAnswer) {
                    losses += team.optionsAllocated[option];
                }
            }
            team.remainingMoney -= losses;
            team.remainingMoney += winnings;

            // Compute total lost for this round
            totalLostThisRound += losses;
            totalGainedThisRound += winnings;

            let wasKnockedOut = false;
            // Compute those who were knocked out this round
            if (wasAlive && team.remainingMoney === 0) {
                teamsKnockedOutThisRound.push(team.teamName);
                wasKnockedOut = true;
            }

            // Log whether or not the team gained or lost money
            team.lastMoney = beforeDeduction;
            team.lastChange = team.remainingMoney - beforeDeduction;

            // Eligibility for fastest finger
            if (team.lockedIn) {
                // If nobody's been set yet
                const elapsed = team.lockedInTime - currentAnswerTime;

                if (team.lastChange !== 0 && ((fastestTeam === null || fastestTime === null) || elapsed < fastestTime)) {
                    fastestTime = elapsed;
                    fastestTeam = team.teamName;

                    fastestTeamWasSloppy = team.lastChange < 0;
                }

                if (team.lastChange > 0 && ((fastestTeamCorrect === null || fastestTimeCorrect === null) || elapsed < fastestTimeCorrect)) {
                    fastestTimeCorrect = elapsed;
                    fastestTeamCorrect = team.teamName;
                }
            }

            // Tally per-turn data
            historicData.perTurn[activeQuestionIndex].teams[team.teamName] = {
                before: beforeDeduction,
                change: team.lastChange,
                after: team.remainingMoney,
                usedHint: team.activeHint !== null,
                wentAllIn: team.lastAllIn,
                wasKnockedOut: wasKnockedOut
            };

            // Init global data
            if (!historicData.globalData.teams[team.teamName]) {
                historicData.globalData.teams[team.teamName] = {
                    numTurnsUsedHints: 0,
                    numTimesKnockedOut: 0,
                    numTurnsSloppiestFinger: 0,
                    numTurnsFastestFinger: 0,
                    totalMoneyGained: 0,
                    totalMoneyLost: 0,
                    longestGainStreak: 0,
                    numTurnsWentAllIn: 0
                };
            }

            // Tally global data
            if (team.activeHint !== null) {
                historicData.globalData.teams[team.teamName].numTurnsUsedHints ++;
            }
            if (wasKnockedOut) {
                historicData.globalData.teams[team.teamName].numTimesKnockedOut++;
            }
            if (team.lastAllIn) {
                historicData.globalData.teams[team.teamName].numTurnsWentAllIn++;
            }

            if (team.lastChange > 0) {
                team.currentGainStreak++;

                if (team.currentGainStreak > historicData.globalData.teams[team.teamName].longestGainStreak) {
                    historicData.globalData.teams[team.teamName].longestGainStreak = team.currentGainStreak;
                }
            } else {
                historicData.globalData.teams[team.teamName].longestGainStreak = team.currentGainStreak;
                team.currentGainStreak = 0;
            }

            historicData.globalData.teams[team.teamName].totalMoneyGained += winnings;
            historicData.globalData.teams[team.teamName].totalMoneyLost += losses;
        }

        if (fastestTeam && fastestTeamWasSloppy) {
            historicData.globalData.teams[fastestTeam].numTurnsSloppiestFinger++;
        }
        if (fastestTeamCorrect) {
            historicData.globalData.teams[fastestTeamCorrect].numTurnsFastestFinger++;
        }

        totalAllocationAllThisRound = optionATotalAllocationThisRound
            + optionBTotalAllocationThisRound
            + optionCTotalAllocationThisRound
            + optionDTotalAllocationThisRound;

        historicData.perTurn[activeQuestionIndex].allocations = {
            optionATotalAllocation: optionATotalAllocationThisRound,
            optionBTotalAllocation: optionBTotalAllocationThisRound,
            optionCTotalAllocation: optionCTotalAllocationThisRound,
            optionDTotalAllocation: optionDTotalAllocationThisRound,
            allTotalAllocation: totalAllocationAllThisRound
        };

        // Sort teams by new scores
        teams.sort((a, b) => b.remainingMoney - a.remainingMoney);
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].lastPlace !== null) {
                teams[i].placesMoved = teams[i].lastPlace - i;
            }

            teams[i].lastPlace = i;
        }

        clearTimeout(advanceTimer);
        advanceTimer = -1;

        if (SHOW_ALLOCATIONS_TIMER_MS !== -1) {
            setTimeout(() => {
                if (state === GAME_STATE.ANSWER && !showAllocations) {
                    showAllocations = true;
                    broadcastGameState();
                }
            }, SHOW_ALLOCATIONS_TIMER_MS);
        }
    } else if (state === GAME_STATE.ANSWER) {
        showImage = false;
        showAllocations = false;
        state = GAME_STATE.SCORES;
        clearTimeout(advanceTimer);
        advanceTimer = -1;
    } else if (state === GAME_STATE.SCORES) {
        showImage = false;
        // const _allTeamsOrAllButOneBankrupt = allTeamsOrAllButOneBankrupt();
        if (activeQuestionIndex === questions.length - 1) {
            state = GAME_STATE.FINISH;
            
            winners = getTeamsWithMostMoney();
            computeAchievements();
        } else {
            activeQuestionIndex++;
            activeQuestion = questions[activeQuestionIndex];
            activeQuestion.timeBegan = Date.now();

            // Auto-advance question if we have a time-limit per question
            if (secondsPerQuestion > 0) {
                clearTimeout(advanceTimer);
                advanceTimer = setTimeout(() => {
                    handleProgressState();
                }, secondsPerQuestion * 1000 + QUESTION_BUFFER_TIME_MS);
            }

            for (let team of teams) {
                // Give every team a base amount each turn
                if (incrementEachRound) {
                    team.remainingMoney += incrementEachRound;    
                }

                // Apply fastest finger bonus...
                // TODO: Do we want this?
                if (team.teamName === fastestTeamCorrect) {
                    team.remainingMoney += fastestFingerBonus;
                }

                team.optionsAllocated = {
                    a: 0,
                    b: 0,
                    c: 0,
                    d: 0
                };
                team.lockedIn = false;
                team.lockedInTime = null;
                team.activeHint = null;
            }

            optionATotalAllocationThisRound = 0;
            optionBTotalAllocationThisRound = 0;
            optionCTotalAllocationThisRound = 0;
            optionDTotalAllocationThisRound = 0;
            totalLostThisRound = 0;
            totalGainedThisRound = 0;
            teamsKnockedOutThisRound = [];
            totalAllocationAllThisRound = 0;

            state = GAME_STATE.GAME;
        }
    }

    broadcastGameState();
}

function handleLockIn(data) {
    let team = getTeamByName(sanitizeHTML(data.team));

    team.lockedIn = true;
    team.lockedInTime = Date.now();
    
    // TODO: only send to teammates
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'lock'
    });

    broadcastGameState();
}

function handleResetAllocation(data) {
    let team = getTeamByName(sanitizeHTML(data.team));

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
    let team = getTeamByName(sanitizeHTML(data.team));

    if (team.activeHint && team.activeHint.indexOf(data.option) !== -1) {
        // Don't add money to active hint
        return;
    }

    let step = getDenomination(sanitizeHTML(data.team));
    if (moneyRemainingThisTurn(sanitizeHTML(data.team)) >= step) {
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

    let teamName = sanitizeHTML(data.team);
    let playerName = sanitizeHTML(data.as);

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

    if (state !== GAME_STATE.PREGAME) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team while quiz in progress" });
        return;
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
            remainingMoney: startingMoney,
            optionsAllocated: {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            },
            lockedIn: false,
            lockedInTime: null,
            solo: false,
            remainingHints: numHints,
            activeHint: null,
            lastChange: null,
            lastAllIn: false,
            currentGainStreak: 0,
            lastPlace: null,
            placesMoved: 0,
            achievements: []
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
        sendMessage(_tws, MESSAGE_TYPE.SERVER.TEAM_CHAT, { name: player.name, message: sanitizeHTML(data.message.substring(0, 256)) });
    }
}

function handleJoinTeam(data) {

    let tws = getClientById(wss, data.id.id);
    
    let teamName = sanitizeHTML(data.team);
    let playerName = sanitizeHTML(data.as);

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join a team with an empty name!" });
        return;
    }

    if (!playerName || /^\s*$/.test(playerName)) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join a team with an empty player name!" });
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

            // Check max team size
            if (team.members.length === MAX_TEAM_SIZE) {
                sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: `Team '${team.teamName}' is full!` });
                return;
            }

            team.members.push({
                name: playerName,
                id: data.id.id,
                ready: false
            });

            sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: sanitizeHTML(data.as) });
            broadcastGameState();
            return;
        }
    }

    sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Team not found" });
}

function handleJoinSolo(data) {

    let tws = getClientById(wss, data.id.id);
    let teamName = sanitizeHTML(data.as);

    if (state !== GAME_STATE.PREGAME) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join a quiz in progress as a solo player" });
        return;
    }

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

    // Create a team based on their name and use it
    teams.push(
        {
            teamName: teamName,
            members: [
                {
                    name: sanitizeHTML(data.as),
                    id: data.id.id,
                    ready: false
                }
            ],
            remainingMoney: startingMoney,
            optionsAllocated: {
                a: 0,
                b: 0,
                c: 0,
                d: 0
            },
            lockedIn: false,
            lockedInTime: null,
            solo: true,
            remainingHints: numHints,
            activeHint: null,
            lastChange: null,
            lastAllIn: false,
            currentGainStreak: 0,
            lastPlace: null,
            placesMoved: 0,
            achievements: []
        }
    );

    if (didRename) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: `Changed your solo team name as there was already a '${sanitizeHTML(data.as)}'` });
    }
    sendMessage(tws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: sanitizeHTML(data.as), solo: true });
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
    let team = getTeamByName(sanitizeHTML(data.team)); 
    
    if (team.activeHint && team.activeHint.indexOf(data.option) !== -1) {
        // Don't add money to active hint
        return;
    }

    if (moneyRemainingThisTurn(sanitizeHTML(data.team)) > 0) {
        team.optionsAllocated[data.option] += moneyRemainingThisTurn(sanitizeHTML(data.team));
    }

    // TODO: only send to teammates
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'add',
        option: data.option
    });

    broadcastGameState();
}

function handleRemoveAll(data) {
    let team = getTeamByName(sanitizeHTML(data.team)); 

    team.optionsAllocated[data.option] = 0;

    // TODO: only send to teammates
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id.id,
        type: 'remove',
        option: data.option
    });

    broadcastGameState();
}

function handleMinusOption(data) {
    let step = getDenomination(sanitizeHTML(data.team));
    let team = getTeamByName(sanitizeHTML(data.team));
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
        for (let j = 0; j < teams[i].members.length; j++) {
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

function handleUseHint(data) {
    
    const tws = getClientById(wss, data.id.id);

    // Get player's team based on their ID
    const team = getTeamById(data.id.id);

    if (team.lockedIn) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    if (team.activeHint) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You already have a hint" });
        return;
    }

    if (!activeQuestion) {
        console.error('Client attempted to use hint but there is no active question');
        return;
    }

    if (!allowHints) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Hints are not enabled for this game!" });
        return;
    }

    if (team.hintsRemaining <= 0) {
        sendMessage(tws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "No more hints remaining!" });
        return;
    }

    // Randomise their hint and apply it to their team data
    // TODO: Exclude the data from broadcast in the game state
    const answer = activeQuestion.answer;
    const hint = Object.keys(activeQuestion.options)
        .filter(val => val !== answer)
        .sort(() => 0.5 - Math.random())
        .slice(0, 2);

    // Decrement hints remaining
    team.remainingHints--;
    team.activeHint = hint;

    // Re-allocate money
    team.optionsAllocated[team.activeHint[0]] = 0;
    team.optionsAllocated[team.activeHint[1]] = 0;

    // Broadcast the state to the team
    // TODO: Only send to teammates
    broadcastGameState();
}

// Handle disconnection
function handleClose() {
    // console.log(`Client ${this.id} disconnected`);
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
        [MESSAGE_TYPE.CLIENT.PROGRESS_STATE]: { handler: handleProgressState, rateLimit: { atomic: true, rate: { hits: 1, perMs: 2000 } } },
        [MESSAGE_TYPE.CLIENT.LOCK_IN]: { handler: handleLockIn },
        [MESSAGE_TYPE.CLIENT.RESET_ALLOCATION]: { handler: handleResetAllocation },
        [MESSAGE_TYPE.CLIENT.ADD_OPTION]: { handler: handleAddOption },
        [MESSAGE_TYPE.CLIENT.ADD_REMAINING]: { handler: handleAddRemaining },
        [MESSAGE_TYPE.CLIENT.REMOVE_ALL]: { handler: handleRemoveAll },
        [MESSAGE_TYPE.CLIENT.MINUS_OPTION]: { handler: handleMinusOption },
        [MESSAGE_TYPE.CLIENT.RESET]: { handler: handleReset },
        [MESSAGE_TYPE.CLIENT.KICK]: { handler: handleKick },
        [MESSAGE_TYPE.CLIENT.NOTIFY]: { handler: handleNotify },
        [MESSAGE_TYPE.CLIENT.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
        [MESSAGE_TYPE.CLIENT.TEAM_CHAT]: { handler: handleTeamChat, rateLimit: { rate: { hits: 2, perMs: 1500 } } },
        [MESSAGE_TYPE.CLIENT.TOGGLE_IMAGE]: { handler: handleToggleImage },
        [MESSAGE_TYPE.CLIENT.TOGGLE_ALLOCATIONS]: { handler: handleToggleAllocations },
        [MESSAGE_TYPE.CLIENT.EMOTE]: { handler: handleEmote, rateLimit: { rate: { hits: 4, perMs: 2000 } } },
        [MESSAGE_TYPE.CLIENT.USE_HINT]: { handler: handleUseHint, rateLimit: { rate: { hits: 1, perMs: 5000 } } }
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
    if (team.remainingMoney < 100000) {
        return 5000;
    }
    return 10000;
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

function getTeamById(id) {
    
    for (let team of teams) {
        for (let tm of team.members) {
            if (tm.id === id) {
                return team;
            }
        }
    }

    console.error('Attempted to get team by ID but no team found');
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

function computeAchievements() {

    let highestNumTimesKnockedOut = -1;
    let prospectiveHighestNumTimesKnockedOut = [];

    let highestNumTurnsSloppiestFinger = -1;
    let prospectiveHighestNumTurnsSloppiestFinger = [];

    let highestNumTurnsFastestFinger = -1;
    let prospectiveHighestNumTurnsFastestFinger = [];

    let highestTotalMoneyGained = -1;
    let prospectiveHighestTotalMoneyGained = [];

    let highestTotalMoneyLost = -1;
    let prospectiveHighestTotalMoneyLost = [];

    let highestNumTurnsWentAllIn = -1;
    let prospectiveHighestNumTurnsWentAllIn = [];

    for (let team of teams) {

        // Compute winner
        if (winners.indexOf(team.teamName) !== -1) {
            team.achievements.push(ACHIEVEMENT.WINNER);
        }

        // Compute streaks
        const longestStreak = historicData.globalData.teams[team.teamName].longestGainStreak;
        if (longestStreak === questions.length) {
            team.achievements.push(ACHIEVEMENT.ALL_CORRECT);
        }
        if (longestStreak >= 15) {
            team.achievements.push(ACHIEVEMENT.FIFTEEN_IN_A_ROW);
        }
        if (longestStreak >= 10) {
            team.achievements.push(ACHIEVEMENT.TEN_IN_A_ROW);
        }
        if (longestStreak >= 5) {
            team.achievements.push(ACHIEVEMENT.FIVE_IN_A_ROW);
        }
        
        // Compute hints
        if (historicData.globalData.teams[team.teamName].numTurnsUsedHints === 0) {
            team.achievements.push(ACHIEVEMENT.NO_HINTS_USED);
        }

        // Store totals
        if (historicData.globalData.teams[team.teamName].numTimesKnockedOut > 0 &&
            historicData.globalData.teams[team.teamName].numTimesKnockedOut > highestNumTimesKnockedOut) {
            prospectiveHighestNumTimesKnockedOut = [team.teamName];
        } else if (historicData.globalData.teams[team.teamName].numTimesKnockedOut === highestNumTimesKnockedOut) {
            prospectiveHighestNumTimesKnockedOut.push(team.teamName);
        }

        if (historicData.globalData.teams[team.teamName].numTurnsSloppiestFinger > 0 &&
            historicData.globalData.teams[team.teamName].numTurnsSloppiestFinger > highestNumTurnsSloppiestFinger) {
            prospectiveHighestNumTurnsSloppiestFinger = [team.teamName];
        } else if (historicData.globalData.teams[team.teamName].numTurnsSloppiestFinger === highestNumTurnsSloppiestFinger) {
            prospectiveHighestNumTurnsSloppiestFinger.push(team.teamName);
        }

        if (historicData.globalData.teams[team.teamName].numTurnsFastestFinger > 0 &&
            historicData.globalData.teams[team.teamName].numTurnsFastestFinger > highestNumTurnsFastestFinger) {
            prospectiveHighestNumTurnsFastestFinger = [team.teamName];
        } else if (historicData.globalData.teams[team.teamName].numTurnsFastestFinger === highestNumTurnsFastestFinger) {
            prospectiveHighestNumTurnsFastestFinger.push(team.teamName);
        }

        if (historicData.globalData.teams[team.teamName].totalMoneyGained > 0 &&
            historicData.globalData.teams[team.teamName].totalMoneyGained > highestTotalMoneyGained) {
            prospectiveHighestTotalMoneyGained = [team.teamName];
        } else if (historicData.globalData.teams[team.teamName].totalMoneyGained === highestTotalMoneyGained) {
            prospectiveHighestTotalMoneyGained.push(team.teamName);
        }

        if (historicData.globalData.teams[team.teamName].totalMoneyLost > 0 &&
            historicData.globalData.teams[team.teamName].totalMoneyLost > highestTotalMoneyLost) {
            prospectiveHighestTotalMoneyLost = [team.teamName];
        } else if (historicData.globalData.teams[team.teamName].totalMoneyLost === highestTotalMoneyLost) {
            prospectiveHighestTotalMoneyLost.push(team.teamName);
        }

        if (historicData.globalData.teams[team.teamName].numTurnsWentAllIn > 0 &&
            historicData.globalData.teams[team.teamName].numTurnsWentAllIn > highestNumTurnsWentAllIn) {
            prospectiveHighestNumTurnsWentAllIn = [team.teamName];
        } else if (historicData.globalData.teams[team.teamName].numTurnsWentAllIn === highestNumTurnsWentAllIn) {
            prospectiveHighestNumTurnsWentAllIn.push(team.teamName);
        }
    }

    for (const team of prospectiveHighestNumTimesKnockedOut) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.MOST_KNOCKED_OUT);
    }

    for (const team of prospectiveHighestNumTurnsSloppiestFinger) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.MOST_CLUMSY_FINGERS);
    }

    for (const team of prospectiveHighestNumTurnsFastestFinger) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.MOST_FASTEST_FINGERS);
    }

    for (const team of prospectiveHighestTotalMoneyGained) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.HIGHEST_GAINS);
    }

    for (const team of prospectiveHighestTotalMoneyLost) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.HIGHEST_LOSSES);
    }

    for (const team of prospectiveHighestNumTurnsWentAllIn) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.MOST_ALL_INS);
    }
}
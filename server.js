import { MESSAGE_TYPE, GAME_STATE, sendMessage, formatMessage, handleMessage, MAX_TEAM_SIZE, QUESTION_BUFFER_TIME_MS, SHOW_ALLOCATIONS_TIMER_MS, ACHIEVEMENT, sanitizeHTML, LOG_TYPE } from './static/shared.js';

import express from 'express';
import fetch from 'node-fetch';
import fileUpload from 'express-fileupload';
import pkg from 'ws';
const { Server } = pkg;
import * as uuid from 'uuid';
import url from 'url';
import * as stringSimilarity from 'string-similarity';

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
                    quizName = quizObj.name || "Quiz";
                    questions = quizObj.questions || [];
                    allowHints = quizObj.allowHints || false;
                    numHints = quizObj.numHints || 0;
                    defaultSecondsPerQuestion = quizObj.secondsPerQuestion || 0;
                    secondsPerQuestion = defaultSecondsPerQuestion;
                    startingMoney = quizObj.startingMoney || 100;
                    incrementEachRound = quizObj.incrementEachRound || 0;
                    bonusValue = quizObj.bonusValue || 0;

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

server.use((_req, res) => {
    // Handle 404s
    res.redirect('/quiz');
});

server = server.listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server, path: '/quiz' });

/** Bootstrap game state */

let startingMoney  = 100;
let allowHints = true;
let numHints = 1;
let defaultSecondsPerQuestion = 60;
let secondsPerQuestion = 60;
let incrementEachRound = 0;
let bonusValue = 0;

let spectators = [],
    hosts = [],
    clients = [],
    state = GAME_STATE.PREGAME,
    questions = [],
    quizName = null,
    activeQuestion = null,
    activeQuestionIndex = 0,
    teams = null,
    teamIndex = null,
    achievements = {},
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
    teamIndex = {};
    achievements = {};
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

function broadcastGameState(options = {}) {

    let _activeQuestion = null;
    if (activeQuestion) {
        _activeQuestion = {
            round: activeQuestion.round,
            text: activeQuestion.text,
            options: activeQuestion.options,
            numOptions: activeQuestion.numOptions,
            // Don't send answer to clients if they're mid-guessing!
            answer: state === GAME_STATE.GAME ? null : activeQuestion.answer,
            answersFreeText: state === GAME_STATE.GAME ? null : activeQuestion.answersFreeText,
            imageUrl: state === GAME_STATE.GAME ? activeQuestion.preImageUrl : activeQuestion.postImageUrl,
            additionalText: activeQuestion.additionalText ? activeQuestion.additionalText : '',
            timeBegan: activeQuestion.timeBegan,
            questionType: activeQuestion.questionType
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
        fastestTeamCorrect: fastestTeamCorrect,
        achievements: achievements,
        now: Date.now()
    };

    if (state === GAME_STATE.GAME) {

        let preExistingTransformation = options.transformation;

        options.transformation = (ws, data) => {
            
            if (preExistingTransformation) {
                data = preExistingTransformation(ws, data);
            }
    
            // Filter out in-progress data from other teams (prevent digital shoulder-peeking)
            let _teams = []

            for (let team of data.state.teams) {
                
                // Check if it's this player's team, if so, leave alone
                let found = false;
                for (let member of team.members) {
                    if (ws.id === member.id) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    _teams.push(team)
                    continue;
                }
                
                // Otherwise, add a truncated version
                _teams.push({
                    teamName: team.teamName,
                    members: team.members,
                    solo: team.solo
                });

                data.teams = _teams;
            }
        }
    }

    broadcast(MESSAGE_TYPE.SERVER.STATE_CHANGE, { state: gameState }, options);
}

function isFreeTextAnswerCorrect(guess, acceptedAnswers) {

    if (guess === undefined || guess === null || guess === '') {
        return false;
    }

    if (guess.trim() === '') {
        return false;
    }

    for (let acceptedAnswer of acceptedAnswers) {
        let guessClean = guess.trim().toLowerCase();
        let answerClean = acceptedAnswer.trim().toLowerCase();
        if (guessClean === answerClean || stringSimilarity.compareTwoStrings(guessClean, answerClean) > 0.9) {
            return true;
        }
    }

    return false;
}

function handleProgressState(ws) {

    if (state === GAME_STATE.PREGAME && teams.length > 0 && questions.length > 0) {
        state = GAME_STATE.GAME;
        activeQuestion = questions[0];
        activeQuestion.timeBegan = Date.now();
    
        // Auto-advance question if we have a time-limit per question
        if (secondsPerQuestion > 0) {
            clearTimeout(advanceTimer);
            advanceTimer = setTimeout(() => {
                handleProgressState(ws);
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

        if (!historicData.globalData) {
            historicData.globalData = {
                teams: {}
            }
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
        const currentAnswersFreeText = activeQuestion.answersFreeText;
        const currentAnswerTime = activeQuestion.timeBegan;

        // Make sure values are reset
        fastestTime = null;
        fastestTeam = null;
        let fastestTeamWasSloppy = false;
        fastestTimeCorrect = null;
        fastestTeamCorrect = null;

        for (let team of teams) {

            let wasAlive = false;
            if (team.score > 0) {
                wasAlive = true;
            }

            optionATotalAllocationThisRound += team.optionsAllocated.a;
            optionBTotalAllocationThisRound += team.optionsAllocated.b;
            optionCTotalAllocationThisRound += team.optionsAllocated.c;
            optionDTotalAllocationThisRound += team.optionsAllocated.d;

            // Compute new team totals
            let beforeDeduction = team.score;

            team.lastWagered = team.optionsAllocated.a + team.optionsAllocated.b
                + team.optionsAllocated.c + team.optionsAllocated.d; 

            team.lastAllIn = 
                (startingMoney === team.optionsAllocated.a
                || startingMoney === team.optionsAllocated.b
                || startingMoney === team.optionsAllocated.c
                || startingMoney === team.optionsAllocated.d);

            // team.remainingMoney = team.optionsAllocated[questions[activeQuestionIndex].answer];
            let losses = 0;
            let winnings = 0;
            
            if (activeQuestion.questionType === 'freeText') {
                for (let option of ['a', 'b', 'c', 'd']) {
                    if (isFreeTextAnswerCorrect(team.freeTextGuesses[option], currentAnswersFreeText)) {
                        winnings += team.optionsAllocated[option];
                    } else {
                        losses += team.optionsAllocated[option];
                    }
                }
            } else if (activeQuestion.questionType === 'multipleChoice') {
                winnings = team.optionsAllocated[currentAnswer];
                for (let option of ['a', 'b', 'c', 'd']) {
                    if (option !== currentAnswer) {
                        losses += team.optionsAllocated[option];
                    }
                }
            }

            team.lastGained = winnings;
            team.lastLost = losses;

            team.score -= losses;
            team.score += winnings;

            // Compute total lost for this round
            totalLostThisRound += losses;
            totalGainedThisRound += winnings;

            let wasKnockedOut = false;
            // Compute those who were knocked out this round
            if (wasAlive && team.score <= 0) {
                teamsKnockedOutThisRound.push(team.teamName);
                wasKnockedOut = true;
            }

            // Log whether or not the team gained or lost money
            team.lastMoney = beforeDeduction;
            team.lastChange = team.score - beforeDeduction;

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
                after: team.score,
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
                historicData.globalData.teams[team.teamName].numTurnsUsedHints++;
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
        teams.sort((a, b) => b.score - a.score);
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
                    handleProgressState(ws);
                }, secondsPerQuestion * 1000 + QUESTION_BUFFER_TIME_MS);
            }

            for (let team of teams) {
                // Give every team a base amount each turn
                if (incrementEachRound) {
                    team.score += incrementEachRound;    
                }

                // Apply fastest finger bonus...
                // TODO: Do we want this?
                if (team.teamName === fastestTeamCorrect) {
                    team.score += bonusValue;
                }

                team.optionsAllocated = {
                    a: 0,
                    b: 0,
                    c: 0,
                    d: 0
                };
                team.freeTextGuesses = {};
                team.lockedIn = false;
                team.lockedInTime = null;
                team.activeHint = null;
                team.remainingMoney = startingMoney;
                team.didGloat = false;
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

function handleLockIn(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    let team = getTeamByName(ws.team);

    if (!team) {
        return;
    }

    if (team.lockedIn) {
        console.warn('Attempting to lock in a team that is already locked in');
        return;
    }

    team.lockedIn = true;
    team.lockedInTime = Date.now();
    
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: ws.id,
        type: LOG_TYPE.LOCK
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    // Send locked-in emote to spectate
    broadcast(MESSAGE_TYPE.SERVER.EMOTE,
        { emote: 'lock' }, { clientArray: spectators, predicate: (c) => c.isSpectator });

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleResetAllocation(ws, data) {
    
    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    let team = getTeamByName(ws.team);

    if (!team) {
        return;
    }

    team.optionsAllocated = {
        a: 0,
        b: 0,
        c: 0,
        d: 0
    };

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: ws.id,
        type: LOG_TYPE.RESET
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleAddOption(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    let team = getTeamByName(ws.team);

    if (team.lockedIn) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    if (!team || team.activeHint && team.activeHint.indexOf(data.option) !== -1) {
        // Don't add money to active hint
        return;
    }

    const mr = moneyRemainingThisTurn(team);

    // Don't add money when it's ready
    if (mr === 0) {
        console.warn('Attempted to add money but none remaining');
        return;
    }

    let step = getDenomination(team);

    if (mr >= step) {
        team.optionsAllocated[data.option] += step;
    }

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: ws.id,
        type: LOG_TYPE.ADD,
        option: data.option
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleUpdateFreeText(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME || !activeQuestion || activeQuestion.questionType !== 'freeText') {
        console.warn('Function called with incorrect state');
        return;
    }

    let team = getTeamByName(ws.team);

    if (team.lockedIn) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    // Figure out which option the player corresponds to, as the order of objects is not guaranteed in JS
    let teamIx = -1;
    for (let ix = 0; ix < team.members.length; ix++) {
        if (team.members[ix].id === ws.id) {
            teamIx = ix;
            break;
        }
    }
    
    if (teamIx === -1) {
        console.error(`Attempted to update free text for ${ws.id} but could not find index in team member array`);
        return;
    }

    let option = ['a', 'b', 'c', 'd'][teamIx];

    // TODO: Sanitize length

    team.freeTextGuesses[option] = data.guess;

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleCreateTeam(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    let teamName = sanitizeHTML(data.team);
    let playerName = sanitizeHTML(data.as);

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team with an empty team name!" });
        return;
    }

    if (!playerName || /^\s*$/.test(playerName)) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team with an empty player name!" });
        return;
    }

    // Does team already exist?
    for (let team of teams) {
        if (teamName === team.teamName) {
            handleJoinTeam(ws, data);
            return;
        }
    }

    if (state !== GAME_STATE.PREGAME) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot create a team while quiz in progress" });
        return;
    }

    // Otherwise, create and add it
    let newTeam = {
        teamName: teamName,
        members: [
            {
                name: playerName,
                id: ws.id,
                ready: false,
                team: teamName
            }
        ],
        remainingMoney: startingMoney,
        score: 0,
        optionsAllocated: {
            a: 0,
            b: 0,
            c: 0,
            d: 0
        },
        freeTextGuesses: {},
        lockedIn: false,
        lockedInTime: null,
        solo: false,
        remainingHints: numHints,
        activeHint: null,
        lastChange: null,
        lastMoney: null,
        lastWagered: null,
        lastAllIn: false,
        currentGainStreak: 0,
        lastPlace: null,
        placesMoved: 0,
        achievements: [],
        numEmotesUsed: 0,
        didGloat: false
    };

    teams.push(newTeam);
    teamIndex[teamName] = newTeam;
    ws.team = teamName;
    ws.playerName = playerName;

    sendMessage(ws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: playerName, solo: false });

    broadcastGameState();
}

function handleNotify(ws, data) {
    const message = data.message;

    broadcast(MESSAGE_TYPE.SERVER.NOTIFY, { message: message }, { clientArray: clients.concat(spectators) });
}

function handleRemoveNotify(ws) {
    broadcast(MESSAGE_TYPE.SERVER.REMOVE_NOTIFY, {}, { clientArray: clients });
}

function handleTeamChat(ws, data) {

    if (!ws) {
        console.warn('Received message without websocket client object');
        return;
    }
    
    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    // Find the team the player is on...
    let team = null;
    let player = null;
    for (let _team of teams) {
        for (let tm of _team.members) {
            if (tm.id === ws.id) {
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
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Unable to find team to message!" });
        return;
    }

    // Send log message to the team
    broadcast(
        MESSAGE_TYPE.SERVER.TEAM_CHAT,
        {
            name: player.name,
            message: sanitizeHTML(data.message.substring(0, 256))
        },
        { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 }
    );
}

function handleJoinTeam(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }
    
    let teamName = sanitizeHTML(data.team);
    let playerName = sanitizeHTML(data.as);

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join a team with an empty name!" });
        return;
    }

    if (!playerName || /^\s*$/.test(playerName)) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join a team with an empty player name!" });
        return;
    }

    // Check to see if this player is already part of another team...
    let didLeaveTeamForAnotherOne = false;
    for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams[i].members.length; j++) {
            if (teams[i].members[j].id === data.id) {
                didLeaveTeamForAnotherOne = true;
                // Found the player's team, remove reference from their object
                teams[i].members[j].team = null;

                // Then remove them from the team
                teams[i].members.splice(j, 1);

                // If the team is now empty, remove it
                if (teams[i].members.length === 0) {
                    delete teamIndex[teams[i].teamName];
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
                sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: `Team '${team.teamName}' is full!` });
                
                if (didLeaveTeamForAnotherOne) {
                    broadcastGameState();
                }

                return;
            }

            team.members.push({
                name: playerName,
                id: data.id,
                ready: false,
                team: teamName
            });

            ws.team = teamName;
            ws.playerName = playerName;

            sendMessage(ws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: playerName, solo: false });

            broadcastGameState();

            // If game is in progress, inform team members explicitly
            if (state === GAME_STATE.GAME) {
                broadcast(MESSAGE_TYPE.SERVER.LOG, {
                    id: data.id,
                    type: LOG_TYPE.JOIN
                }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
            }

            return;
        }
    }

    sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Team not found" });
}

function handleJoinSolo(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    let teamName = sanitizeHTML(data.as);

    if (state !== GAME_STATE.PREGAME) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join a quiz in progress as a solo player" });
        return;
    }

    if (!teamName || /^\s*$/.test(teamName)) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot play solo with an empty player name!" });
        return;
    }

    // Ensure this person isn't already in a team already
    for (let team of teams) {
        for (let tm of team.members) {
            if (tm.id === data.id) {
                sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Cannot join two teams at once!" });
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
    let newTeam = {
        teamName: teamName,
        members: [
            {
                name: originalTeamName,
                id: data.id,
                ready: false,
                team: teamName
            }
        ],
        remainingMoney: startingMoney,
        score: 0,
        optionsAllocated: {
            a: 0,
            b: 0,
            c: 0,
            d: 0
        },
        freeTextGuesses: {},
        lockedIn: false,
        lockedInTime: null,
        solo: true,
        remainingHints: numHints,
        activeHint: null,
        lastChange: null,
        lastMoney: null,
        lastWagered: null,
        lastAllIn: false,
        currentGainStreak: 0,
        lastPlace: null,
        placesMoved: 0,
        achievements: [],
        numEmotesUsed: 0,
        didGloat: false
    };

    teams.push(newTeam);
    teamIndex[teamName] = newTeam;
    ws.team = teamName;
    ws.playerName = originalTeamName;

    if (didRename) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: `Changed your solo team name as there was already a '${originalTeamName}'` });
    }
    sendMessage(ws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: originalTeamName, solo: true });
    broadcastGameState();
}

function handleLeaveTeam(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams[i].members.length; j++) {
            if (teams[i].members[j].id === data.id) {
                
                // Found the player's team, remove reference from their object
                teams[i].members[j].team = null;

                // Then remove them from the team
                teams[i].members.splice(j, 1);

                // If the team is now empty, remove it
                if (teams[i].members.length === 0) {
                    delete teamIndex[teams[i].teamName];
                    teams.splice(i, 1);
                }

                // Reset that person's client and early-out
                sendMessage(ws, MESSAGE_TYPE.SERVER.RESET, {});
                broadcastGameState();
                return;
            }
        }
    }

    sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Unable to find team to leave" });
}

function handleToggleReady(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    // Find team of player
    let found = false;
    let newReady = null;
    for (let team of teams) {
        for (let tm of team.members) {
            if (tm.id === data.id) {
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
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Unable to find team to ready up in" });
        return;
    }

    sendMessage(ws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_READY, { ready: newReady });
    broadcastGameState();
}

function handleAddRemaining(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    let team = getTeamByName(ws.team); 
    
    if (team.lockedIn) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    if (!team || team.activeHint && team.activeHint.indexOf(data.option) !== -1) {
        // Don't add money to active hint
        return;
    }

    if (moneyRemainingThisTurn(team) > 0) {
        team.optionsAllocated[data.option] += moneyRemainingThisTurn(team);
    } else {
        console.warn('Attempted to add money but none remaining');
        return;
    }

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id,
        type: LOG_TYPE.ADD,
        option: data.option
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleRemoveAll(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    let team = getTeamByName(ws.team);

    if (!team) {
        return;
    }

    if (team.lockedIn) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    if (team.optionsAllocated[data.option] !== 0) {
        team.optionsAllocated[data.option] = 0;
    } else {
        console.log('Attempted to remove money but none allocated');
        return;
    }

    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id,
        type: LOG_TYPE.MINUS,
        option: data.option
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleMinusOption(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    let team = getTeamByName(ws.team);

    if (!team) {
        return;
    }

    let step = getDenomination(team);

    if (!team) {
        return;
    }

    if (team.lockedIn) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    if (team.optionsAllocated[data.option] != 0) {
        team.optionsAllocated[data.option] -= step;
    } else {
        console.log('Attempted to remove money but none allocated');
        return;
    }
    
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id,
        type: LOG_TYPE.MINUS,
        option: data.option
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

function handleReset(ws) {
    reset();
    broadcast(MESSAGE_TYPE.SERVER.RESET);
    broadcastGameState();
}

function handleKick(ws, data) {
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
    sendMessage(tws, MESSAGE_TYPE.SERVER.RESET);

    broadcastGameState();
}

function handleToggleImage(ws) {
    showImage = !showImage;

    broadcastGameState({ clientArray: spectators.concat(hosts),
        predicate: (c) => c.isHost || c.isSpectator });
}

function handleToggleAllocations(ws) {
    showAllocations = !showAllocations;

    // Only send to spectator and host
    broadcastGameState({ clientArray: spectators.concat(hosts),
        predicate: (c) => c.isHost || c.isSpectator });
}

function handleEmote(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (data.emote) {
        
        // Get player's team based on their ID
        let team = getTeamById(data.id);

        if (!team) {
            return;
        }
        
        // Increment their emotes used...
        team.numEmotesUsed++;

        // Only send to spectator
        broadcast(MESSAGE_TYPE.SERVER.EMOTE,
            { emote: data.emote }, { clientArray: spectators, predicate: (c) => c.isSpectator });
    }
}

function handleGloat(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.ANSWER && state !== GAME_STATE.SCORES) {
        console.warn('Function called with incorrect state');
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "There are too few teams to gloat" });
        return;
    }

    if (teams.length < 2) {
        console.warn('Too few teams to gloat!');
    }

    // Get player's team based on their ID
    const team = getTeamById(data.id);

    // Check team hasn't already gloated this turn
    if (team.didGloat) {
        console.warn('Team attempted to gloat but has already gloated');
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Your team has already gloated" });
        return;
    }

    // Check they have something to gloat about
    if (ws.team !== fastestTeamCorrect) {
        console.warn('Team attempted to gloat but has nothing to gloat about');
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You don't have anything to gloat about..." });
        return;
    }

    team.didGloat = true;

    broadcast(MESSAGE_TYPE.SERVER.GLOAT, { playerName: ws.playerName, solo: team.solo, teamName: ws.team });
    broadcastGameState();
}

function handleUseHint(ws, data) {

    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    if (state !== GAME_STATE.GAME) {
        console.warn('Function called with incorrect state');
        return;
    }

    if (activeQuestion.questionType !== 'multipleChoice') {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Hints can only be used on multiple choice questions" });
        return;
    }

    // Get player's team based on their ID
    const team = getTeamById(data.id);

    if (!team) {
        return;
    }

    if (team.lockedIn) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You're locked in" });
        return;
    }

    if (team.activeHint) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "You already have a hint" });
        return;
    }

    if (!activeQuestion) {
        console.error('Client attempted to use hint but there is no active question');
        return;
    }

    if (!allowHints) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Hints are not enabled for this game!" });
        return;
    }

    if (team.hintsRemaining <= 0) {
        sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "No more hints remaining!" });
        return;
    }

    // Randomise their hint and apply it to their team data
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

    // Send log message to the team
    broadcast(MESSAGE_TYPE.SERVER.LOG, {
        id: data.id,
        type: LOG_TYPE.HINT
    }, { predicate: (c) => team.members.map(tm => tm.id).indexOf(c.id) !== -1 });

    // Send hint emote to spectate
    broadcast(MESSAGE_TYPE.SERVER.EMOTE,
        { emote: 'hint' }, { clientArray: spectators, predicate: (c) => c.isSpectator });

    // Broadcast the state to the team and the host
    broadcastGameState({ predicate: (c) => c.isHost || team.members.map(tm => tm.id).indexOf(c.id) !== -1 });
}

// Handle disconnection
function handleClose() {

    // Remove from spectators list if was spectator
    if (this.isSpectator) {
        const ix = spectators.indexOf(this);
        if (ix !== -1) {
            spectators.splice(ix, 1);
        }
    }

    // Remove from hosts list if was host
    if (this.isSpectator) {
        const ix = spectators.indexOf(this);
        if (ix !== -1) {
            spectators.splice(ix, 1);
        }
    }
}
  
function handlePing(ws, data) {
    
    if (!ws || !data.id) {
        console.warn('Received message from null client or client with no ID');
        return;
    }

    sendMessage(ws, MESSAGE_TYPE.SERVER.PONG, { now: Date.now() });
}

// Handle connection and register listeners
wss.on('connection', (ws, req) => {

    let preId = url.parse(req.url, true).query.id;

    let isSpectator = url.parse(req.url, true).query.spectate;
    let isHost = url.parse(req.url, true).query.host;
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

        // Figure out what kind of team the person belonged to
        const team = getTeamById(preId);

        if (!team) {
            return;
        }

        ws.team = team.teamName;
        ws.playerName = player.name;

        sendMessage(ws, MESSAGE_TYPE.SERVER.ACKNOWLEDGE_NAME, { name: player.name, solo: team.solo });
    } else {
        ws.id = uuid.v4();
    }

    if (isSpectator) {
        ws.isSpectator = true;
        spectators.push(ws);
    }

    // Note: This isn't secure per-se, operates on good-faith basis
    if (isHost) {
        ws.isHost = true;
        hosts.push(ws);;
    }

    if (!isHost && !isSpectator) {
        clients.push(ws);
    }
  
    ws.on('close', handleClose);
    ws.on('message', (msg) => handleMessage(ws, msg, {
        [MESSAGE_TYPE.CLIENT.PING]: { handler: handlePing },
        [MESSAGE_TYPE.CLIENT.JOIN_SOLO]: { handler: handleJoinSolo, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.JOIN_TEAM]: { handler: handleJoinTeam, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.CREATE_TEAM]: { handler: handleCreateTeam, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.LEAVE_TEAM]: { handler: handleLeaveTeam, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.TOGGLE_READY]: { handler: handleToggleReady, rateLimit: { atomic: true, rate: { hits: 2, perMs: 1000 } } },
        [MESSAGE_TYPE.CLIENT.PROGRESS_STATE]: { handler: handleProgressState, rateLimit: { atomic: true, rate: { hits: 1, perMs: 10 } } },
        [MESSAGE_TYPE.CLIENT.LOCK_IN]: { handler: handleLockIn },
        [MESSAGE_TYPE.CLIENT.RESET_ALLOCATION]: { handler: handleResetAllocation, rateLimit: { atomic: true, rate: { hits: 1, perMs: 1000 }}},
        [MESSAGE_TYPE.CLIENT.ADD_OPTION]: { handler: handleAddOption },
        [MESSAGE_TYPE.CLIENT.ADD_REMAINING]: { handler: handleAddRemaining },
        [MESSAGE_TYPE.CLIENT.REMOVE_ALL]: { handler: handleRemoveAll },
        [MESSAGE_TYPE.CLIENT.MINUS_OPTION]: { handler: handleMinusOption },
        [MESSAGE_TYPE.CLIENT.RESET]: { handler: handleReset, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.KICK]: { handler: handleKick },
        [MESSAGE_TYPE.CLIENT.NOTIFY]: { handler: handleNotify, rateLimit: { atomic: true, rate: { hits: 1, perMs: 1000 } } },
        [MESSAGE_TYPE.CLIENT.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
        [MESSAGE_TYPE.CLIENT.TEAM_CHAT]: { handler: handleTeamChat, rateLimit: { rate: { hits: 2, perMs: 1500 } } },
        [MESSAGE_TYPE.CLIENT.TOGGLE_IMAGE]: { handler: handleToggleImage, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.TOGGLE_ALLOCATIONS]: { handler: handleToggleAllocations, rateLimit: { atomic: true } },
        [MESSAGE_TYPE.CLIENT.EMOTE]: { handler: handleEmote, rateLimit: { rate: { hits: 4, perMs: 2000 } } },
        [MESSAGE_TYPE.CLIENT.USE_HINT]: { handler: handleUseHint, rateLimit: { atomic: true, rate: { hits: 1, perMs: 5000 } } },
        [MESSAGE_TYPE.CLIENT.UPDATE_FREE_TEXT]: { handler: handleUpdateFreeText, rateLimit: { atomic: true }},
        [MESSAGE_TYPE.CLIENT.GLOAT]: { handler: handleGloat, rateLimit: { atomic: true, rate: { hits: 1, perMs: 20000 } }}
    }));
  
    sendMessage(ws, MESSAGE_TYPE.SERVER.CONNECTION_ID, { id: ws.id });
  
    broadcastGameState();
});

/**
 * Send an object to all connected websockets
 * 
 * @param {MESSAGE_TYPE} type to inject into message 
 * @param {any} obj to encode and send
 * @param {object} options further filter rules for clients
 */
function broadcast(type, obj = {}, options = {}) {

    let blobStr = "";
    if (options.transformation === null || options.transformation === undefined) {
        blobStr = formatMessage(type, obj);
    }

    let clientArray = [];
    if (options.clientArray) {
        clientArray = options.clientArray;
    } else {
        clientArray = wss.clients;
    }

    clientArray.forEach((c) => {
        if (options.predicate === null || options.predicate === undefined || options.predicate(c)) {

            if (options.transformation) {
                options.transformation(c, obj);
                blobStr = formatMessage(type, obj);
            }
            
            c.send(blobStr);
        }
    });
}

// Utility method for money denominations
function getDenomination(team) {

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
function moneyRemainingThisTurn(team) {

    return team.remainingMoney
        - (team.optionsAllocated.a
            + team.optionsAllocated.b
            + team.optionsAllocated.c
            + team.optionsAllocated.d);
}

function getTeamByName(teamName) {
    
    let team = teamIndex[teamName];

    if (!team) {
        console.error(`Attempted to find a non-existent team ${teamName}!`);
    }

    return team
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
        if (team.score > 0) {
            numTeamsWithMoney++;
        }   
    }

    return numTeamsWithMoney < 2;
}

function getTeamsWithMostMoney() {
    let teamsWithMostMoney = [];

    let highestSoFar = 0;
    for (let team of teams) {
        if (team.score > highestSoFar) {
            teamsWithMostMoney = [team.teamName];
            highestSoFar = team.score;
        } else if (highestSoFar !== 0 && team.score === highestSoFar) {
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

    let highestNumEmotesUsed = -1;
    let prospectiveHighestNumEmotesUsed = [];

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
        if (allowHints && historicData.globalData.teams[team.teamName].numTurnsUsedHints === 0) {
            team.achievements.push(ACHIEVEMENT.NO_HINTS_USED);
        }

        // Store totals of not a solo game
        if (teams.length > 1) {
            if (historicData.globalData.teams[team.teamName].numTimesKnockedOut > 1 &&
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

            if (team.numEmotesUsed > 0 &&
                team.numEmotesUsed > highestNumEmotesUsed) {
                prospectiveHighestNumEmotesUsed = [team.teamName];
            } else if (team.numEmotesUsed === highestNumEmotesUsed) {
                prospectiveHighestNumEmotesUsed.push(team.teamName);
            }
        }
    }

    // Store global achievements for host view
    achievements[ACHIEVEMENT.MOST_KNOCKED_OUT] = prospectiveHighestNumTimesKnockedOut;
    achievements[ACHIEVEMENT.MOST_CLUMSY_FINGERS] = prospectiveHighestNumTurnsSloppiestFinger;
    achievements[ACHIEVEMENT.MOST_FASTEST_FINGERS] = prospectiveHighestNumTurnsFastestFinger;
    achievements[ACHIEVEMENT.HIGHEST_GAINS] = prospectiveHighestTotalMoneyGained;
    achievements[ACHIEVEMENT.HIGHEST_LOSSES] = prospectiveHighestTotalMoneyLost;
    achievements[ACHIEVEMENT.MOST_ALL_INS] = prospectiveHighestNumTurnsWentAllIn;
    achievements[ACHIEVEMENT.MOST_EMOTES_USED] = prospectiveHighestNumEmotesUsed;
    
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

    for (const team of prospectiveHighestNumEmotesUsed) {
        let _team = getTeamByName(team);
        _team.achievements.push(ACHIEVEMENT.MOST_EMOTES_USED);
    }

    console.log(JSON.stringify(historicData));
}
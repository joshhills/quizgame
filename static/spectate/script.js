import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage, interpolateColour } from '../shared.js';

// Connect to server

let ws;

function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws') + '/quiz?spectate=true');
}

connect();

const MAX_EMOJIS = 150;

let id = null,
    gameState = null,
    currentNotification = null,
    emoteSideFlip = true,
    numEmojies = 0,
    timerBarInterval = -1,
    offset = 0;

function syncTime(serverTime) {
    // Average between old and new offset
    offset = ((serverTime - Date.now()) + offset) / 2;
}
    
// Get element references

let loader = document.getElementById('loader'),
    notification = document.getElementById('notification'),
    questionnumber = document.getElementById('questionnumber'),
    question = document.getElementById('question'),
    options = document.getElementById('options'),
    option1 = document.getElementById('option1'),
    option2 = document.getElementById('option2'),
    option3 = document.getElementById('option3'),
    option4 = document.getElementById('option4'),
    freeTextAnswer = document.getElementById('freetextanswer'),
    freeTextAnswerHighlight = document.getElementById('freetextanswerhighlight'),
    freeTextAnswerAllocation = document.getElementById('freetextanswerallocation'),
    option1text = document.getElementById('option1text'),
    option2text = document.getElementById('option2text'),
    option3text = document.getElementById('option3text'),
    option4text = document.getElementById('option4text'),
    t1o1allocation = document.getElementById('t1o1allocation'),
    t1o2allocation = document.getElementById('t1o2allocation'),
    t1o3allocation = document.getElementById('t1o3allocation'),
    t1o4allocation = document.getElementById('t1o4allocation'),
    gameContainer = document.getElementById('game'),
    scoresContainer = document.getElementById('scores'),
    scoresTable = document.getElementById('scorestable'),
    imageOverlay = document.getElementById('imageoverlay'),
    activeImage = document.getElementById('activeimage'),
    emoteContainer = document.getElementById('emotecontainer'),
    timerBar = document.getElementById('timerbar');

/* === Begin Handler functions === */

// Handle a pong from the server
function handlePong(ws, data) {
    if (data.now) {
        syncTime(data.now);
    }
}

function handleConnectionId(ws, data) {
    id = data.id;

    setInterval(() => {
        sendMessage(ws, MESSAGE_TYPE.CLIENT.PING, {}, id);
    }, 5000);
}

// Handle the state of the game changing
function handleStateChange(ws, data) {

    // Sync with server time
    if (data.now) {
        syncTime(data.now);
    }

    gameState = data.state;
}

function handleReset(ws) {
    emoteSideFlip = true;
    offset = 0;
}

function handleNotify(ws, data) {
    currentNotification = data.message;
    notification.innerHTML = currentNotification;
    notification.hidden = false;
}

function handleRemoveNotify(ws) {
    currentNotification = null;
    notification.innerHTML = '';
    notification.hidden = true;
}

function handleEmote(ws, data) {

    if (numEmojies >= MAX_EMOJIS) {
        return;
    }

    let el = document.createElement('span');
    el.className = `emote ${data.emote} ${emoteSideFlip ? 'left' : 'right'} ${Math.random() > 0.5 ? 'wiggle1' : 'wiggle2'}`;
    if (emoteSideFlip) {
        el.style.left = `${getRandomInclusive(1, 8)}%`;
    } else {
        el.style.right = `${getRandomInclusive(1, 8)}%`;
    }
    
    el.style.animationDuration = `${getRandomInclusive(2, 3.5)}s`;
    emoteSideFlip = !emoteSideFlip;

    emoteContainer.appendChild(el);
    numEmojies++;

    setTimeout(() => {
        emoteContainer.removeChild(el);
        numEmojies--;
    }, 4000);
}

// Register event handlers
ws.onmessage = (msg) => handleMessage(ws, msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: { handler: handlePong },
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: { handler: handleConnectionId },
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: { handler: handleStateChange },
    // [MESSAGE_TYPE.SERVER.NOTIFY]: { handler: handleNotify },
    // [MESSAGE_TYPE.SERVER.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
    [MESSAGE_TYPE.SERVER.RESET]: { handler: handleReset },
    [MESSAGE_TYPE.SERVER.EMOTE]: { handler: handleEmote }
}, updateUI);

/* === End Handler Functions === */

function getTimerBarWidth() {
    const now = Date.now();
    const secondsElapsed = ((now + offset) - gameState.activeQuestion.timeBegan) / 1000;
    let percentOfLimit = 100 - ((secondsElapsed / gameState.secondsPerQuestion) * 100);
    if (percentOfLimit < 0) {
        percentOfLimit = 0;
    }
    if (percentOfLimit > 100) {
        percentOfLimit = 100;
    }
    return percentOfLimit;
}

function updateTimerBar() {
    const percentageRemaining = getTimerBarWidth();
    timerBar.style.width = `${percentageRemaining}%`;
    timerBar.style.backgroundColor = interpolateColour('rgb(234, 60, 59)', 'rgb(0, 152, 121)', percentageRemaining / 100);
}

function updateUI() {
    
    if (currentNotification === null) {
        notification.hidden = true;
    }

    if (gameState !== null) {

        gameContainer.className = 'game';

        if (gameState.activeQuestion && gameState.activeQuestion.imageUrl) {
            activeImage.src = gameState.activeQuestion.imageUrl;
        } else {
            activeImage.src = '';
        }

        if (gameState.showImage) {
            imageOverlay.style.opacity = 1;
            
        } else {
            imageOverlay.style.opacity = 0;
        }

        scoresContainer.hidden = true;

        t1o1allocation.style.opacity = 0;
        t1o2allocation.style.opacity = 0;
        t1o3allocation.style.opacity = 0;
        t1o4allocation.style.opacity = 0;
        freeTextAnswerAllocation.style.opacity = 0;

        if (gameState.activeQuestion !== null) {
            questionnumber.hidden = false;
            question.hidden = false;
            options.className = 'options';
            option1.hidden = false;
            option2.hidden = false;

            if (gameState.activeQuestion.numOptions > 2) {
                option3.hidden = false;
            } else {
                option3.hidden = true;
            }

            if (gameState.activeQuestion.numOptions > 3) {
                option4.hidden = false;
            } else {
                option4.hidden = true;
            }
    
            questionnumber.innerHTML = 'Question ' + (gameState.activeQuestionIndex + 1);
            question.innerHTML = gameState.activeQuestion.text;

            if (gameState.activeQuestion.questionType === 'freeText') {
                options.className = 'options hidden';
                option1text.innerHTML = '';
                option2text.innerHTML = '';
                option3text.innerHTML = '';
                option4text.innerHTML = '';
            } else if (gameState.activeQuestion.questionType === 'multipleChoice') {
                option1text.innerHTML = gameState.activeQuestion.options.a;
                option2text.innerHTML = gameState.activeQuestion.options.b;
                option3text.innerHTML = gameState.activeQuestion.options.c;
                option4text.innerHTML = gameState.activeQuestion.options.d;
                options.className = 'options';
            }
        } else {
            questionnumber.hidden = true;
            question.hidden = true;
            options.className = 'options hidden';
            option1.hidden = true;
            option2.hidden = true;
            option3.hidden = true;
            option4.hidden = true;
        }

        if (gameState.scene === GAME_STATE.GAME) {
            timerBar.hidden = false;
            if (timerBarInterval === -1 && getTimerBarWidth() !== 0) {
                updateTimerBar();
                timerBarInterval = setInterval(updateTimerBar, 1000);
            }
            if (timerBarInterval !== -1 && getTimerBarWidth() === 0) {
                clearInterval(timerBarInterval);
                timerBarInterval = -1;
            }
        } else {
            clearInterval(timerBarInterval);
            timerBarInterval = -1;
            timerBar.hidden = true;
        }

        if (gameState.scene === GAME_STATE.PREGAME) {
            options.className = 'options hidden';
            question.hidden = false;
            freeTextAnswer.hidden = true;

            if (gameState.quizName) {
                question.innerHTML = `Waiting for '${gameState.quizName}' to start...<br/><br/>`;
            } else {
                question.innerHTML = 'Waiting for game to start...<br/><br/>';
            }

            question.innerHTML += `${gameState.teams.length} team${gameState.teams.length === 1 ? '' : 's'} waiting`;

        } else {
            if (gameState.activeQuestion.questionType === 'freeText') {
                options.className = 'options hidden';
            } else if (gameState.activeQuestion.questionType === 'multipleChoice') {
                freeTextAnswer.hidden = true;
                options.className = 'options';
            }
        }
    
        if (gameState.scene === GAME_STATE.ANSWER) {

            option1.className = 'false';
            option2.className = 'false';
            option3.className = 'false';
            option4.className = 'false';

            if (gameState.activeQuestion.questionType === 'freeText') {
                options.className = 'options hidden';
                freeTextAnswer.hidden = false;
                freeTextAnswerHighlight.innerHTML = gameState.activeQuestion.answersFreeText[0];
                
                let freeTextAllocationGainedPercent = 0;
                if (gameState.totalAllocationAllThisRound > 0) {
                    freeTextAllocationGainedPercent = Math.round(gameState.totalGainedThisRound / gameState.totalAllocationAllThisRound * 100);
                }
                freeTextAnswerAllocation.innerHTML = `${numberWithCommas(gameState.totalGainedThisRound, true)} spent (${freeTextAllocationGainedPercent}%)`;
                
                if (gameState.showAllocations) {
                    freeTextAnswerAllocation.style.opacity = 1;
                }
            } else if (gameState.activeQuestion.questionType === 'multipleChoice') {
                options.className = 'options';
                freeTextAnswer.hidden = true;
                freeTextAnswerHighlight.innerHTML = '';
                freeTextAnswerAllocation.innerHTML = '';

                if (gameState.activeQuestion.numOptions > 2) {
                    option3.hidden = false;
                } else {
                    option3.hidden = true;
                }
    
                if (gameState.activeQuestion.numOptions > 3) {
                    option4.hidden = false;
                } else {
                    option4.hidden = true;
                }

                if (gameState.activeQuestion.answer === 'a') {
                    option1.className = 'correct';
                } else if (gameState.activeQuestion.answer === 'b') {
                    option2.className = 'correct';
                } else if (gameState.activeQuestion.answer === 'c') {
                    option3.className = 'correct';
                } else if (gameState.activeQuestion.answer === 'd') {
                    option4.className = 'correct';
                }
                let optionATotalAllocationPercentage = 0,
                    optionBTotalAllocationPercentage = 0,
                    optionCTotalAllocationPercentage = 0,
                    optionDTotalAllocationPercentage = 0;
                if (gameState.totalAllocationAllThisRound !== 0) {
                    optionATotalAllocationPercentage = Math.round((gameState.optionATotalAllocationThisRound / gameState.totalAllocationAllThisRound) * 100);
                    optionBTotalAllocationPercentage = Math.round((gameState.optionBTotalAllocationThisRound / gameState.totalAllocationAllThisRound) * 100);
                    optionCTotalAllocationPercentage = Math.round((gameState.optionCTotalAllocationThisRound / gameState.totalAllocationAllThisRound) * 100);
                    optionDTotalAllocationPercentage = Math.round((gameState.optionDTotalAllocationThisRound / gameState.totalAllocationAllThisRound) * 100);
                }
    
                if (gameState.showAllocations) {
                    t1o1allocation.style.opacity = 1;
                    t1o2allocation.style.opacity = 1;
                    t1o3allocation.style.opacity = 1;
                    t1o4allocation.style.opacity = 1;
                    t1o1allocation.innerHTML = `${numberWithCommas(gameState.optionATotalAllocationThisRound, true)} spent (${optionATotalAllocationPercentage}%)`;
                    t1o2allocation.innerHTML = `${numberWithCommas(gameState.optionBTotalAllocationThisRound, true)} spent (${optionBTotalAllocationPercentage}%)`;
                    t1o3allocation.innerHTML = `${numberWithCommas(gameState.optionCTotalAllocationThisRound, true)} spent (${optionCTotalAllocationPercentage}%)`;
                    t1o4allocation.innerHTML = `${numberWithCommas(gameState.optionDTotalAllocationThisRound, true)} spent (${optionDTotalAllocationPercentage}%)`;
                }
            }
        } else {
            option1.className = '';
            option2.className = '';
            option3.className = '';
            option4.className = '';
        }
    
        if (gameState.scene === GAME_STATE.FINISH) {

            if (gameState.winners.length === 0) {
                questionnumber.innerHTML = "Oh dear...";
                question.innerHTML = 'Nobody won!';
            } else if (gameState.winners.length === 1) {
                questionnumber.innerHTML = "WINNER";
                question.innerHTML = gameState.winners[0];
            } else {
                questionnumber.innerHTML = "WINNERS";
                question.innerHTML = '';
                for (let winner of gameState.winners) {
                    question.innerHTML += `${winner} `;
                }
            }

            options.className = 'options hidden';
        }

        if (gameState.scene === GAME_STATE.SCORES) {
            freeTextAnswer.hidden = true;
            scoresContainer.hidden = false;
            gameContainer.className = 'game scores';
            questionnumber.innerHTML = 'Scores';
            question.innerHTML = `${numberWithCommas(gameState.totalLostThisRound, true)} was lost. ${numberWithCommas(gameState.totalGainedThisRound, true)} was gained.`;
            if (gameState.teamsKnockedOutThisRound.length > 0) {
                question.innerHTML += ` ${gameState.teamsKnockedOutThisRound.length} team${gameState.teamsKnockedOutThisRound.length !== 1 ? 's' : ''} went into the red.`;
            }
            options.className = 'options hidden';

            let scoresTableHtml = '<thead><tr><th></th><th>Team</th><th>Score</th><th>Change</th><th></th></tr></thead><tbody>';
            // gameState.teams.sort((a, b) => b.score - a.score);
            for (let i = 0; i < gameState.teams.length; i++) {
                let scoreDidChange = gameState.teams[i].lastChange !== 0;
                let changeIconHtml = '';
                let changeAmountHtml = '-';
                let changeClass = '';
                if (scoreDidChange) {
                    // let largeChange = Math.abs(gameState.teams[i].lastChange) > gameState.teams[i].lastMoney / 2;
                    const placesMoved = gameState.teams[i].placesMoved;
                    const largeChange = Math.abs(placesMoved) > 4;
                    
                    if (placesMoved < 0) {
                        changeIconHtml = `<i class="bi bi-chevron${largeChange ? '-double' : ''}-down red"></i>`;
                    } else if (placesMoved > 0) {
                        changeIconHtml = `<i class="bi bi-chevron${largeChange ? '-double' : ''}-up green"></i>`;
                    }

                    if (gameState.teams[i].lastChange < 0) {
                        changeClass = 'red';
                        changeAmountHtml = `-£${numberWithCommas(Math.abs(gameState.teams[i].lastChange))}`;
                    } else {
                        changeClass = 'green';
                        changeAmountHtml = `+£${numberWithCommas(gameState.teams[i].lastChange)}`;
                    }
                }

                let fastestFingerIconHtml = '';
                if (gameState.teams.length > 1 && gameState.teams[i].teamName === gameState.fastestTeam) {
                    fastestFingerIconHtml = '<i class="bi bi-lightning-charge red" title="Clumsiest thumbs"></i>';
                }
                if (gameState.teams.length > 1 && gameState.teams[i].teamName === gameState.fastestTeamCorrect) {
                    fastestFingerIconHtml = '<i class="bi bi-lightning-charge green" title="Fastest fingers"></i>';
                }
                scoresTableHtml += `<tr class="${gameState.teams[i].score <= 0 ? 'eliminated' : ''}"><td>${changeIconHtml} ${i + 1}</td><td>${gameState.teams[i].teamName}</td><td>${numberWithCommas(gameState.teams[i].score, true)}</td><td class="${changeClass}">${changeAmountHtml}</td><td>${gameState.teams[i].activeHint !== null ? '<i class="bi bi-lightbulb" title="Used hint"></i>': ''}${gameState.teams[i].lastAllIn ? '<i class="bi bi-exclamation-triangle" title="All in"></i>': ''}${fastestFingerIconHtml}${gameState.teams[i].lastWagered === 0 ? '<i class="bi bi-skip-forward" title="Skipped"></i>' : ''}</td></tr>`;
            }
            scoresTableHtml + '</tbody>';
            scoresTable.innerHTML = scoresTableHtml;
        }
    }
    
    // Have received updates from server so it has 'loaded'
    loader.hidden = true;
}

function numberWithCommas(x, prependPoundSymbol = false) {
    const sign = x >= 0 ? '' : '-';
    let absX = Math.abs(x);
    const formatted = absX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return prependPoundSymbol ?
        sign + '£' + formatted : sign + formatted;
}

function getRandomInclusive(min, max) {
    return Math.random() * (max - min + 1) + min;
}
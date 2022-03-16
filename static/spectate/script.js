import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage } from '../shared.js';

// Connect to server

let ws;

function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws') + '?spectate=true');
}

connect();

const MAX_EMOJIS = 150;

let id = null,
    gameState = null,
    currentNotification = null,
    emoteSideFlip = true,
    numEmojies = 0;

// Get element references

let notification = document.getElementById('notification'),
    questionnumber = document.getElementById('questionnumber'),
    question = document.getElementById('question'),
    options = document.getElementById('options'),
    option1 = document.getElementById('option1'),
    option2 = document.getElementById('option2'),
    option3 = document.getElementById('option3'),
    option4 = document.getElementById('option4'),
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
    emoteContainer = document.getElementById('emotecontainer');

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
}

function handleReset() {
    emoteSideFlip = true;
}

function handleNotify(data) {
    currentNotification = data.message;
    notification.innerHTML = currentNotification;
    notification.hidden = false;
}

function handleRemoveNotify() {
    currentNotification = null;
    notification.innerHTML = '';
    notification.hidden = true;
}

function handleEmote(data) {

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
    [MESSAGE_TYPE.SERVER.NOTIFY]: { handler: handleNotify },
    [MESSAGE_TYPE.SERVER.REMOVE_NOTIFY]: { handler: handleRemoveNotify },
    [MESSAGE_TYPE.SERVER.RESET]: { handler: handleReset },
    [MESSAGE_TYPE.SERVER.EMOTE]: { handler: handleEmote }
}, updateUI);

/* === End Handler Functions === */

function updateUI() {
    
    if (currentNotification === null) {
        notification.hidden = true;
    }

    if (gameState !== null) {

        gameContainer.className = 'game';

        if (gameState.activeQuestion && gameState.activeQuestion.imageUrl) {
            activeImage.src = gameState.activeQuestion.imageUrl;
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

        if (gameState.activeQuestion !== null) {
            questionnumber.hidden = false;
            question.hidden = false;
            options.className = 'options';
            option1.hidden = false;
            option2.hidden = false;
            option3.hidden = false;
            option4.hidden = false;
    
            questionnumber.innerHTML = 'Question ' + (gameState.activeQuestionIndex + 1);
            question.innerHTML = gameState.activeQuestion.text;
            option1text.innerHTML = gameState.activeQuestion.options.a;
            option2text.innerHTML = gameState.activeQuestion.options.b;
            option3text.innerHTML = gameState.activeQuestion.options.c;
            option4text.innerHTML = gameState.activeQuestion.options.d;
        } else {
            questionnumber.hidden = true;
            question.hidden = true;
            options.className = 'options hidden';
            option1.hidden = true;
            option2.hidden = true;
            option3.hidden = true;
            option4.hidden = true;
        }

        if (gameState.scene === GAME_STATE.PREGAME) {
            options.className = 'options hidden';
            question.hidden = false;
            question.innerHTML = 'Waiting for quiz to start...';
        } else {
            options.className = 'options';
        }
    
        if (gameState.scene === GAME_STATE.ANSWER) {

            option1.className = 'false';
            option2.className = 'false';
            option3.className = 'false';
            option4.className = 'false';
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
                t1o1allocation.innerHTML = `£${numberWithCommas(gameState.optionATotalAllocationThisRound)} spent (${optionATotalAllocationPercentage}%)`;
                t1o2allocation.innerHTML = `£${numberWithCommas(gameState.optionBTotalAllocationThisRound)} spent (${optionBTotalAllocationPercentage}%)`;
                t1o3allocation.innerHTML = `£${numberWithCommas(gameState.optionCTotalAllocationThisRound)} spent (${optionCTotalAllocationPercentage}%)`;
                t1o4allocation.innerHTML = `£${numberWithCommas(gameState.optionDTotalAllocationThisRound)} spent (${optionDTotalAllocationPercentage}%)`;
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
                question.innerHTML = 'Everybody went bankrupt!';
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
            scoresContainer.hidden = false;
            gameContainer.className = 'game scores';
            questionnumber.innerHTML = 'Scores';
            question.innerHTML = `£${numberWithCommas(gameState.totalLostThisRound)} was lost. ${gameState.teamsKnockedOutThisRound.length} team${gameState.teamsKnockedOutThisRound.length !== 1 ? 's were' : ' was'} eliminated.`;
            options.className = 'options hidden';

            let scoresTableHtml = '<thead><tr><th>Team</th><th>Remaining Money</th></tr></thead><tbody>';
            gameState.teams.sort((a, b) => b.remainingMoney - a.remainingMoney);
            for (let _team of gameState.teams) {
                scoresTableHtml += `<tr class="${_team.remainingMoney === 0 ? 'eliminated' : ''}"><td>${_team.teamName}</td><td>£${numberWithCommas(_team.remainingMoney)}</td></tr>`;
            }
            scoresTableHtml + '</tbody>';
            scoresTable.innerHTML = scoresTableHtml;
        }
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getRandomInclusive(min, max) {
    return Math.random() * (max - min + 1) + min;
}
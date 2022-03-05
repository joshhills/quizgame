import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage } from '../shared.js';

// Connect to server

let ws;

function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
}

connect();

let id = null,
    gameState = null,
    currentNotification = null;

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
    scoresContainer = document.getElementById('scores'),
    scoresTable = document.getElementById('scorestable');

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
    questionnumber.innerHTML = '';
    question.innerHTML = '';
    options.innerHTML = '';
    option1text.innerHTML = '';
    option2text.innerHTML = '';
    option3text.innerHTML = '';
    option4text.innerHTML = '';

    option1.className = '';
    option2.className = '';
    option3.className = '';
    option4.className = '';
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

// Register event handlers
ws.onmessage = (msg) => handleMessage(msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: handlePong,
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: handleConnectionId,
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: handleStateChange,
    [MESSAGE_TYPE.SERVER.NOTIFY]: handleNotify,
    [MESSAGE_TYPE.SERVER.REMOVE_NOTIFY]: handleRemoveNotify,
    [MESSAGE_TYPE.SERVER.RESET]: handleReset
}, updateUI);

/* === End Handler Functions === */

function updateUI() {
    
    if (currentNotification === null) {
        notification.hidden = true;
    }

    if (gameState !== null) {
        scoresContainer.hidden = true;

        t1o1allocation.hidden = true;
        t1o2allocation.hidden = true;
        t1o3allocation.hidden = true;
        t1o4allocation.hidden = true;

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
            question.innerHTML = 'Waiting...';
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

            let optionATotalAllocation = 0,
                optionBTotalAllocation = 0,
                optionCTotalAllocation = 0,
                optionDTotalAllocation = 0;
            
            // Count how much money was spent on each question
            for (let t of gameState.teams) {
                optionATotalAllocation += t.optionsAllocated.a;
                optionBTotalAllocation += t.optionsAllocated.b;
                optionCTotalAllocation += t.optionsAllocated.c;
                optionDTotalAllocation += t.optionsAllocated.d;
            }

            let totalAllocationAll = optionATotalAllocation + optionBTotalAllocation + optionCTotalAllocation + optionDTotalAllocation;

            let optionATotalAllocationPercentage = 0,
                optionBTotalAllocationPercentage = 0,
                optionCTotalAllocationPercentage = 0,
                optionDTotalAllocationPercentage = 0;
            if (totalAllocationAll !== 0) {
                optionATotalAllocationPercentage = (optionATotalAllocation / totalAllocationAll) * 100;
                optionBTotalAllocationPercentage = (optionBTotalAllocation / totalAllocationAll) * 100;
                optionCTotalAllocationPercentage = (optionCTotalAllocation / totalAllocationAll) * 100;
                optionDTotalAllocationPercentage = (optionDTotalAllocation / totalAllocationAll) * 100;
            }

            t1o1allocation.hidden = false;
            t1o2allocation.hidden = false;
            t1o3allocation.hidden = false;
            t1o4allocation.hidden = false;
            t1o1allocation.innerHTML = `£${numberWithCommas(optionATotalAllocation)} spent (${optionATotalAllocationPercentage}%)`;
            t1o2allocation.innerHTML = `£${numberWithCommas(optionBTotalAllocation)} spent (${optionBTotalAllocationPercentage}%)`;
            t1o3allocation.innerHTML = `£${numberWithCommas(optionCTotalAllocation)} spent (${optionCTotalAllocationPercentage}%)`;
            t1o4allocation.innerHTML = `£${numberWithCommas(optionDTotalAllocation)} spent (${optionDTotalAllocationPercentage}%)`;

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
            question.innerHTML = 'Scores';
            options.className = 'options hidden';

            let scoresTableHtml = '<tr><th>Team</th><th>Remaining Money</th></tr>';
            gameState.teams.sort((a, b) => b.remainingMoney - a.remainingMoney);
            for (let _team of gameState.teams) {
                scoresTableHtml += `<tr><td>${_team.teamName}</td><td>£${numberWithCommas(_team.remainingMoney)}</td></tr>`;
            }
            scoresTable.innerHTML = scoresTableHtml;
        }
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
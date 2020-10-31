import { MESSAGE_TYPE, GAME_STATE, sendMessage, handleMessage } from '../shared.js';

// Connect to server

let ws;

function connect() {
    ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
}

connect();

let id = null,
    gameState = null;

// Get element references

let questionnumber = document.getElementById('questionnumber'),
    question = document.getElementById('question'),
    team1name = document.getElementById('team1name'),
    team1members = document.getElementById('team1members'),
    team1lockedin = document.getElementById('team1lockedin'),
    team1remainingmoney = document.getElementById('team1remainingmoney'),
    team2name = document.getElementById('team2name'),
    team2members = document.getElementById('team2members'),
    team2lockedin = document.getElementById('team2lockedin'),
    team2remainingmoney = document.getElementById('team2remainingmoney'),
    options = document.getElementById('options'),
    option1 = document.getElementById('option1'),
    option2 = document.getElementById('option2'),
    option3 = document.getElementById('option3'),
    option4 = document.getElementById('option4'),
    option1text = document.getElementById('option1text'),
    option2text = document.getElementById('option2text'),
    option3text = document.getElementById('option3text'),
    option4text = document.getElementById('option4text'),
    team1option1allocation = document.getElementById('t1o1allocation'),
    team2option1allocation = document.getElementById('t2o1allocation'),
    team1option2allocation = document.getElementById('t1o2allocation'),
    team2option2allocation = document.getElementById('t2o2allocation'),
    team1option3allocation = document.getElementById('t1o3allocation'),
    team2option3allocation = document.getElementById('t2o3allocation'),
    team1option4allocation = document.getElementById('t1o4allocation'),
    team2option4allocation = document.getElementById('t2o4allocation');

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
    team1name.innerHTML = '';
    team1members.innerHTML = '';
    team1lockedin.className = '';
    team1remainingmoney.innerHTML = '';
    team2name.innerHTML = '';
    team2members.innerHTML = '';
    team2lockedin.className = '';
    team2remainingmoney.innerHTML = '';
    options.innerHTML = '';
    option1text.innerHTML = '';
    option2text.innerHTML = '';
    option3text.innerHTML = '';
    option4text.innerHTML = '';
    team1option1allocation.innerHTML = '';
    team2option1allocation.innerHTML = '';
    team1option2allocation.innerHTML = '';
    team2option2allocation.innerHTML = '';
    team1option3allocation.innerHTML = '';
    team2option3allocation.innerHTML = '';
    team1option4allocation.innerHTML = '';
    team2option4allocation.innerHTML = '';

    option1.className = '';
    option2.className = '';
    option3.className = '';
    option4.className = '';
}

// Register event handlers
ws.onmessage = (msg) => handleMessage(msg.data, {
    [MESSAGE_TYPE.SERVER.PONG]: handlePong,
    [MESSAGE_TYPE.SERVER.CONNECTION_ID]: handleConnectionId,
    [MESSAGE_TYPE.SERVER.STATE_CHANGE]: handleStateChange,
    [MESSAGE_TYPE.SERVER.RESET]: handleReset
}, updateUI);

/* === End Handler Functions === */

function updateUI() {
    if (gameState !== null) {
        team1name.innerHTML = gameState.teams.x.teamName;
        team2name.innerHTML = gameState.teams.y.teamName;
    
        let team1membersHTML = '';
        for (let tm of gameState.teams.x.members) {
            team1membersHTML += `<li>${tm.name}</li>`;
        }
        team1members.innerHTML = team1membersHTML;
    
        let team2membersHTML = '';
        for (let tm of gameState.teams.y.members) {
            team2membersHTML += `<li>${tm.name}</li>`;
        }
        team2members.innerHTML = team2membersHTML;
    
        if (gameState.scene === GAME_STATE.GAME) {
            team1lockedin.hidden = false;
            team2lockedin.hidden = false;
            if (gameState.teams.x.lockedIn) {
                team1lockedin.className = 'active';
            } else {
                team1lockedin.className = '';
            }
            if (gameState.teams.y.lockedIn) {
                team2lockedin.className = 'active';
            } else {
                team2lockedin.className = '';
            }
        } else {
            team1lockedin.hidden = true;
            team2lockedin.hidden = true;
        }
    
        if (gameState.activeQuestion !== null) {
            questionnumber.hidden = false;
            question.hidden = false;
            options.hidden = false;
            options.hidden = false;
            option1.hidden = false;
            option2.hidden = false;
            option3.hidden = false;
            option4.hidden = false;
            document.getElementsByClassName('lockedin')[0].hidden = false;
            document.getElementsByClassName('lockedin')[1].hidden = false;
    
            questionnumber.innerHTML = 'Question ' + gameState.activeQuestion.number;
            question.innerHTML = gameState.activeQuestion.text;
            option1text.innerHTML = gameState.activeQuestion.options.a;
            option2text.innerHTML = gameState.activeQuestion.options.b;
            option3text.innerHTML = gameState.activeQuestion.options.c;
            option4text.innerHTML = gameState.activeQuestion.options.d;
        } else {
            questionnumber.hidden = true;
            question.hidden = true;
            options.hidden = true;
            option1.hidden = true;
            option2.hidden = true;
            option3.hidden = true;
            option4.hidden = true;

            document.getElementsByClassName('lockedin')[0].hidden = true;
            document.getElementsByClassName('lockedin')[1].hidden = true;
        }
    
        team1remainingmoney.innerHTML = numberWithCommas(gameState.teams.x.remainingMoney);
        team2remainingmoney.innerHTML = numberWithCommas(gameState.teams.y.remainingMoney);

        if (gameState.scene === GAME_STATE.PREGAME) {
            options.hidden = true;
            question.hidden = false;
            question.innerHTML = 'Waiting...';
        } else {
            options.hidden = false;
        }
    
        if (gameState.scene === GAME_STATE.ANSWER) {
            team1option1allocation.hidden = false;
            team1option2allocation.hidden = false;
            team1option3allocation.hidden = false;
            team1option4allocation.hidden = false;
            team2option1allocation.hidden = false;
            team2option2allocation.hidden = false;
            team2option3allocation.hidden = false;
            team2option4allocation.hidden = false;

            option1.className = 'false';
            option2.className = 'false';
            option3.className = 'false';
            option4.className = 'false';
            if (gameState.answer === 'a') {
                option1.className = 'correct';
            } else if (gameState.answer === 'b') {
                option2.className = 'correct';
            } else if (gameState.answer === 'c') {
                option3.className = 'correct';
            } else if (gameState.answer === 'd') {
                option4.className = 'correct';
            }
    
            if (gameState.teams.x.optionsAllocated.a != 0) {
                team1option1allocation.innerHTML = '£' + numberWithCommas(gameState.teams.x.optionsAllocated.a);
            } else {
                team1option1allocation.innerHTML = '';
            }
            if (gameState.teams.x.optionsAllocated.b != 0) {
                team1option2allocation.innerHTML = '£' + numberWithCommas(gameState.teams.x.optionsAllocated.b);
            } else {
                team1option2allocation.innerHTML = '';
            }
            if (gameState.teams.x.optionsAllocated.c != 0) {
                team1option3allocation.innerHTML = '£' + numberWithCommas(gameState.teams.x.optionsAllocated.c);
            } else {
                team1option3allocation.innerHTML = '';
            }
            if (gameState.teams.x.optionsAllocated.d != 0) {
                team1option4allocation.innerHTML = '£' + numberWithCommas(gameState.teams.x.optionsAllocated.d);
            } else {
                team1option4allocation.innerHTML = '';
            }
            if (gameState.teams.y.optionsAllocated.a != 0) {
                team2option1allocation.innerHTML = '£' + numberWithCommas(gameState.teams.y.optionsAllocated.a);
            } else {
                team2option1allocation.innerHTML = '';
            }
            if (gameState.teams.y.optionsAllocated.b != 0) {
                team2option2allocation.innerHTML = '£' + numberWithCommas(gameState.teams.y.optionsAllocated.b);
            } else {
                team2option2allocation.innerHTML = '';
            }
            if (gameState.teams.y.optionsAllocated.c != 0) {
                team2option3allocation.innerHTML = '£' + numberWithCommas(gameState.teams.y.optionsAllocated.c);
            } else {
                team2option3allocation.innerHTML = '';
            }
            if (gameState.teams.y.optionsAllocated.d != 0) {
                team2option4allocation.innerHTML = '£' + numberWithCommas(gameState.teams.y.optionsAllocated.d);
            } else {
                team2option4allocation.innerHTML = '';
            }

        } else {
            option1.className = '';
            option2.className = '';
            option3.className = '';
            option4.className = '';

            team1option1allocation.hidden = true;
            team1option2allocation.hidden = true;
            team1option3allocation.hidden = true;
            team1option4allocation.hidden = true;
            team2option1allocation.hidden = true;
            team2option2allocation.hidden = true;
            team2option3allocation.hidden = true;
            team2option4allocation.hidden = true;

            team1option1allocation.innerHTML = '';
            team1option2allocation.innerHTML = '';
            team1option3allocation.innerHTML = '';
            team1option4allocation.innerHTML = '';
            team2option1allocation.innerHTML = '';
            team2option2allocation.innerHTML = '';
            team2option3allocation.innerHTML = '';
            team2option4allocation.innerHTML = '';
        }
    
        if (gameState.scene === GAME_STATE.FINISH) {
            questionnumber.innerHTML = "The winner was...";
    
            if (gameState.winner === 'x') {
                question.innerHTML = gameState.teams.x.teamName;
            } else if (gameState.winner === 'y') {
                question.innerHTML = gameState.teams.y.teamName;
            } else if (gameState.winner === 'nobody') {
                question.innerHTML = 'nobody';
            } else if (gameState.winner === 'both') {
                question.innerHTML = `both ${gameState.teams.x.teamName} and ${gameState.teams.y.teamName}`;
            }

            options.hidden = true;
        }
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
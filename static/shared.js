/**
 * Define constructs shared between client and server
 * to ensure parity.
 */

// Message types of custom protocol
export const MESSAGE_TYPE = {
    SERVER: {
        CONNECTION_ID: 'id',
        STATE_CHANGE: 'stateChange',
        ACKNOWLEDGE_NAME: 'ackname',
        ACKNOWLEDGE_READY: 'ackready',
        PONG: 'pong',
        RESET: 'reset',
        LOG: 'log',
        ERROR_MESSAGE: 'errorMessage',
        RATE_LIMIT: 'rateLimit',
        NOTIFY: 'notify',
        REMOVE_NOTIFY: 'removeNotify',
        TEAM_CHAT: 'teamChat',
        EMOTE: 'emote',
        USE_HINT: 'useHint'
    },
    CLIENT: {
        PING: 'ping',
        JOIN_SOLO: 'joinSolo',
        JOIN_TEAM: 'joinTeam',
        LEAVE_TEAM: 'leaveTeam',
        CREATE_TEAM: 'createTeam',
        TOGGLE_READY: 'toggleReady',
        PROGRESS_STATE: 'progressState',
        LOCK_IN: 'lockIn',
        RESET_ALLOCATION: 'resetAllocation',
        ADD_OPTION: 'addOption',
        ADD_REMAINING: 'addRemaining',
        REMOVE_ALL: 'removeAll',
        MINUS_OPTION: 'minusOption',
        RESET: 'reset',
        KICK: 'kick',
        NOTIFY: 'notify',
        REMOVE_NOTIFY: 'removeNotify',
        TEAM_CHAT: 'teamChat',
        TOGGLE_IMAGE: 'toggleImage',
        TOGGLE_ALLOCATIONS: 'toggleAllocations',
        EMOTE: 'emote',
        USE_HINT: 'useHint',
        UPDATE_FREE_TEXT: 'updateFreeText'
    }
};

export const RATE_LIMIT_TIMEOUT = 3000;

export const RateLimitCache = {};

// State machine of game
export const GAME_STATE = {
    PREGAME: 'pregame',
    GAME: 'game',
    ANSWER: 'answer',
    SCORES: 'scores',
    FINISH: 'finish'
};

// User reactions
export const REACTIONS = {
    LAUGH: 'laugh',
    CRY: 'cry',
    SHOCK: 'shock',
    LOVE: 'love'
};

export const MAX_TEAM_SIZE = 4;

export const QUESTION_BUFFER_TIME_MS = 3000;

export const SHOW_ALLOCATIONS_TIMER_MS = 8000;

// Game achievements
export const ACHIEVEMENT = {
    WINNER: 'winner', 
    FIVE_IN_A_ROW: 'fiveInARow',
    TEN_IN_A_ROW: 'tenInARow',
    FIFTEEN_IN_A_ROW: 'fifteenInARow',
    ALL_CORRECT: 'allCorrect',
    MOST_FASTEST_FINGERS: 'mostFastestFingers',
    MOST_CLUMSY_FINGERS: 'mostClumsyFingers',
    HIGHEST_GAINS: 'highestGains',
    HIGHEST_LOSSES: 'highestLosses',
    MOST_ALL_INS: 'mostAllIns',
    MOST_KNOCKED_OUT: 'mostKnockedOut',
    NO_HINTS_USED: 'noHintsUsed',
    MOST_EMOTES_USED: 'mostEmotesUsed'
}

export const ACHIEVEMENT_DATA = {
    [ACHIEVEMENT.WINNER]: {
        title: 'Winner',
        description: 'You won the quiz',
        imagePath: '/quiz/images/achievements/WinnerIcon.png'
    },
    [ACHIEVEMENT.FIVE_IN_A_ROW]: {
        title: 'Five In A Row',
        description: 'You gained money five times in a row',
        imagePath: '/quiz/images/achievements/FiveInARowIcon.png'
    },
    [ACHIEVEMENT.TEN_IN_A_ROW]: {
        title: 'Ten In A Row',
        description: '',
        imagePath: '/quiz/images/achievements/TenInARowIcon.png'
    },
    [ACHIEVEMENT.FIFTEEN_IN_A_ROW]: {
        title: 'Fifteen In A Row',
        description: 'You won the quiz!',
        imagePath: '/quiz/images/achievements/FifteenInARow.png'
    },
    [ACHIEVEMENT.ALL_CORRECT]: {
        title: 'Star Pupil',
        description: 'You gained money on all questions',
        imagePath: '/quiz/images/achievements/StarPupilIcon.png'
    },
    [ACHIEVEMENT.MOST_FASTEST_FINGERS]: {
        title: 'Fastest Fingers',
        description: 'You locked in the fastest and gained money, the most amount of times',
        imagePath: '/quiz/images/achievements/FastestFingersIcon.png'
    },
    [ACHIEVEMENT.MOST_CLUMSY_FINGERS]: {
        title: 'Clumsiest Thumbs',
        description: 'You locked in the fastest and lost money, the most amount of times',
        imagePath: '/quiz/images/achievements/ClumsiestThumbsIcon.png'
    },
    [ACHIEVEMENT.HIGHEST_GAINS]: {
        title: 'On The Up',
        description: 'You gained the most money overall',
        imagePath: '/quiz/images/achievements/OnTheUpIcon.png'
    },
    [ACHIEVEMENT.HIGHEST_LOSSES]: {
        title: 'Biggest Loser',
        description: 'You lost the most money overall',
        imagePath: '/quiz/images/achievements/BiggestLoserIcon.png'
    },
    [ACHIEVEMENT.MOST_ALL_INS]: {
        title: 'Riskiest Strategy',
        description: 'You went all-in on a single answer the most amount of times',
        imagePath: '/quiz/images/achievements/RiskiestStrategyIcon.png'
    },
    [ACHIEVEMENT.MOST_KNOCKED_OUT]: {
        title: 'Hard Knocks',
        description: 'You lost all your money the most amount of times',
        imagePath: '/quiz/images/achievements/HardKnocksIcon.png'
    },
    [ACHIEVEMENT.NO_HINTS_USED]: {
        title: 'No Help Needed',
        description: 'You never used any hints',
        imagePath: '/quiz/images/achievements/NoHelpNeededIcon.png'
    },
    [ACHIEVEMENT.MOST_EMOTES_USED]: {
        title: 'Most Emotional',
        description: 'You sent the most emotes to spectators',
        imagePath: '/quiz/images/achievements/MostEmotionalIcon.png'
    }
}

export const LOG_TYPE = {
    CHAT: 'chat',
    ADD: 'add',
    MINUS: 'minus',
    LOCK: 'lock',
    HINT: 'hint',
    RESET: 'resetAllocation',
    JOIN: 'join'
};

/**
 * Send an object over a websocket
 * 
 * @param {WebSocket} ws to send message on
 * @param {MESSAGE_TYPE} type to inject into message 
 * @param {object} obj to encode and send 
 * @param {string} id to optionally inject into message 
 * @param {function} onError callback if unable to send message
 * 
 */
export function sendMessage(ws, type, obj, id, onError) {

    let blobStr = formatMessage(type, obj, id);

    if (onError && ws.readyState !== 1) {
        onError('Lost connection to server, try refreshing the page');
        return;
    }

    ws.send(blobStr);
}

/**
 * Format the message so it is understood by the handler
 * 
 * @param {MESSAGE_TYPE} type to inject into message 
 * @param {any} obj to inject type information into 
 * @param {string} id to optionally inject into message 
 */
export function formatMessage(type, obj, id) {
    obj = obj ? obj : {};
    obj.messageType = type;
    if (id) {
        obj.id = id;
    }

    return JSON.stringify(obj);
}

/**
 * Handle a message received on a websocket by parsing and checking for errors
 * 
 * @param {*} ws                on which to handle message 
 * @param {any} data            The data to pass
 * @param {any} typeMap         mapping of MESSAGE_TYPE to function that takes
 *                              a JSON decoded data blob as first argument
 * @param {function} callback   on-complete handler
 */
export function handleMessage(ws, data, typeMap, callback) {

    let parsedData = JSON.parse(data);

    // console.info(`Received a message of type: ${parsedData.messageType}`);
    
    if (parsedData.messageType) {
        
        let config = typeMap[parsedData.messageType];

        if (!config) {
            console.warn(`No config registered for message type: ${parsedData.messageType}`);

            // if (callback) {
            //     return callback();
            // }
            // else {
            //     return;
            // }
            return;
        }

        let handler = config.handler;
        let rateLimited = false;

        const rateLimitKey = `${ws.id}_${handler.name}`;
        if (handler && config.rateLimit && config.rateLimit.rate) {
            let rateLimitInfo = RateLimitCache[rateLimitKey];
            let now = Date.now();

            // If there is no rate limit info, this is the first time
            // Or, if there is rate limit info, it's not being actively rate limited, and the initial time period has passed, then reset it
            if (!rateLimitInfo || ((!rateLimitInfo.unlock || now > rateLimitInfo.unlock) && now > rateLimitInfo.firstTimestamp + config.rateLimit.rate.perMs)) {

                RateLimitCache[rateLimitKey] = {
                    firstTimestamp: Date.now(),
                    hits: 1,
                    unlock: null,
                    atomicLocked: false
                };
            }
            // If there is rate limit info and we're being rate limited, update that
            else {
                rateLimitInfo.hits++;
                
                if (rateLimitInfo.hits > config.rateLimit.rate.hits) {
                    rateLimited = true;
                    rateLimitInfo.unlock = now + RATE_LIMIT_TIMEOUT;
                }
            }
        }

        if (handler && !rateLimited) {
            let wasAtomic = false;

            // If we're treating this function as atomic...
            if (config.rateLimit && config.rateLimit.atomic) {
                wasAtomic = true;

                // If it's currently locked, skip
                if (RateLimitCache[rateLimitKey] && RateLimitCache[rateLimitKey].atomicLocked) {
                    rateLimited = true;
                }
                // Otherwise, lock it and call the handler
                else {
                    if (!RateLimitCache[rateLimitKey]) {
                        RateLimitCache[rateLimitKey] = {
                            firstTimestamp: Date.now(),
                            hits: 1,
                            unlock: null,
                            atomicLocked: true
                        }
                    } else {
                        RateLimitCache[rateLimitKey].atomicLocked = true;
                    }

                    handler(ws, parsedData);
                }
            } else {
                handler(ws, parsedData);
            }

            // Release the lock
            if (wasAtomic && !rateLimited) {
                RateLimitCache[rateLimitKey].atomicLocked = false;
            }
        } else if (!handler) {
            console.warn(`No callback registered for message type: ${parsedData.messageType}`);
        }

        if (rateLimited) {
            let timeout = RATE_LIMIT_TIMEOUT;

            sendMessage(ws, MESSAGE_TYPE.SERVER.RATE_LIMIT, { message: "Woah, slow down!", timeout: RATE_LIMIT_TIMEOUT });
        }
    } else {
        console.warn('No message in payload');
    }

    if (parsedData.messageType !== MESSAGE_TYPE.SERVER.PONG && callback) {
        return callback();
    }
}

/**
 * Find a websocket client by its id
 * 
 * @param {*} wss 
 * @param {*} id 
 */
export function getClientById(wss, id) {
    let tws;
    wss.clients.forEach((ws) => {    
        if (ws.id == id) {
            tws = ws;
        };
    });
    return tws;
}

/* COLOUR FUNCTIONS */

function getRgb(color) {
    let [r, g, b] = color.replace('rgb(', '')
        .replace(')', '')
        .split(',')
        .map(str => Number(str));;
    return {
        r,
        g,
        b
    }
}
  
export function interpolateColour(colorA, colorB, intval) {
    const rgbA = getRgb(colorA),
        rgbB = getRgb(colorB);
    const colorVal = (prop) =>
        Math.round(rgbA[prop] * (1 - intval) + rgbB[prop] * intval);
    return `rgb(${colorVal('r')}, ${colorVal('g')}, ${colorVal('b')})`;
}

export function sanitizeHTML(unsafe) {
    // const decoder = document.createElement('div');
    // decoder.innerHTML = unsafe;
    // return decoder.textContent;

    if (!unsafe) {
        console.warn('Attempted to sanitize null');
        return null;
    }

    return unsafe.toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
}
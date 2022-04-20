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
        MINUS_OPTION: 'minusOption',
        RESET: 'reset',
        KICK: 'kick',
        NOTIFY: 'notify',
        REMOVE_NOTIFY: 'removeNotify',
        TEAM_CHAT: 'teamChat',
        TOGGLE_IMAGE: 'toggleImage',
        TOGGLE_ALLOCATIONS: 'toggleAllocations',
        EMOTE: 'emote',
        USE_HINT: 'useHint'
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

export const MAX_TEAM_SIZE = 5;

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

    console.info(`Received a message of type: ${parsedData.messageType}`);
    
    if (parsedData.messageType) {
        
        let config = typeMap[parsedData.messageType];

        if (!config) {
            console.warn(`No config registered for message type: ${parsedData.messageType}`);

            if (callback) {
                return callback();
            }
            else {
                return;
            }
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
                    unlock: null
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
                if (RateLimitCache[rateLimitKey]) {
                    rateLimited = true;
                }
                // Otherwise, lock it and call the handler
                else {
                    RateLimitCache[rateLimitKey] = Date.now();
                    handler(parsedData);
                }
            } else {
                handler(parsedData);
            }

            // Release the lock
            if (wasAtomic) {
                RateLimitCache[rateLimitKey] = null;
            }
        } else if (!handler) {
            console.warn(`No callback registered for message type: ${parsedData.messageType}`);
        }

        if (rateLimited) {
            // TODO: Make rate limiting its own thing
            sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Woah, slow down!" });
        }
    } else {
        console.warn('No message in payload');
    }

    if (callback) {
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
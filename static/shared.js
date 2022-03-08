/**
 * Define constructs shared between client and server
 * to ensure parity.
 */

import e from "express";

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
        TEAM_CHAT: 'teamChat'
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
        TEAM_CHAT: 'teamChat'
    }
};

export const RateLimitCache = {};

// State machine of game
export const GAME_STATE = {
    PREGAME: 'pregame',
    GAME: 'game',
    ANSWER: 'answer',
    SCORES: 'scores',
    FINISH: 'finish'
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

    console.info(`Received a message of type: ${parsedData.messageType}`);
    
    if (parsedData.messageType) {
        
        let config = typeMap[parsedData.messageType];
        let handler = config.handler;
        let rateLimited = false;

        // TODO: Simplify logic here
        const rateLimitKey = `${ws.id}_${handler.name}`;
        if (handler && config.rateLimit && config.rateLimit.rate) {
            let lastTimeStamp = RateLimitCache[rateLimitKey];

            if (!lastTimeStamp) {
                RateLimitCache[rateLimitKey] = Date.now();
            } else if (lastTimeStamp && Date.now() < lastTimeStamp + config.rateLimit.rate) {
                rateLimited = true;
                RateLimitCache[rateLimitKey] = Date.now();
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
                    console.log('Attempted to call atomic locked function');
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
            sendMessage(ws, MESSAGE_TYPE.SERVER.ERROR_MESSAGE, { message: "Rate limited" });
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
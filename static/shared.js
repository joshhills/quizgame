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
        PONG: 'pong',
        RESET: 'reset',
        LOG: 'log'
    },
    CLIENT: {
        PING: 'ping',
        JOIN: 'join',
        SWAP_TEAM: 'swapTeam',
        PROGRESS_STATE: 'progressState',
        LOCK_IN: 'lockIn',
        RESET_ALLOCATION: 'resetAllocation',
        ADD_OPTION: 'addOption',
        MINUS_OPTION: 'minusOption',
        RESET: 'reset',
        KICK: 'kick'
    }
};

// State machine of game
export const GAME_STATE = {
    PREGAME: 'pregame',
    GAME: 'game',
    ANSWER: 'answer',
    FINISH: 'finish'
};

/**
 * Send an object over a websocket
 * 
 * @param {WebSocket} ws to send message on
 * @param {MESSAGE_TYPE} type to inject into message 
 * @param {object} obj to encode and send 
 * @param {string} id to optionally inject into message 
 */
export function sendMessage(ws, type, obj, id) {
    let blobStr = formatMessage(type, obj, id);
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
 * @param {any} typeMap         mapping of MESSAGE_TYPE to function that takes
 *                              a JSON decoded data blob as first argument
 * @param {function} callback   on-complete handler
 */
export function handleMessage(data, typeMap, callback) {

    let parsedData = JSON.parse(data);

    console.info(`Received a message of type: ${parsedData.messageType}`);
    
    if (parsedData.messageType) {
        let handler = typeMap[parsedData.messageType];

        if (handler) {
            handler(parsedData);
        } else {
            console.warn(`No callback registered for message type: ${parsedData.messageType}`);
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
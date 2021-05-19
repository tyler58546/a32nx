/* eslint-disable no-console */

'use strict';

const WebSocket = require('ws');

const port = process.argv[2] || 8080;
let wss = null;

wss = new WebSocket.Server({ port }, () => {
    console.log(`\x1b[32mExternal MCDU server started.\x1b[0m Port:\x1b[0m \x1b[47m\x1b[30m${port}\x1b[0m`);
});

wss.on('error', (err) => {
    console.error(`${err}`);
    setTimeout(() => {}, 5000);
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

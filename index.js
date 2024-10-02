const express = require('express');
const app = express();
var cors = require('cors');
app.use(cors());
app.use(express.json());
const discordService = require('./app/services/discord-service');
const databaseService = require('./app/services/database-service');
const { petkeDiscordToken, geeDiscordToken } = require("./config.json");

const token = process.env.USERDOMAIN == 'RYZEN'?petkeDiscordToken:(process.env.token || geeDiscordToken);
// settings
port = process.env.PORT || 88

// Routes
app.use('/api/discord', require('./app/api/discord'));
app.use('/', require('./app/api/main'));

// init server
    app.listen(port, () => {
        console.info(`running on port ${port}`);
    });

//init connections
discordService.client.login(token);
databaseService.postgreClient.connect();



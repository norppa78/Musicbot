const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotify-service');
const databaseService = require('../services/database-service');
const { createRun, createAssistant, createThread, createMessage, getMessages } = require('../services/openai-service');

router.get('/', (req, res) => {
    res.send('server check response')
  });

router.get('/track', async (req, res) => {
});

router.get('/bot', async (req, res) => {
  const assistant = await createAssistant('Norppa');
  const thread = await createThread();
  const message = await createMessage(thread, 'Luettele stratovariuksen jäsenet');
  const run = await createRun(assistant, thread);
  const response = await getMessages(thread, message);
  const botResponse = response?.data?.[0]?.content?.[0]?.text?.value;
  res.send(botResponse);
});

module.exports = router;


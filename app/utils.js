const discordService = require('./services/discord-service');
const debugMessage = require('../modules/debug/debug-message');

  module.exports.discordDebugMessage = () => {
    //check for argument messages
    let args = process.argv.slice(2);
    if(args.length && args[0] == '-cli' ) {
        args = args.slice(1);
        let str = args.join(' ');

        if(str.length) {
            debugMessage.content = str;
            let result = discordService.handleMessage(debugMessage);
        }
    }
  }
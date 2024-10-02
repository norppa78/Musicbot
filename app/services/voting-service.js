const databaseService = require('./database-service');
const { id } = require('../../modules/debug/debug-message');

const thumbs = {
    up: '👍',
    down: '👎'
} ;


const addVoteListener = (reaction, user) =>{
    if(reaction.emoji.name === thumbs.up){
        //databaseService.voteUp(reaction.message.id, user.id);
    }
    else if(reaction.emoji.name === thumbs.down){
        //databaseService.voteDown(reaction.message.id, user.id);
    }
}

const removeVoteListener = (reaction, user) =>{
    databaseService.removeVote(reaction.message.id, user.id);
}

module.exports = {
    addVoteListener,
    removeVoteListener,
    thumbs
}

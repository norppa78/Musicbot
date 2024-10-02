// handle all the discord message logic here
const {GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, Client, MessageReaction} = require('discord.js')
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel]
})
const {prefix, token} = require("../../config.json");
const songService = require('./song-service');
const types = require('../types');
const databaseService = require('./database-service');
const spotifyService = require('./spotify-service');
const voteListerners = require('./voting-service');
const openAiService = require('./openai-service');

const musicGenres = ['Rock', 'Pop', 'Metal', 'Electronic', 'Country'];
const musicGenres2 = ['Dance', 'Christmas', 'Progressive', 'Punk', 'Ambient'];

const { generateDependencyReport } = require('@discordjs/voice');
console.log(generateDependencyReport());

//GatewayIntentBits.GUILD_MESSAGES, GatewayIntentBits.GUILD_VOICE_STATES, GatewayIntentBits.DIRECT_MESSAGES, GatewayIntentBits.GUILD_MESSAGE_REACTIONS

const approvedChannelNames = ['music', 'hittimittari','musabotin-komennus','partyby-review'];
const approvedOpenAiChannelNames = ['hittimittari'];
const queue = new Map();
const userAssistants = new Map();

const {
    getVoiceConnection,
    AudioPlayer,
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    disconnect,
    VoiceConnectionStatus
} = require('@discordjs/voice');

// connection messages
client.once('ready', () => {
    console.log('Ready!');
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});

/***
 * On discord messages
 */
client.on("messageCreate", async message => {
    if (message.bot) return;
    handleMessage(message);
});

/***
 * react to voiceChannel changes (enter / leave)
 */
client.on('voiceStateUpdate', (oldState) => {
   const channelMembers = oldState?.channel?.members;
  
   if (channelMembers?.some(member => member?.displayName.includes('partyby') || member?.displayName.includes('dj-kaamos')) && channelMembers?.size < 2) {
       const guildId = oldState?.guild?.id;
       exit(guildId);
   }
});

client.on('messageReactionAdd', voteListerners.addVoteListener);
client.on('messageReactionRemove', voteListerners.removeVoteListener);

let buttonCategories = null;

const buildButtons = async (selected) => {
    buttonCategories = buttonCategories ?? await databaseService.getPinnedCategories();
    const buttonsPerComponent = 5 

    const componentArrays = buttonCategories.reduce((resultArray, item, index) => { 
        const buttonIndex = Math.floor(index/buttonsPerComponent)

        if(!resultArray[buttonIndex]) {
            resultArray[buttonIndex] = [] // start a new component
        }

        resultArray[buttonIndex].push(item);
        return resultArray;
    }, []);

    return componentArrays.map(component => {
        return {
            "content": "Choose a genre!",
            "type": 1,
            "components": component.map(category => {
                return {
                    "type": 2,
                    "label": category.name,
                    "style": selected === category.id ? 3 : 1,
                    "custom_id": category.id
                }
            })
        }
    });
}

const sendComponent = async (selected = false) => {
    const comps = await buildButtons(selected);
    const component = {
        "content": "Choose a genre!",
        "components": comps
    }
    return component;
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
     console.log("triggering", interaction.webhook);



    console.log("getting with id : ", interaction.customId);
    const genreList = await spotifyService.getSongsByCategoryId(interaction.customId)
    console.log("genrelist", genreList?.length);
    if (!!genreList) {
        const component = await sendComponent(interaction.customId);
       
        interaction.update(component)
        .then().catch(console.error);
      
       execute(interaction, queue.get(interaction.guild?.id), genreList, true);
    }
    });

const handleMessage = async (message) => {
    const musicChannelPresent = approvedChannelNames.find(v => message?.channel?.name?.includes(v));
    const openAimusicChannelPresent = approvedOpenAiChannelNames.find(v => message?.channel?.name?.includes(v));

    if (!musicChannelPresent) return;
    let serverQueue = queue.get(message.guild.id);

    
    if ((message.content !== `${prefix}play` && message.content.startsWith(`${prefix}play`)) || (!!musicChannelPresent && message.content?.includes('https'))) {
        const url = message.content.includes(`${prefix}play`) ? message.content.split('!play ')[1].split(' ')[0] : message.content;
        const urlType = types.urlTypes.filter(types => !!(
            types.identifiers.every(keyword => url.includes(keyword)) && 
            !types.excluded.some(exclude => url.includes(exclude))
            ))?.[0] || null;
        if (!urlType) {
            message.channel.send("this url is not supported!");
        } else {
            songService.processSongUrl(url, urlType)
                .then(songs => {
                    let filteredSongs = songs.filter(song => !!song.title);
                    if (filteredSongs.length) {
                        execute(message, queue.get(message.guild.id), filteredSongs)
                    } else {
                        message.channel.send("song not found! try something else...");
                    }
                })
                .catch(err => {
                    console.log("error getting song array", err)
                });
        }
        return;
    } else if (message.content.startsWith(`${prefix}top`)){
        const params = message.content.split('!top ');
        let listSize = 10;
        let username = '';

        if(params.length > 1){
            let p = params[1].split(' ')
            if(parseInt(p[0]) !== 'NaN'){
                listSize = p[0];
            }

            if(p.length > 1){
                username = p[1];
            }
        }

        topList = await databaseService.getTopSongs(listSize, username);
        execute(message, serverQueue, topList, true);

    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, queue.get(message.guild.id));
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, message.guild, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}pause`)) {
        queue.get(message.guild.id).player.pause();
        return;
    } else if (message.content === (`${prefix}play`)) {
        queue.get(message.guild.id).player.unpause();
        return;
    } else if (message.content.startsWith(`${prefix}apua`) || message.content.startsWith(`${prefix}help`)) {
        const exampleEmbed = {
            color: 0x0099ff,
            title: `music-bot Commands :`,
            fields: ([
                {name: '![free search with song name and optional artist name]', value: 'example : !titanic frederik'},
                {name: '!play [song or playlist url]', value: 'example : !play https://www.youtube.com/watch?v=FiPqUjLMuA8'},
                {name: '!skip', value: 'Skip to next song on playlist'},
                {name: '!stop', value: 'Stop playback and destroy playlist'},
                {name: '!pause', value: 'Pause playback'},
                {name: '!play', value: 'Continue playback'},
                {name: '!list', value: 'Show current playlist'},
                {name: '!random [limit]', value: 'Examples : Play random songs = !random. Play 10 random songs : !random 10'},
                {name: '!apua or !help', value: 'Show commands'},
                {name: '!top', value: 'Top |10-30| <username>'},
                {name: '!genre', value: 'Show genre quick selections'}
            ]),
        };
        message.channel.send({embeds: [exampleEmbed]});
    } else if (message.content.startsWith(`${prefix}list`)) {
        if (serverQueue) {
            if (!serverQueue.songs?.length) {
                const exampleEmbed = {
                    color: 0x0099ff,
                    title: `Random Playlist : ${serverQueue.randomList?.length}, ( move to next song with !skip )`,
                    fields: (serverQueue.randomList?.map((song, index) => ({name: `${index + 1}`, value: `${song.title}`}))),
                };
                message.channel.send({embeds: [exampleEmbed]});
            } else {
                const exampleEmbed = {
                    color: 0x0099ff,
                    title: `Playlist : ${serverQueue.songs?.length}, ( move to next song with !skip )`,
                    fields: (serverQueue.songs?.map((song, index) => ({name: `${index + 1}`, value: `${song.title}`}))),
                };
                message.channel.send({embeds: [exampleEmbed]});
            }
           
        } else {
            const exampleEmbed = {
                color: 0x0099ff,
                title: `Playlist : 0`,
            };
            message.channel.send({embeds: [exampleEmbed]});
        }
    } else if (message.content.startsWith(`${prefix}random`)) {
        const listSize = message.content.split('random ')[1];
        randomList = await databaseService.getRandomSongs(listSize || 100);
        execute(message, serverQueue, randomList, true);

    } else if (message.content.startsWith(`${prefix}genre`) || (!!musicChannelPresent && message.content.startsWith('genre'))) {
        const component = await sendComponent();
        message.channel.send(component);
    } else if (message.content.startsWith(`${prefix}update`)) {
        const cats = await spotifyService.getMusicCategories();
        cats.forEach(cat => {
            let dbUpdate = databaseService.addSpotifyCategories(cat);
        });
    }
    else if (message.content.startsWith(`${prefix}`) && !message.author.bot) {
        const freeSearch = message.content.split('!')[1];

        const song = await spotifyService.getSingleSongsByFreeSearch(freeSearch);
        if (song) {
            execute(message, queue.get(message.guild.id), [song]);
        } else {
            message.channel.send("Song not found! try something else...");
        }
    } else if (!message.author.bot && openAimusicChannelPresent && !message.content.includes(`(`)) {
        const userAssistant = userAssistants.get(message.author.globalName);
        if (!!userAssistant) {
            handleOpenAiMessages(userAssistant, message)
        } else {
            let openAiConstruct = {
                assistant: await openAiService.createAssistant(message.author.globalName),
                thread: await openAiService.createThread(),
            }
            userAssistants.set(message.author.globalName, openAiConstruct);
            handleOpenAiMessages(openAiConstruct, message);
        }
    }
}

handleOpenAiMessages = async(userAssistant, message) => {
    let openAimessage = await openAiService.createMessage(userAssistant.thread, message.content);
    let songObjectList = await openAiService.createRun(userAssistant.assistant, userAssistant.thread);
    let response = await openAiService.getMessages(userAssistant.thread, openAimessage);
    const botResponse = response?.data?.[0]?.content?.[0]?.text?.value;
    let responseArray = botResponse?.split("\n");
    let title = responseArray.shift();
    let restrictedTitle = title.substring(0, 254);
   
    const embed = {
        color: 0x6b65bd,
        title: restrictedTitle,
        fields: (responseArray?.map((field) => ({ name: field, value: '' })).filter((val,index) => index < 23)),
    };
   
    message.channel.send({embeds: [embed]});

    if (!!songObjectList?.length) {
        execute(message, queue.get(message.guild.id), songObjectList);
    }
}

//operations
async function execute(message, serverQueue, songs, randomize = false) {
    let voiceChannel = message?.member?.voice?.channel?.id;

    if (!voiceChannel) {
        const embed = {
            color: 0xefa123,
            title: `${message.author.globalName}, you need to be in a voice channel to play music! `,

        };
        message.channel.send({embeds: [embed]})
        return
    }

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            resource: null,
            songs: [],
            randomList: [],
            volume: 5,
            playing: true,
            subscription: null,
            player: createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause
                }
            })
        };
        
        if (randomize) {
            queueContruct.randomList = songs;
        } else {
            queueContruct.songs = [...queueContruct.songs, ...songs];
        }


        try {
            const connection = joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            });

            queueContruct.player.on(AudioPlayerStatus.Idle, () => {
                console.log("idling, starting next song")
                play(message, message.guild);
            });

            queueContruct.player.on('error', error => {
                console.error('Error:', error?.message, 'with track', error?.resource?.metadata?.title);
            });

            const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
                const newUdp = Reflect.get(newNetworkState, 'udp');
                clearInterval(newUdp?.keepAliveInterval);
              }
              connection.on('stateChange', (oldState, newState) => {
                Reflect.get(oldState, 'networking')?.off('stateChange', networkStateChangeHandler);
                Reflect.get(newState, 'networking')?.on('stateChange', networkStateChangeHandler);
              });

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log("connection ready, starting first song")
                play(message, message.guild);
            });

            connection.subscribe(queueContruct.player);
            queueContruct.connection = connection;
            queue.set(message.guild.id, queueContruct);


        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else if (randomize) {
        console.log("adding to random", songs?.length)
        if (songs) {
        serverQueue.songs = [];
        serverQueue.randomList = [...songs];
        console.log("serverQueue first two", serverQueue.randomList[0], serverQueue.randomList[1])
        }
    } else {
        serverQueue.songs = [...serverQueue.songs, ...songs];
        const exampleEmbed = {
            color: 0x0099ff,
            title: `Playlist : ${serverQueue.songs?.length}, ( move to next song with !skip )`,
            fields: (serverQueue.songs?.map((song, index) => ({name: `${index + 1}`, value: `${song.title}`}))),
        };
        message.channel.send({embeds: [exampleEmbed]});
    }
}

function skip(message, serverQueue) {
    console.log("skipping",)
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    play(message, message.guild);
}

function stop(message, guild, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song that I could stop!");

    console.log("stop playing");
    serverQueue.player.stop();
    serverQueue.connection.destroy(true);
    queue.delete(guild.id);
    delete serverQueue;
};

/***
 * Destroy connection and leave channel
 */
function exit(guildId) {
    console.log("im all alone! going to sleep..");
    const serverQueue = queue.get(guildId);
    serverQueue.player.stop();
    serverQueue.connection.destroy(true);
    queue.delete(guildId);
    delete serverQueue;
};

async function play(message, guild) {
    console.log("starting play")
    let serverQueue = queue.get(guild.id);
    if (serverQueue) {
        let {resource, song} = await songService.getNextResource(serverQueue);
        if (resource) {
            const embed = {
                color: 0xefa123,
                title: `Now playing: ${song.title}`,

            };
                message.channel.send({embeds: [embed]}).then(response => {
                saveSongToDatabase(song, response);
            });
            serverQueue.player.play(resource);
        } else {
            console.log("no more songs")
            serverQueue.player.stop();
            serverQueue.connection.destroy(true);
            queue.delete(guild.id);
            delete serverQueue;
        }
    } else {
        console.log("serverQueue not found")
    }
}

const saveSongToDatabase = (song, message) => {
    if (!['database', 'random'].includes(song.source)) {
        databaseService.setSongInfo(song);
    }

    if (!['random'].includes(song.source)) {
        saveHistory(song, message);
    }
}

const saveHistory = (song, message) =>{
    databaseService.saveMessageHistory(message.id,song.id_youtube, message.author);
}

module.exports.handleMessage = handleMessage;
module.exports.client = client;

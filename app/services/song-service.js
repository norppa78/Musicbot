const spotifyService = require('./spotify-service');
const googleService = require('./google-service');
const databaseService = require('./database-service');
const playDL = require('../../play-dl-dist');
const { id } = require('../../modules/debug/debug-message');
const {
    createAudioResource,
} = require('@discordjs/voice');

// process song urls based on url type
const processSongUrl = async (url, urlType) => {
    switch (urlType.type) {
        case "youtube watch":
            return await databaseService.getSongInfo(urlType.pattern(url)) || await googleService.getTrackInfo([urlType.pattern(url)]);
        case "youtube default":
            return await databaseService.getSongInfo(urlType.pattern(url)) || await googleService.getTrackInfo([urlType.pattern(url)]);
        case "youtube playlist":
            let listOfSongInfo = await googleService.searchPlayListItems(urlType.pattern(url));
            let YTplaylist = await Promise.all(listOfSongInfo.map(async (song) => await databaseService.getSongInfo(song.id) || [song]));
            return YTplaylist.map(song => song[0]);
        case "spotify track":
            return await databaseService.getSongInfo(urlType.pattern(url)) || [await spotifyService.getSpotifyTrackInfo(urlType.pattern(url))];
        case "spotify album": {
            let spotifyAlbumTracks = await spotifyService.getAlbumInfo(urlType.pattern(url));
            let spotifyAlbum = await Promise.all(spotifyAlbumTracks.map(async (song) => await databaseService.getSongInfo(song.id) || [song]));
            return spotifyAlbum.map(song => song[0]);
        }
        case "spotify playlist": {
            let spotifyPlaylistTracks = await spotifyService.getPlaylistInfo(urlType.pattern(url));
            let spotifyPlaylist = await Promise.all(spotifyPlaylistTracks.map(async (song) => await databaseService.getSongInfo(song.id) || [song]));
            return spotifyPlaylist.map(song => song[0]);
        }
        case "spotify artist": {
            let spotifyArtistTracks = await spotifyService.getArtistTopTracks(urlType.pattern(url));
            let spotifyArtistPlaylist = await Promise.all(spotifyArtistTracks.map(async (song) => await databaseService.getSongInfo(song.id) || [song]));
            return spotifyArtistPlaylist.map(song => song[0]);
        }
        default:
        // code block
    }
}

const getNextResource = async (serverQueue) => {
    let nextSong = serverQueue.songs?.shift() || serverQueue.randomList?.shift();
    console.log("next song", nextSong);
    if (!nextSong) {
        return {};
    } else {
        let nextId = await getYoutubeId(nextSong);
        console.log("next id", nextId);
        if (!nextId) {
            return getNextResource(serverQueue);
        } else {
            console.log("sending to playdl", nextId);
            let nextUrl = `${googleService.youtubeBaseUrl}${nextId}`;
            return await playDL.stream(nextUrl)
                .then(stream => {
                    return {
                        resource: createAudioResource(stream.stream, {
                            inputType : stream.type
                        }), 
                        song: {
                            id_youtube: nextId,
                            id_spotify: nextSong.source === "spotify" ? nextSong.id : '',
                            title: nextSong.title?.replace(/'/g, "''"),
                            source: nextSong.source
                        }
                    }
                })
                .catch(err => {
                    console.log("error while getting stream", err);
                    return getNextResource(serverQueue);
                })
        }
    }
};

/**
 * get song id based on nextSong source property
 * 
 * @param {*} nextSong object including {it,title,source}
 * @returns 
 
 */
const getYoutubeId = async(nextSong) => {
    if (nextSong?.source?.includes("spotify")) {
        const searched = await playDL.search(nextSong.title, { limit : 1 });
        console.log("searched", searched?.[0]?.id);
        return searched?.[0]?.id;
    } else {
        return nextSong.id;
    }
}

module.exports.processSongUrl = processSongUrl;
module.exports.getNextResource = getNextResource;
const axios = require('axios');
const { spotifyClient, spotifySecret } = require('../../config.json');
const trackUrl = "https://api.spotify.com/v1/tracks/";
const albumUrl = "https://api.spotify.com/v1/albums/";
const playlistUrl = "https://api.spotify.com/v1/playlists/";
const artistUrl = "https://api.spotify.com/v1/artists/";
const genreUrl = "https://api.spotify.com/v1/search";
const categoryUrl = "https://api.spotify.com/v1/browse/categories/";
const browseCat = "https://api.spotify.com/v1/browse/categories?limit=50&country=FI"
const maxPlaylistSize = 50;

const authenticateUrl = "https://accounts.spotify.com/api/token";
const authenticateClient = process.env.spotifyClient || spotifyClient;
const authenticateSecret =  process.env.spotifySecret || spotifySecret;

const utils = require('../utils');

// Authenticate options
let authenticateData = `${authenticateClient}:${authenticateSecret}`;
let authenticateBuffer = Buffer.from(authenticateData, 'utf8');
let authenticateBase64 = authenticateBuffer.toString('base64');
const authenticateOptions = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authenticateBase64}`
    }
  };

let savedApiOptions;
let tokenFailed;

const getSpotifyTrackInfo = async (track) => {
  const apiOptions = await authenticate();
  const trackInfo = await axios.get(`${trackUrl}${track}`, apiOptions).then((result) => {
        return createSongInfo(result.data);
  })
  .catch((err) => {
    console.log("spotify getTrackInfo error", err)
    return err;
  });
  return trackInfo;
};

const getAlbumInfo = async(album) => {
    const apiOptions = await authenticate();
    const albumInfo = await axios.get(`${albumUrl}${album}`, apiOptions).then((result) => {
        return result.data.tracks.items.slice(0, maxPlaylistSize).map(track => createSongInfo(track.track || track));
    })
        .catch((err) => {
            console.log("spotify getAlbum error", err)
            return err;
        });
    return albumInfo;
}

const getPlaylistInfo = async(playlist) => {
    const apiOptions = await authenticate();
    console.log("apioptions", apiOptions, playlist);
    const playlistInfo = await axios.get(`${playlistUrl}${playlist}/tracks?market=FI&limit=50`, apiOptions).then((result) => {
      console.log("res", result.data?.items?.length);
      return result.data.items.slice(0, maxPlaylistSize).map(track => createSongInfo(track.track || track));
    })
        .catch((err) => {
            console.log("spotify getPlayListInfo error", err.code)
            tokenFailed = true;
            return null;
        });
    return playlistInfo;
}

const getArtistTopTracks = async(artist) => {
  const apiOptions = await authenticate();
  const artistTopTracks = await axios.get(`${artistUrl}${artist}/top-tracks?market=ES`, apiOptions).then((result) => {
    return result.data.tracks.slice(0, maxPlaylistSize).map(track => createSongInfo(track.track || track));
  })
      .catch((err) => {
          console.log("spotify getPlayListInfo error", err)
          return err;
      });
  return artistTopTracks;
}

const getMusicCategories = async () => {
  const apiOptions = await authenticate();
    const categories = await axios.get(`${browseCat}`, apiOptions).then((result) => {
    return result?.data?.categories?.items?.map(cat => ({"name": cat.name, "id": cat.id}))
  })
  .catch((err) => {
    console.log("spotify category error", err)
    return null;
  });

  console.log("categories", categories?.length);
  return categories
}

const getSongsByFreeSearch = async (genre) => {
  const apiOptions = await authenticate();
  const playlistInfo = await axios.get(`${genreUrl}?q=${genre}&type=playlist&limit=10&market=FI`, apiOptions).then((result) => {
    const playlists = result?.data?.playlists?.items;
    
    const randomPlaylist = playlists?.[Math.floor(Math.random() * playlists.length)];
    console.log("from getSongsByFreeSearch", randomPlaylist.id, randomPlaylist.name);
   return randomPlaylist;
  })
  .catch((err) => {
    console.log("spotify getSongsByFreeSearch", err)
    tokenFailed = true;
    return null;
  });

  const list = await getPlaylistInfo(playlistInfo.id);

  return !!playlistInfo?.id ? {title: playlistInfo.name, list} : null;
};

const getSingleSongsByFreeSearch = async (search) => {
  const apiOptions = await authenticate();
  const songInfo = await axios.get(`${genreUrl}?q=${search}&type=track&limit=1&market=FI`, apiOptions).then((result) => {
    const track = result?.data?.tracks.items[0] || null;
    return !!track ? createSongInfo(track) : null;
  })
  .catch((err) => {
    console.log("spotify getSingleSongsByFreeSearch", err)
    tokenFailed = true;
    return null;
  });

  return songInfo
};

const getSongsByCategoryId = async (id) => {
  const apiOptions = await authenticate();
    const playlistId = await axios.get(`${categoryUrl}${id}/playlists?country=FI`, apiOptions).then((result) => {
    
    const playlists = result.data?.playlists?.items;
    console.log("playlists", result.data.playlists?.items?.length);
    
    const randomPlaylist = playlists?.[Math.floor(Math.random() * playlists.length)];
    console.log("getSongsByCategoryId", randomPlaylist?.id);
    return randomPlaylist?.id;
  })
  .catch((err) => {
    console.log("spotify getSongsByCategoryId", err.code)
    tokenFailed = true;
    return null;
  });

  console.log("playlistId", playlistId);
  return !!playlistId ? getPlaylistInfo(playlistId) : null;
};

const authenticate = () => {
    if (tokenFailed) {
      console.log("token failed")
      savedApiOptions = null;
    }

    if (savedApiOptions) {
      return savedApiOptions;
    }

    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials');
    return axios.post(authenticateUrl, params, authenticateOptions).then((result) => {
      const access_token = result.data.access_token;
      const refresh_token = result.data.refresh_token;
      utils.discordDebugMessage();
      savedApiOptions = {
        headers: {
          'Content-Type': 'Content-Type: application/json',
          'Authorization': `Bearer ${access_token}`
        }
      };
      tokenFailed = false;
      return savedApiOptions;
    })
    .catch((err) => {
      console.log("error", err)
    });
}

const createSongInfo = (track) => {
    let artist = track?.artists?.find(artist => !!artist.name && artist.type === 'artist');
    return {
      id: track.id,
      title: `${artist.name} - ${track.name}`,
      source: "spotify"
    }
};

module.exports = {
    authenticate,
    getSpotifyTrackInfo,
    getAlbumInfo,
    getPlaylistInfo,
    createSongInfo,
    getArtistTopTracks,
    getSongsByCategoryId,
    getSongsByFreeSearch,
    getMusicCategories,
    getSingleSongsByFreeSearch
}
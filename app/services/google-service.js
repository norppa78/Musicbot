const {google} = require('googleapis');
const { googleApiKey } = require('../../config.json');
const youtubeBaseUrl = "https://youtu.be/";

const client = google.youtube({
    version: 'v3',
    auth: process.env.googleApiKey || googleApiKey
});

const searchTrack = async (search) => {
     return client.search.list({
    "part": [
        "snippet"
        ],
      "q": search
    }).then(function(response) { 
               return response.data?.items[0]?.id?.videoId;
        })
    .catch(error => {
      console.error("Error in search track", error);      
      return null;
    });
};

const getTrackInfo = async (id) => {
  return client.videos.list({
    "part": [
      "id",
      "snippet",
      "status"
    ],
    "id": [...id]
  }).then(function(response) {
               return response?.data?.items?.map(item => (
                 {
                  id: item.id,
                  title: item.snippet?.title,
                  source: "youtube"
                }));
        })
    .catch(error => {
      console.log("error getting track info", error)
      return [];
    });
}

const searchPlayListItems = (search) => {
    return client.playlistItems.list({
        "part": [
          "snippet",
          "status"
        ],
        "maxResults": 40,
        "playlistId": search
      }).then(function(response) {
            return response.data.items.map(item => ({
              id: item.snippet.resourceId.videoId,
              title: item.snippet?.title,
              source: "youtube"
            })).filter(track => !track.title.includes("Deleted"));
        })
        .catch(error => {
        console.error(error);
        return [];
        });
}

module.exports = {
    searchTrack,
    searchPlayListItems,
    getTrackInfo,
    youtubeBaseUrl
}
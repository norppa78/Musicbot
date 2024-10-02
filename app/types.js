// types
module.exports.urlTypes = [
    {type: "youtube watch", identifiers: ["watch", "youtube"], excluded: ["list"], pattern: (url) => url.split("v=")[1].split("&")[0]},
    {type: "youtube default", identifiers: ["youtu.be"], excluded: ["list"], pattern: (url) => url.split("youtu.be/")[1].split("&")[0]},
    {type: "youtube playlist", identifiers: ["list", "youtube"], excluded: [], pattern: (url) => url.split("list=")[1].split("&")[0]},
    {type: "spotify track", identifiers: ["spotify", "track"], excluded: [], pattern: (url) => url.split("/track/")[1].split("?")[0]},
    {type: "spotify album", identifiers: ["spotify", "album"], excluded: [], pattern: (url) => url.split("/album/")[1].split("?")[0]},
    {type: "spotify playlist", identifiers: ["spotify", "playlist"], excluded: [], pattern: (url) => url.split("/playlist/")[1].split("?")[0]},
    {type: "spotify artist", identifiers: ["spotify", "artist"], excluded: [], pattern: (url) => url.split("/artist/")[1].split("?")[0]},
];
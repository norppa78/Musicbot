const { Client } = require('pg');
const { postgreSql } = require("../../config.json");


const postgreClient = new Client({
  connectionString: process.env.DATABASE_URL || postgreSql,
  ssl: {
    rejectUnauthorized: false
  }
});

const logSongMatrix = () => {
    dbExecuteS('SELECT * FROM song_matrix', []).then(result =>{
        console.log(JSON.stringify(result));
    });
}

const getPinnedCategories = () => {
    console.log("getting pinned categories");
    let sqlQuery = 'SELECT * FROM categories WHERE "pinned" = $1';
    return dbExecuteS(sqlQuery, [true]).then(result => result.rows.map(row => ({
        id: row.id,
        name: row.name
    })));
}

const addSpotifyCategories = (category) => {
    let sqlQuery = `INSERT INTO categories (id, name) 
    VALUES ('${category.id}', '${category.name}') ON CONFLICT (id) DO UPDATE SET id = '${category.id}';
    `;
    dbExecute(sqlQuery);
}

/***
 *
 * @param songMatrix Array
 */
const setSongInfo = (songInfo) => {
    let sqlQuery = `INSERT INTO song_matrix (id_youtube, id_spotify, title, source) 
    VALUES ('${songInfo.id_youtube}', '${songInfo.id_spotify}', '${songInfo.title}','${songInfo.source}')
    ON CONFLICT (id_youtube) DO UPDATE 
    SET id_spotify = '${songInfo.id_spotify}', 
        title = '${songInfo.title}',
        source = '${songInfo.source}'
        ;
    `;
    console.log("Adding new song to database", songInfo.title);
    dbExecute(sqlQuery);
}

const getSongInfo = async (id) => {
    let sqlQuery = `SELECT * FROM song_matrix WHERE "id_youtube" = $1 OR "id_spotify" = $1`;

    let result = dbExecuteS(sqlQuery,[id]).then(result =>{
        if(result?.rows?.length){
            return result.rows.map(row => ({
                id: row.id_youtube,
                title: row.title,
                source: "database"
            }));
        }
        else{
            return false;
        }
    });

    return result;
}

/***
 * Save history row to message_history table
 * @param {number} id_message message.id
 * @param {string} id_song id_youtube
 * @param {Object} user discord.js user object
 * @returns {boolean}
 */
const saveMessageHistory = (id_message, id_song, user) => {
    let sqlQuery = `INSERT INTO users VALUES ('${user.id}', '${user.username}') ON CONFLICT (id_user) DO UPDATE SET username = '${user.username}'`;

    dbExecute(sqlQuery);

    console.log("Saving message history to database", id_message);
    sqlQuery = `INSERT INTO message_history VALUES ('${id_message}','${id_song}','${user.id}')`;

    dbExecute(sqlQuery);

}

const voteUp = (id_message, id_user) => {

    let sqlQuery  = `SELECT "id_youtube" FROM message_history WHERE "id_message" = $1`;

    dbExecuteS(sqlQuery,[id_message]).then(result => {
        if(result?.rows?.length) {
            let id_youtube = result.rows[0]['id_youtube'];
            sqlQuery = `INSERT INTO votes ("id_youtube", "id_user", "id_message","vote") VALUES ('${id_youtube}', '${id_user}', '${id_message}',1)`;
            dbExecute(sqlQuery);
        }
    });

};

const voteDown = (id_message, id_user) =>{
    let sqlQuery  = `SELECT "id_youtube" FROM message_history WHERE "id_message" = $1`;

    dbExecuteS(sqlQuery,[id_message]).then(result => {
        if(result?.rows?.length) {
            let id_youtube = result.rows[0]['id_youtube'];
            sqlQuery = `INSERT INTO votes ("id_youtube", "id_user", "id_message","vote") VALUES ('${id_youtube}', '${id_user}', '${id_message}',-1)`;
            dbExecute(sqlQuery);
        }
    });
};

const removeVote = (id_message, id_user) => {
    let sqlQuery = `DELETE FROM votes WHERE id_message = '${id_message}' AND id_user = '${id_user}'`;
    dbExecute(sqlQuery);
};

const getRandomSongs = (limit, username = false) => {

    if (!username){
        let sqlQuery = `SELECT *
                        FROM song_matrix
                        ORDER BY RANDOM() LIMIT $1`;
        return dbExecuteS(sqlQuery, [limit]).then(result => result.rows.map(row => ({
            id: row.id_youtube,
            title: row.title,
            source: "random"
        })));
    }
    else {
        let sqlQuery = `SELECT sm.*
                        FROM song_matrix sm
                                 JOIN votes v on v.id_youtube = sm.id_youtube
                                 JOIN users u on u.id_user = v.id_user AND u.username = '${username}'
                                 JOIN message_history mh on mh.id_user = u.id_user
                        ORDER BY RANDOM() LIMIT $1`;

        return dbExecuteS(sqlQuery, [limit]).then(result => result.rows.map(row => ({
            id: row.id_youtube,
            title: row.title,
            source: "random"
        })));

    }
};

const getTopSongs = (limit, username) => {
    let sqlQuery = `SELECT sm.id_youtube, sm.title, SUM(v.vote) as votes_count FROM song_matrix sm 
                    JOIN votes v on v.id_youtube = sm.id_youtube `
                    + (username.length?` join users u on u.id_user = v.id_user AND u.username = '${username}'`:``) +
                    `GROUP BY sm.id_youtube ORDER BY votes_count DESC limit '${limit}';`

    return dbExecuteS(sqlQuery,[limit]).then(result => result?.rows?.map(row => ({
        id: row.id_youtube,
        title: row.title,
        source: "top"
    })));
};

/***
 * Execute non querying statement against db
 * @param {string} sqlQuery SQL query
 * @returns {Promise<unknown | boolean>}
 */
const dbExecute = (sqlQuery) =>{

    let result = postgreClient.query(sqlQuery).then(result => {
        return result;
    }).catch(error => {
        console.log("dbExecute error", error)
        return false;
    });

    return result;
}

/***
 * Execute select statement against db
 * @param {string} sqlQuery SQL query
 * @param {Array} params
 * @returns {Promise<unknown | boolean>}
 */
const dbExecuteS = (sqlQuery,params) => {
    let result =  postgreClient.query(sqlQuery , params).then(result =>{
        if(result?.rows?.length){
            return result;
        }
        else{
            return false;
        }
    }).catch(error => {
        console.log("dbExecuteS error", error)
        return false;
    });

    return result;
}


module.exports = {
    postgreClient,
    logSongMatrix,
    setSongInfo,
    getSongInfo,
    saveMessageHistory,
    voteUp,
    voteDown,
    removeVote,
    getRandomSongs,
    getTopSongs,
    addSpotifyCategories,
    getPinnedCategories
};

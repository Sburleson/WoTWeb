const fs = require('fs');
const express = require('express');
const { get } = require('http');
const multer = require('multer');
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const { spawn } = require('child_process');
const fs2 = require('fs').promises;
const path = require('path');
const { promises: fsPromises } = require('fs');
const { connectStorageEmulator } = require('firebase/storage');
const { constrainedMemory } = require('process');

const port = 8080;
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static('static'));

function getPlayers(data) {
    // using 2 part json. data = data2.json
    // const playersList = data[0]["players"];
    try {
        const playersList = data[0]["players"];
        //console.log("plist",playersList);
        const players = [];
        for (const x in playersList) {
            let name = playersList[x]["name"];
            //let realname = playersList[x]["realName"];
            players.push(name);
        }
        console.log("players", players)
        return players;
    } catch (error) {
        console.log("in GetPlayers:",error);
    }
}

function getSessionID(playerList, name,data) {
    try {
        const seshIDList = data[1];
    for (const x in playerList) {
        for (const y in seshIDList) {
            if (seshIDList[y]["fakeName"] == name) {
                return seshIDList[y]["avatarSessionID"];
            }
        }
    }

    } catch (error) {
        console.log("in GetSessionID:",error);
    }
}

function getTank(seshID,data) {
    try {
        let tank = data[1][seshID].vehicleType;
        const pattern = /^[^_]+_(.*)/;
        let match = tank.match(pattern);
        tank = match[1];
        return tank;  
        
    } catch (error) {
        console.log("error in getTank",error);
    }
    
}

function getPerformance(seshID,data) {
    let perf = data[0]['vehicles'][seshID];
    return perf;
}

function getDamage(performance) {
    return performance[0]['damageDealt'];
}

function getPenrate(performance) {
    const hits = performance[0]['directEnemyHits'];
    const pens = performance[0]['piercings'];
    return [hits, pens];
}

function getKills(performance) {
    return performance[0]['kills'];
}

function getWin(data,performance){
    const winTeam = data[0]['common']['winnerTeam'];
    const onTeam = performance[0]['team'];
    if(winTeam == onTeam){
        return 1;
    }
    else{
        return 0;
    }
}

function getRealName(name,data){
    players = data[0].players;
    for( x in players){
        if(name == players[x].name){
            console.log(players[x].realName);
            return players[x].realName;
        }
    }
}

function getDBID(data, seshID){
    return data[0]['vehicles'][seshID][0]["accountDBID"];
}

function createTankers(players,data) {
    try {
        let tankers = [];
        for (let x in players) {
            let name = players[x];
            let ID = getSessionID(players,name,data);
            let tank = getTank(ID,data);
            let perf = getPerformance(ID,data);
            let damage = getDamage(perf);
            let shots = getPenrate(perf);
            let hits = shots[0]; // wouldnt let me do hits,pens = genPenrate();
            let pens = shots[1];
            let kills = getKills(perf);
            let win = getWin(data,perf);
            let realname = getRealName(name,data);
            ID = getDBID(data, ID);
            name = realname;
            const T = new Player(name, tank, damage, hits, pens, kills, win, ID);
            tankers.push(T);
        }
        return tankers;
    } catch (error) {
        console.log("error in createTankers:",error)
    }
}

class Player {
    constructor(name, tank, damage, hits,pens, kills, win,ID) {
        this.name = name;
        this.tank = tank;
        this.damage = damage;
        this.hits = hits;
        this.pens = pens;
        this.kills = kills;
        this.win = win
        this.ID = ID
    }
}

// start of main:

const jsonFilePath = 'data2.json';

async function checkFileExists(filePath) {
    return new Promise((resolve, reject) => {
        const watcher = fs.watch(path.dirname(filePath), (eventType, filename) => {
            if (eventType === 'change' && filename === path.basename(filePath)) {
                console.log("File found!");
                watcher.close();
                resolve();
            }
        });

        watcher.on('error', (error) => {
            reject(error);
        });
    });
}

const storage = multer.diskStorage({
    destination: 'uploads/', // Destination directory for uploaded files
    filename: function(req, file, cb) {
        cb(null, 'upload.wotreplay'); // Rename the file to 'upload.wotreplay'
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('replay'), (req, res) => {
    console.log('Type of res.headersSent after file upload:', typeof res.headersSent);
    console.log(req.file); // Log file information
    console.log(req.body); // Log body fields
    if (req.file) {
      res.json({ message: 'File uploaded successfully', file: req.file });
      Analyze();
    } else {
      res.status(400).json({ error: 'File upload failed' });
    }
    
  });

async function Analyze(){
    const RustProcess = spawn('C:/Users/simon/Desktop/Wot_Analyzer/WoTReplay-Analyzer/parser/target/debug/WoTReplay-Analyzer.exe', ['uploads/upload.wotreplay']);

    RustProcess.stdout.on('data', (data) => {
        console.log(`Rust script stdout: ${data}`);
    });

    RustProcess.stderr.on('data', (data) => {
        console.error(`Rust script stderr: ${data}`);
    });

    RustProcess.on('close', (code) => {
        console.log(`Rust script process exited with code ${code}`);
    });

    try {
        console.log("Waiting for file to exist...");
        await checkFileExists(jsonFilePath);
        console.log("File exists, reading...");

        const json = await fsPromises.readFile(jsonFilePath, 'utf8');
        

        try {
            const data = JSON.parse(json);
            const players = getPlayers(data);
            const tankers = createTankers(players,data);
        
            insertData(tankers);

            fs.unlink('uploads/upload.wotreplay', (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                    res.status(500).json({ error: 'Error deleting file' });
                    return;
                }
                console.log('File deleted successfully');
            });
            
        } catch (parseError) {
            console.error(`Error parsing JSON: ${parseError}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// DB part
async function getDBConnection() {
    const db = await sqlite.open({
        filename: 'WOT.db',
        driver: sqlite3.Database
    });

    return db;
}

async function calcAVG(id){
    const db = await getDBConnection();
    const query = `SELECT Count(DISTINCT gameid) as Games,
    AVG(dmg) as AVGdmg,
    AVG(kills) as AVGkills,
    (AVG(pens) / AVG(hits) *100) as AVGpenrate,
    (AVG(win)*100) as winrate
    from GameStats where playerid = ?`;

    try {
        const statement = await db.prepare(query);
        const result = await statement.all(id);
        await statement.finalize();
   
        const query2 = `UPDATE PlayerStats
        SET games=?,avgdmg=?, penrate=?, winpct=?, avgkills=?
        WHERE playerid=?`;
        
        const statement2 = await db.prepare(query2);
        if(result[0].AVGpenrate == null){
            result[0].AVGpenrate = 0.0;
        }
        await statement2.all(result[0].Games,
             result[0].AVGdmg.toFixed(2),
             result[0].AVGpenrate.toFixed(2),
             result[0].winrate.toFixed(2),
             result[0].AVGkills.toFixed(2),
             id);
        await statement2.finalize();
    } catch (error) {
        console.log("error in calcAVG",error);
    }
}
async function insertData(tankers){
    const db = await getDBConnection();
    const query1 = 'INSERT INTO PlayerStats (playerid,name) VALUES(?,?)';
    const query2  = 'INSERT INTO GameStats (tankname,dmg,kills,hits,pens,win,playerid) VALUES (?,?,?,?,?,?,?)';
    const uniquequery = 'Select playerid from PlayerStats where playerid = ?';
    try {
        
        for (const t of tankers) {
            const statement = await db.prepare(uniquequery);
            let res = await statement.all(t.ID);
            await statement.finalize();
            console.log("qc",res[0]);
            if(res[0] == null){
            //if player isnt in playerstats, add them
            console.log("qcheck");
            const statement1 = await db.prepare(query1);
            await statement1.run(t.ID, t.name);
            await statement1.finalize();
            }

        
            const statement2 = await db.prepare(query2);
            console.log(t.tank, t.damage, t.kills,t.hits,t.pens,t.win, t.ID);
            await statement2.run(t.tank, t.damage, t.kills,t.hits,t.pens,t.win, t.ID);
            await statement2.finalize();

            calcAVG(t.ID);
            console.log("finished upload");
        }

    } catch (error) {
        console.log("error in insertData",error);
    }
}


app.get('/stats', async (req, res) => {
    const sortBy = req.query.sort_by;
    console.log("recieved stat req", sortBy);
    const data = await getSortedPlayerStats(sortBy);
    console.log(data[0]);
    res.json(data);
  });

app.get('/test', async (req, res) => {
const sortBy = req.query.sort_by;
const name = req.query.name;
console.log("recieved stat req test", sortBy);
console.log("recieved stat req test2", name);
let data = [];
if(name != null){
    data = await getPlayerStatByName(name);
}else{
    data = await getSortedPlayerStats(sortBy);
}
console.log(data[0]);
res.json(data);
});

async function getStats(name,sortBy){
    const db = await getDBConnection();
    console.log('in getStats');
    const regex = `${name}%`;
    let base = `SELECT * from PlayerStats`;
    let sort =`ORDER BY ${sortBy}`;
    let filter = ``;
    if(name != null){
       filter = `where LOWER(name) Like`+regex;
    }
    query = base+filter+sort;
}

async function getPlayerStatByName(name){
    const db = await getDBConnection();
    console.log('in search part');
    const regex = `${name}%`;
    const namequery = `SELECT * from PlayerStats where LOWER(name) LIKE ? LIMIT 5`;
    let nameres =  await db.all(namequery,regex);
    console.log("search res:", nameres);
    return nameres;
}

async function getSortedPlayerStats(sortBy) {
    const validColumns = ['name','games', 'avgdmg', 'penrate', 'winpct', 'avgkills'];
    const db = await getDBConnection();

    if (!validColumns.includes(sortBy)) {
        return callback(new Error('Invalid sort field'), null);
    }
    else{
        console.log("in getsorted")
        const query = `SELECT * FROM PlayerStats ORDER BY ${sortBy} DESC`;
        const statement = await db.prepare(query);
        let res = await statement.all();
        await statement.finalize();
        return res;
    }
  }


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
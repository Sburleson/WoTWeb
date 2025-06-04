const fs = require('fs');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const { spawn } = require('child_process');
const path = require('path');
const XLSX = require('xlsx');
const { match } = require('assert');
const importReplayJson = require('./upload.js');

const port = 8080;
app.use(cors({
  origin: '*', // or '*' to allow all
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.get('/test-cors', (req, res) => {
  res.json({ ok: true });
});

app.get('/player/positions', async (req, res) => {
    const { name, map } = req.query;
    const db = await getDBConnection();
    let query = `
        SELECT positions.x, positions.y, positions.z, games.map
        FROM positions
        JOIN games ON positions.game_id = games.game_id
        JOIN players ON positions.player_id = players.player_id
        WHERE players.name = ?
    `;
    let params = [name];
    if (map) {
        query += ' AND games.map = ?';
        params.push(map);
    }
    db.all(query, params, (err, rows) => {
        if (err) res.status(500).json({ error: "Database error" });
        else res.json(rows);
    });
});

app.get('/player/shots', async (req, res) => {
    const { name, map } = req.query;
    const db = await getDBConnection();
    let query = `
        SELECT shots.x, shots.y, shots.z, games.map
        FROM shots
        JOIN games ON shots.game_id = games.game_id
        JOIN players ON shots.shooter_id = players.player_id
        WHERE players.name = ?
        -- AND games.map = ?   -- (optional: filter by map)
    `;
    let params = [name];
    if (map) {
        query += ' AND games.map = ?';
        params.push(map);
    }
    db.all(query, params, (err, rows) => {
        if (err) res.status(500).json({ error: "Database error" });
        else res.json(rows);
    });
});

app.get('/graphs', async (req, res) => {
    const db = await getDBConnection();

    if (req.query.maps) {
        // Return list of maps from the database
        db.all(`SELECT DISTINCT map FROM games`, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: "Database error" });
            } else {
                res.json({ maps: rows.map(r => r.map) });
            }
        });
        return;
    }

    if (req.query.map) {
        const map = req.query.map;
        // Aggregate stats per tank for the selected map
        const query = `
            SELECT
                statistics.tank AS tankname,
                COUNT(*) AS games_played,
                AVG(statistics.winner_team = statistics.team) * 100 AS win_percentage,
                AVG(statistics.comp7_prestige_points) AS average_comp7PrestigePoints,
                COUNT(*) * 1.0 / (SELECT COUNT(*) FROM statistics WHERE game_id IN (SELECT game_id FROM games WHERE map = ?)) AS pickrate
            FROM statistics
            JOIN games ON statistics.game_id = games.game_id
            WHERE games.map = ?
            GROUP BY statistics.tank
        `;
        db.all(query, [map, map], (err, rows) => {
            if (err) {
                res.status(500).json({ error: "Database error" });
            } else {
                // Convert to the expected frontend format (tankname as key)
                const result = {};
                rows.forEach(row => {
                    result[row.tankname] = {
                        win_percentage: row.win_percentage,
                        average_comp7PrestigePoints: row.average_comp7PrestigePoints,
                        pickrate: row.pickrate
                    };
                });
                res.json(result);
            }
        });
        return;
    }

    res.status(400).json({ error: "Missing required query parameter" });
});

app.get('/API', async (req, res) => {
    const { name, sort_by } = req.query;
    const validColumns = ['tankname', 'map'];
    const db = await getDBConnection();

    // Validate sort_by
    const sortColumn = validColumns.includes(sort_by) ? sort_by : 'tankname';

    // Build query
    let query = `SELECT * FROM MapStats`;
    let params = [];

    if (name) {
        query += ` WHERE LOWER(tankname) LIKE ?`;
        params.push(`${name.toLowerCase()}%`);
    }

    query += ` ORDER BY ${sortColumn} DESC`;

    try {
        const statement = await db.prepare(query);
        const rows = await statement.all(...params);
        await statement.finalize();
        res.json(rows);
    } catch (error) {
        console.error("Error fetching player stats:", error);
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/autocomplete/player', async (req, res) => {
  const { q } = req.query;
  const db = await getDBConnection();
  db.all(
    `SELECT name FROM players WHERE name LIKE ? LIMIT 3`,
    [`${q}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(rows.map(r => r.name));
    }
  );
});

app.get('/autocomplete/tank', async (req, res) => {
    console.log("autocomplete tank");
    const { q } = req.query;
    const db = await getDBConnection();
    db.all(
        `SELECT DISTINCT tank FROM statistics WHERE tank LIKE ? LIMIT 3`,
        [`${q}%`],
        (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        console.log("rows:", rows);
        res.json(rows.map(r => r.tank));
        }
    );
});

app.get('/autocomplete/map', async (req, res) => {
  const { q } = req.query;
  const db = await getDBConnection();
  db.all(
    `SELECT DISTINCT map FROM games WHERE map LIKE ? LIMIT 3`,
    [`${q}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(rows.map(r => r.map));
    }
  );
});

app.get('/stats', async (req, res) => {
  const { name, tank, map, sort_by } = req.query;
  let sortColumns = (sort_by || 'name').split(',').map(s => s.trim()).filter(Boolean);
  let validSorts = [
    'name', 'tank', 'map', 'avg_kills', 'avg_damage', 'avg_wins', 'avg_comp7_prestige_points', 'avg_lifetime', 'games_played'
  ];
  let orderBy = sortColumns.filter(col => validSorts.includes(col)).join(', ');
  if (!orderBy) orderBy = 'name';

  const db = await getDBConnection();
  let query = `
    SELECT 
      players.name,
      statistics.tank,
      games.map,
      COUNT(*) AS games_played,
      AVG(statistics.kills) AS avg_kills,
      AVG(statistics.damage_dealt) AS avg_damage,
      AVG(CASE WHEN statistics.winner_team = statistics.team THEN 1 ELSE 0 END) AS avg_wins,
      AVG(statistics.comp7_prestige_points) AS avg_comp7_prestige_points,
      AVG(statistics.lifetime) AS avg_lifetime
    FROM statistics
    JOIN players ON statistics.player_id = players.player_id
    JOIN games ON statistics.game_id = games.game_id
    WHERE 1=1
  `;
  let params = [];
  if (name) {
    query += ` AND LOWER(players.name) LIKE ?`;
    params.push(`${name.toLowerCase()}%`);
  }
  if (tank) {
    query += ` AND statistics.tank = ?`;
    params.push(tank);
  }
  if (map) {
    query += ` AND games.map = ?`;
    params.push(map);
  }
  query += ` GROUP BY players.name, statistics.tank, games.map ORDER BY ${orderBy} DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      console.error("Error fetching stats:", err);
    } else {
      res.json(rows);
    }
  });
});

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static('static'));

const storage = multer.diskStorage({
    destination: 'Replays/', // Destination directory for uploaded files
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Use the original file name
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.array('replay'), async (req, res) => {
    if (req.files) {
        try {
            // Process each uploaded replay file
            for (const file of req.files) {
                await Analyze(file.filename, req.body.event_name);
                console.log(`Processed file:`);
            }
            res.json({ message: 'File(s) uploaded and processed successfully' });
        } catch (error) {
            console.log("Error processing files:", error);
            res.status(500).json({ error: 'Error processing files' });
        }
    } else {
        res.status(400).json({ error: 'File upload failed' });
    }
    CleanUp();
});

app.post('/deleteStats',async(req, res) => {
    deleteStats();
    res.json({ message: 'Stats Deleted' })
});

app.post('/ExcelExport',async(req, res) => {
    ExportStats();
    res.json({ message: 'Stats Exported' })
});

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function CleanUp(){
    DataFolder = process.cwd()+"/data"
    UploadFolder = process.cwd()+"/Replays"

    fs.readdir(DataFolder, (err, files) => {
        if (err) {
            console.error(`Error reading folder: ${err.message}`);
            return;
        }

        // Loop through all files in the folder
        files.forEach(file => {
            const filePath = path.join(DataFolder, file);
            fs.unlink(filePath, err => {
                if (err) {
                    console.error(`Error deleting file: ${err.message}`);
                } else {
                    console.log(`Deleted: ${filePath}`);
                }
            });
        });
    });

    fs.readdir(UploadFolder, (err, files) => {
        if (err) {
            console.error(`Error reading folder: ${err.message}`);
            return;
        }

        // Loop through all files in the folder
        files.forEach(file => {
            const filePath = path.join(UploadFolder, file);
            fs.unlink(filePath, err => {
                if (err) {
                    console.error(`Error deleting file: ${err.message}`);
                } else {
                    console.log(`Deleted: ${filePath}`);
                }
            });
        });
    });
}

function Analyze(replay, Eventname) {
    console.log("CWD", process.cwd());
    console.log("FILEEEEE:", replay);
    return new Promise((resolve, reject) => {
        const RustProcess = spawn(process.cwd() + '/Movement.exe', [replay]);
        RustProcess.stdout.on('data', (data) => {
            console.log(`Rust script stdout: ${data}`);
        });

        RustProcess.stderr.on('data', (data) => {
            console.error(`Rust script stderr: ${data}`);
        });

        RustProcess.on('close', async (code) => {
            console.log(`File ${replay} Rust script process exited with code ${code}`);
            if (code === 0) {
                try {
                    // Use the same directory as the replay file

                    const jsonPath = process.cwd()+'/Out/'+ replay+'.json'
                    console.log(`Looking for JSON file at: ${jsonPath}`);
                    if (fs.existsSync(jsonPath)) {
                        console.log(`JSON file found: ${jsonPath}`);
                        await importReplayJson(jsonPath);
                        console.log(`Imported JSON: ${jsonPath}`);
                        resolve();
                    } else {
                        reject(new Error(`JSON file not found: ${jsonPath}`));
                    }
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error(`Rust script exited with code ${code}`));
            }
        });
    });
}



async function getDBConnection() {
    try {
        const db = new sqlite3.Database('WOT.db', (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Database connection successful!');
            }
        });
        return db;
    } catch (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
}

async function calcAVG(id){
    const db = await getDBConnection();
    const query = `SELECT Count(DISTINCT gameid) as Games,
    AVG(dmg) as AVGdmg,
    AVG(assist) as AVGassist,
    AVG(kills) as AVGkills,
    (AVG(pens) / AVG(hits) *100) as AVGpenrate,
    (AVG(win)*100) as winrate
    from GameStats where playerid = ?`;

    try {
        const statement = await db.prepare(query);
        const result = await statement.all(id);
        await statement.finalize();
   
        const query2 = `UPDATE PlayerStats
        SET games=?,avgdmg=?,avgassist=?, penrate=?, winpct=?, avgkills=?
        WHERE playerid=?`;
        
        const statement2 = await db.prepare(query2);
        if(result[0].AVGpenrate == null){
            result[0].AVGpenrate = 0.0;
        }
        if(result[0].AVGassist == null){
            result[0].AVGassist = 0.0;
        }
        await statement2.all(result[0].Games,
             result[0].AVGdmg.toFixed(2),
             result[0].AVGassist.toFixed(2),
             result[0].AVGpenrate.toFixed(2),
             result[0].winrate.toFixed(2),
             result[0].AVGkills.toFixed(2),
             id);
        await statement2.finalize();
    } catch (error) {
        console.log("error in calcAVG",error);
    }
}


async function addEvent(Eventname) {
    const db = await getDBConnection2(); // Ensure you're getting the DB connection correctly
    const eventquery = 'INSERT INTO Events (name) VALUES(?)';
    
    try {
        console.log('Start db.prepare()');
        // Return a Promise that resolves with this.lastID
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(eventquery);

            stmt.run([Eventname], function (err) {
                if (err) {
                    console.error('Error inside stmt.run:', err);
                    reject('Error inserting event: ' + err.message);  // Reject if error occurs
                } else {
                    console.log('Event added with event_id:', this.lastID);
                    resolve(this.lastID);  // Resolve the promise with the event_id (this.lastID)
                }
            });

            stmt.finalize();  // Properly finalize the statement
        });
    } catch (err) {
        console.error("Error in addEvent:", err);
        throw err;  // Re-throw error if any issues arise
    } finally {
        db.close();  // Close the DB connection
    }
}

async function deleteStats() {
    const db = await getDBConnection2(); // Assuming this is your method to get a DB connection
    
    try {
        await db.run("DELETE FROM PlayerStats;");
        await db.run("DELETE FROM GameStats;");
        await db.run("DELETE FROM Events;");
       
        console.log("Deleted all stats");
    } catch (err) {
        console.error("Error deleting stats:", err);
    } finally {
        await db.close();
    }
}

async function ExportStats(){
    console.log("start export");
    const db = await getDBConnection();
    const wb = XLSX.utils.book_new();
    const tableName = 'PlayerStats';
    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
            console.error(`Error reading table ${tableName}:`, err.message);
            return;
        }

        // Convert rows into an Excel-compatible worksheet
        const ws = XLSX.utils.json_to_sheet(rows);

        // Append the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, tableName);
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
            return;
        }

        // Write the Excel file to the disk
        const outputFileName = 'output.xlsx';
        XLSX.writeFile(wb, outputFileName);
        console.log(`SQLite database has been converted to Excel: ${outputFileName}`);
    });
}


app.listen(port, () => {
    CleanUp();
    console.log(`Server is running on http://localhost:${port}`);
  });
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = function importReplayJson(replayPath, dbPath = path.resolve(__dirname, 'WOT.db')) {
     return new Promise((resolve, reject) => {
    const data = JSON.parse(fs.readFileSync(replayPath, 'utf8'));
    const MAP_NAME = data.map || null;
    const DATE_PLAYED = null;

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        db.run("PRAGMA synchronous = OFF");
        db.run("BEGIN TRANSACTION");

        // 1. Insert game and get game_id
        db.run(
            `INSERT INTO games (map, date_played) VALUES (?, ?)`,
            [MAP_NAME, DATE_PLAYED],
            function (err) {
                if (err) {
                    console.error('Error inserting game:', err);
                    db.run("ROLLBACK");
                    db.close();
                    return;
                }
                const game_id = this.lastID;

                // Prepare statements
                const playerStmt = db.prepare(`INSERT OR IGNORE INTO players (name) VALUES (?)`);
                const getPlayerIdStmt = db.prepare(`SELECT player_id FROM players WHERE name = ?`);
                const statStmt = db.prepare(
                    `INSERT INTO statistics (
                        game_id, player_id, tank, pov, capture_points, comp7_prestige_points,
                        damage_assisted_radio, damage_dealt, damage_recieved, direct_enemy_hits,
                        kills, lifetime, mileage, role_skill_used, shots, spotted, team, winner_team
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                );
                const posStmt = db.prepare(
                    `INSERT INTO positions (game_id, player_id, x, y, z, time) VALUES (?, ?, ?, ?, ?, ?)`
                );
                const shotStmt = db.prepare(
                    `INSERT INTO shots (game_id, shooter_id, target_id, damage, time, x, y, z)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                );

                // 2. Insert players and build a name->player_id map
                const playerNameToId = {};
                const playerEntries = Object.entries(data).filter(([k]) => k !== 'map' && k !== 'shots');
                let playersProcessed = 0;

                playerEntries.forEach(([playerId, player]) => {
                    const name = player.name || null;
                    playerStmt.run([name], function (err) {
                        if (err) {
                            console.error('Error inserting player:', err);
                            return;
                        }
                        getPlayerIdStmt.get([name], (err, row) => {
                            if (err) {
                                console.error('Error fetching player_id:', err);
                                return;
                            }
                            playerNameToId[name] = row.player_id;

                            // 3. Insert statistics for this player
                            const stats = player.statistics || {};
                            const tank = player.tank || null;
                            statStmt.run([
                                game_id,
                                row.player_id,
                                tank,
                                stats.POV || null,
                                stats.capturePoints || null,
                                stats.comp7PrestigePoints || null,
                                stats.damageAssistedRadio || null,
                                stats.damageDealt || null,
                                stats.damageRecieved || null,
                                stats.directEnemyHits || null,
                                stats.kills || null,
                                stats.lifetime || null,
                                stats.mileage || null,
                                stats.roleSkillUsed || null,
                                stats.shots || null,
                                stats.spotted || null,
                                stats.team || null,
                                stats.winnerTeam || null
                            ]);

                            playersProcessed++;
                            if (playersProcessed === playerEntries.length) {
                                // Collect all positions for all players
                                let allPositions = [];
                                playerEntries.forEach(([playerId, player]) => {
                                    const positions = player.positions || [];
                                    const pid = playerNameToId[player.name];
                                    positions.forEach(pos => {
                                        const coords = pos.coordinates || {};
                                        allPositions.push([
                                            game_id,
                                            pid,
                                            coords.x || null,
                                            coords.y || null,
                                            coords.z || null,
                                            pos.time || null
                                        ]);
                                    });
                                });

                                function insertShots() {
                                    if (Array.isArray(data.shots)) {
                                        data.shots.forEach(shot => {
                                            const shooter_id = playerNameToId[shot.shooter_name] || null;
                                            const target_id = playerNameToId[shot.target_name] || null;
                                            shotStmt.run([
                                                game_id,
                                                shooter_id,
                                                target_id,
                                                shot.damage || null,
                                                shot.time || null,
                                                shot.shot_origin ? shot.shot_origin.x : null,
                                                shot.shot_origin ? shot.shot_origin.y : null,
                                                shot.shot_origin ? shot.shot_origin.z : null
                                            ]);
                                        });
                                    }
                                    // Finalize all statements and commit
                                    playerStmt.finalize();
                                    getPlayerIdStmt.finalize();
                                    statStmt.finalize();
                                    posStmt.finalize();
                                    shotStmt.finalize();
                                    db.run("COMMIT", () => {
                                        db.close(() => {
                                            console.log('Import complete.');
                                            resolve();
                                        });
                                    });
                                }

                                // If there are positions, batch insert
                                insertPositionsInChunks(allPositions, insertShots);
                            }
                        });
                    });
                });

                // 5. Insert shots after all players are processed
                const SQLITE_MAX_VARIABLES = 999;
                const POSITION_COLUMNS = 6;
                const BATCH_SIZE = Math.floor(SQLITE_MAX_VARIABLES / POSITION_COLUMNS); // e.g. 166

                function insertPositionsInChunks(allPositions, callback) {
                    let i = 0;
                    function next() {
                        if (i >= allPositions.length) {
                            callback();
                            return;
                        }
                        const chunk = allPositions.slice(i, i + BATCH_SIZE);
                        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                        const flatValues = chunk.flat();
                        db.run(
                            `INSERT INTO positions (game_id, player_id, x, y, z, time) VALUES ${placeholders}`,
                            flatValues,
                            function(err) {
                                if (err) {
                                    console.error('Error batch inserting positions:', err);
                                    // Optionally: callback(err); return;
                                }
                                i += BATCH_SIZE;
                                next();
                            }
                        );
                    }
                    next();
                }
            }
        );
     });
    });
};

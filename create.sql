CREATE TABLE IF NOT EXISTS PlayerStats (
  playerid INTEGER NOT NULL,
  name TEXT NULL,
  games INTEGER NULL,
  avgdmg REAL NULL,
  penrate REAL NULL,
  winpct REAL NULL,
  avgkills REAL NULL,
  PRIMARY KEY (playerid)
);

CREATE TABLE IF NOT EXISTS GameStats (
  gameid INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  tankname TEXT NULL,
  dmg INTEGER NULL,
  kills INTEGER NULL,
  hits INTEGER NULL,
  pens INTEGER NULL,
  win INTEGER NULL,
  playerid INTEGER NULL,
  FOREIGN KEY (playerid) REFERENCES PlayerStats (playerid)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);




-- Create indexes separately as SQLite does not support `UNIQUE INDEX` within the table definition
CREATE UNIQUE INDEX IF NOT EXISTS PlayerId_UNIQUE ON PlayerStats (playerid);
CREATE UNIQUE INDEX IF NOT EXISTS GameId_UNIQUE ON GameStats (gameid);
CREATE INDEX IF NOT EXISTS fk_GameStats_PlayerStats_idx ON GameStats (playerid);
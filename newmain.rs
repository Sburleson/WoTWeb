use serde_json::{error,Value,to_string_pretty};
use wot_replay_parser::{events::{self, EntityMethod, Position, ShowDamageFromShot}, BattleContext, BattleEvent, Context, Packet, ReplayParser};
use std::{any::Any, clone, default, fs, io};
use serde::{de::value, Serialize};
use std::fs::OpenOptions;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::collections::HashMap;


#[derive(Serialize)]
pub struct Vector3 {
    x: i32,
    y: i32,
    z: i32,
}

#[derive(Serialize)]
pub struct TankInfo {
    win: bool,
    tank: String,
    name: String,
    time: i32,
    pos: Vector3,
    map: String,
    side: i32
}


fn outcome(json:Vec<Value>)->Result<(i32,bool),io::Error>{

    // find the player who uploaded replay's name, then find their team
    // only care abt player currently because we cant get positional data on the other team

    let mut winning_team= i32::default();
    let mut player_team = i32::default();

    let obj1= json.get(0).unwrap();
    let obj2 =json.get(1);

    if obj2 == None{
        return Err(io::Error::new(io::ErrorKind::InvalidData, "Unfinished Replay"));
    }

    let username = obj1.get("playerName").unwrap().to_string();

    
    if let Some( base )= obj2.unwrap().get(0){   
        if let Some(players) = base.get("players"){
            let map = players.as_object().unwrap();
            for (k,v) in map{
                let team = v.get("team").unwrap().as_i64();
                let name = v.get("realName").unwrap().to_string();
                println!("n:{}, u{}", name, username);
                if name == username{
                    player_team = team.unwrap() as i32;
                    println!("assigned p");
                }

            }
        }
    }

    if let Some(nested_obj) = obj2.unwrap().get(0) { 
        if let Some(common_obj) = nested_obj.get("common") {
            if let Some(winner) = common_obj.get("winnerTeam") {
                //println!("Winner Team: {}", winner);
                winning_team = winner.clone().as_i64().unwrap() as i32;
            } else {
                println!("Key 'winnerTeam' not found");
            }
        } else {
            println!("Key 'common' not found");
        }
    } else {
        println!("Element at index 1 not found");
    }

    println!("p{},t{}",player_team,winning_team);

    let res = if player_team == winning_team{true}else{false};

    Ok((player_team,res))
}


fn process(path:std::path::PathBuf, storage:&mut Vec<TankInfo>)->Result<(), io::Error>{
    let replay_parser = ReplayParser::parse_file(path.to_str().unwrap()).unwrap();
    let battle_context = replay_parser.battle_context();
    let version = replay_parser.parse_replay_version().unwrap();
    let context = wot_replay_parser::Context::new(version);

    //info vars
    //let mut win = bool::default();
    let mut tank = String::default();
    let mut time = i32::default();
    let mut pos = Vector3 { x: (0), y: (0), z: (0) };
    let mut map = String::default();
    //let mut dat = TankInfo{win: bool::default(),tank: String::default(),time: f32::default(),pos: pos.,map: String::default(),};

    let json_parts = replay_parser.replay_json();
    let json_obj1 = json_parts.get(0).unwrap();


    map = json_obj1.get("mapDisplayName").unwrap().to_string().trim_start_matches("\"").trim_end_matches("\"").to_string(); //i know this looks terrible but trust

    let (side,win) = outcome(json_parts.to_vec())?;

    println!("map:{}",map);
    println!("side:{}",side);
    println!("win:{}",win);

    //panic!("stop");

    let mut packet_count = 0;
    let mut prev =f32::default();
    let mut _time = f32::default();

    let mut prev_whole = 0 as i32;
    let mut prev_enter= 0 as f32;
    let mut prev_time=0 as f32;

    for packet in replay_parser.packet_stream() {
        packet_count += 1;
        let mut packet = packet.unwrap();
        _time= packet.time();
        //println!("t: {}", _time);
        if(_time == 0 as f32){
                continue;
        }
        let current_whole = _time.trunc() as i32;
        if(current_whole == prev_whole && (_time == prev_enter || prev_enter == 0 as f32)){
            prev_enter = _time;
            //compute
            let event = BattleEvent::parse(&packet,&context).unwrap();
            
            if let BattleEvent::Position(position) = event {
                let id = position.entity_id;

                let original_pos= position.position;
                pos = Vector3 { x: (original_pos.x as i32), y: (original_pos.y as i32), z: (original_pos.z as i32) };
                let player= battle_context.entity_id_to_player(id);
                match player {      
                    Some(player_str) => {
                        if let Some((name_part, tank_part)) = player_str.split_once(", ") {
                            if let Some((_, _tank)) = tank_part.split_once(':') {
                                tank = _tank.to_string();
                                let dat:TankInfo = TankInfo { win: (win.clone()), tank: (tank.clone()),name:name_part.to_string(), time: (_time.clone() as i32), pos: (pos), map: (map.clone()), side:(side.clone()) };
                                storage.push(dat);
                            }
                        }
                    },
                        None => {
                        //println!("No player data available");
                        }
                    }
                }else if let BattleEvent::EntityMethod(method) = event{
                    //println!("FOUND");
                    let entity_method = method.event;
                    match entity_method {
                        EntityMethod::DamageFromShot(info) => {
                            // `damage` is of type `ShowDamageFromShot`
                            // You can now use it here
                            //println!("{}",info.damage_factor);
                            //println!("{}",info.entity_id);
                            //panic!("stop");
                        }
                        _ => {
                            //println!("{}",method.method_id);
                        }
                    }
                    //println!("{}",);
                    
                }
                
            }else{
                //go next whole
                prev_whole = current_whole+1;
                prev_enter = 0 as f32;
            }

            prev_time=_time;
        }

    Ok(())
}

fn append_tank_info_to_file(tank_infos: &[TankInfo], file_path: &str) -> io::Result<()> {
    // Open the file in append mode, create it if it doesn't exist
    let mut file = OpenOptions::new()
        .append(true) // Open in append mode
        .create(true) // Create the file if it doesn't exist
        .open(file_path)?;

    // Iterate over the Vec<TankInfo> and write each item as JSON
    for tank_info in tank_infos {
        let json = serde_json::to_string(tank_info).unwrap(); // Serialize the TankInfo to JSON
        file.write_all(json.as_bytes())?;  // Write the JSON data
        file.write_all(b"\n")?;           // Add a newline for separation
    }

    Ok(())
}
pub fn main(){
    let folder_path = r"C:\Users\simon\Desktop\Wot_Analyzer\Movement\Movement\src\Murovanka";
    
    
    if Path::new(folder_path).exists() {
        match fs::read_dir(folder_path) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(file) => {
                            let mut collection:Vec<TankInfo> = Vec::new();
                            let path = file.path();
                            let name=  path.file_name().unwrap().to_str().unwrap();
                            let output_name = format!("Out/{}.jsonl",name);
                            println!("Processing file:");
                            let dat = process(path.clone(),&mut collection);
                            if dat.is_err(){
                                continue;
                            }
                            let out = append_tank_info_to_file(&collection, &output_name);
                            //panic!("stop");
                                    
                                
                        }
                        Err(e) => eprintln!("Error reading entry: {}", e),
                    }
                }
            }
            Err(e) => eprintln!("Error reading directory: {}", e),
        }
    } else {
        eprintln!("Directory does not exist!");
    }
}
use wot_replay_parser::ReplayParser;
use std::io::prelude::*;
use serde_json;
pub fn main() {
    let args: Vec<String> = std::env::args().collect();
    let file_path = &args[1];

    // ReplayParser can take a path or Vec<u8> 
    let replay_parser = ReplayParser::parse_file(file_path).unwrap();

    // replay_json_start return serde_json::Value type
    let file_name1 = "data.json";
    let replay_json_start = replay_parser.replay_json_start().unwrap();
    let json_string_start = serde_json::to_string_pretty(&replay_json_start).unwrap();
    let mut file1 = std::fs::File::create(file_name1).unwrap();

    // This portion is only available for complete replays (i.e the player watched the battle to the end)
    let replay_json_end = replay_parser.replay_json_end().unwrap();
    let json_string_end = serde_json::to_string_pretty(&replay_json_end).unwrap();

    let file_name2 = "data2.json";
    let mut file2 = std::fs::File::create(file_name2).unwrap();
    file.write_all(json_string_start.as_bytes()).unwrap();
    file.write_all(json_string_end.as_bytes()).unwrap();
}

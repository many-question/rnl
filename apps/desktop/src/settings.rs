//! User settings live in Tauri's application configuration directory, never beside the binary.
use serde_json::{Map, Value};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct Settings(pub Mutex<Option<(PathBuf, Map<String, Value>)>>);

fn write(path: &Path, values: &Map<String, Value>) -> Result<(), String> {
    std::fs::create_dir_all(path.parent().ok_or("settings have no parent directory")?).map_err(|e| e.to_string())?;
    let temp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(values).map_err(|e| e.to_string())?;
    std::fs::write(&temp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&temp, path).map_err(|e| format!("cannot save {}: {e}", path.display()))
}

fn read_or_migrate(path: &Path, legacy: Map<String, Value>) -> Result<Map<String, Value>, String> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| format!("cannot read {}: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            write(path, &legacy)?;
            Ok(legacy)
        }
        Err(e) => Err(format!("cannot read {}: {e}", path.display())),
    }
}

#[tauri::command]
pub fn load_settings(app: AppHandle, state: State<'_, Settings>, legacy: Map<String, Value>) -> Result<Value, String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    if state.is_none() {
        let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
        // Smoke tests isolate native settings as well as the WebView profile. Release builds
        // always use Tauri's application directory.
        #[cfg(debug_assertions)]
        let dir = std::env::var_os("RNL_VIEWER_TEST_CONFIG_DIR").map(PathBuf::from).unwrap_or(dir);
        let path = dir.join("settings.json");
        let values = read_or_migrate(&path, legacy)?;
        *state = Some((path, values));
    }
    let (path, values) = state.as_ref().unwrap();
    Ok(serde_json::json!({ "path": path, "values": values }))
}

#[tauri::command]
pub fn save_setting(state: State<'_, Settings>, key: String, value: Value) -> Result<(), String> {
    let mut state = state.0.lock().map_err(|e| e.to_string())?;
    let (path, values) = state.as_mut().ok_or("settings have not been loaded")?;
    let mut next = values.clone();
    next.insert(key, value);
    write(path, &next)?;
    *values = next;
    Ok(())
}

impl Settings {
    pub fn paths(&self) -> Result<Vec<PathBuf>, String> {
        let state = self.0.lock().map_err(|e| e.to_string())?;
        let values = &state.as_ref().ok_or("settings have not been loaded")?.1;
        match values.get("search-paths") {
            None => Ok(Vec::new()),
            Some(value) => serde_json::from_value(value.clone()).map_err(|e| format!("invalid search paths: {e}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migration_persistence_and_corrupt_file_preservation() {
        let dir = std::env::temp_dir().join(format!("rnl-settings-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        let legacy =
            serde_json::from_value(serde_json::json!({"solve-options": "grid=2", "search-paths": ["/p"]})).unwrap();
        assert_eq!(read_or_migrate(&path, legacy).unwrap()["solve-options"], "grid=2");
        let mut values = read_or_migrate(&path, Map::new()).unwrap();
        values.insert("grid-shown".into(), Value::Bool(false));
        write(&path, &values).unwrap();
        assert_eq!(read_or_migrate(&path, Map::new()).unwrap(), values);
        std::fs::write(&path, "broken").unwrap();
        assert!(read_or_migrate(&path, Map::new()).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "broken");
        std::fs::remove_dir_all(dir).unwrap();
    }
}

//! File selection for the session's file pool. Opening a file does not add it here.
use std::path::Path;
use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

pub fn folder_files(dir: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        let path = entry.path();
        if kind.is_dir() {
            folder_files(&path, out)?;
        } else if kind.is_file()
            && path.extension().is_some_and(|e| super::NETLISTS.iter().any(|x| e.eq_ignore_ascii_case(x)))
        {
            out.push(rnl_cli::path_str(&path));
        }
    }
    out.sort();
    Ok(())
}

#[tauri::command]
pub async fn pick_pool(window: WebviewWindow, kind: String) -> Result<Vec<String>, String> {
    let dialog = window.dialog().file().set_parent(&window);
    tauri::async_runtime::spawn_blocking(move || {
        if kind == "folder" || kind == "path" {
            let Some(chosen) = dialog.blocking_pick_folder() else { return Ok(Vec::new()) };
            let dir = chosen.into_path().map_err(|e| e.to_string())?;
            if kind == "path" {
                return Ok(vec![rnl_cli::path_str(&dir)]);
            }
            let mut paths = Vec::new();
            folder_files(&dir, &mut paths)?;
            Ok(paths)
        } else {
            dialog
                .add_filter("Netlists and packages", &super::NETLISTS)
                .add_filter("All files", &["*"])
                .blocking_pick_files()
                .unwrap_or_default()
                .into_iter()
                .map(|f| f.into_path().map(|p| rnl_cli::path_str(&p)).map_err(|e| e.to_string()))
                .collect()
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn bundled_files() -> std::collections::BTreeMap<String, String> {
    rnl_view::bundled().files
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn include_folder_collects_nested_netlists_and_packages_in_stable_order() {
        let dir = std::env::temp_dir().join(format!("rnl-folder-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        for name in ["top.sp", "sub/models.inc", "sub/parts.RNL", "notes.txt"] {
            std::fs::write(dir.join(name), "text").unwrap();
        }
        let mut files = Vec::new();
        folder_files(&dir, &mut files).unwrap();
        assert_eq!(files.len(), 3);
        assert!(files.iter().any(|p| p.ends_with("sub/parts.RNL")));
        assert!(files.windows(2).all(|w| w[0] <= w[1]));
        assert!(folder_files(&dir.join("missing"), &mut Vec::new()).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}

use std::fs;
use std::path::PathBuf;

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextFile {
    pub(crate) path: String,
    pub(crate) contents: String,
}

#[tauri::command]
pub(crate) fn read_text_file(path: String) -> Result<TextFile, String> {
    let path_buf = PathBuf::from(&path);
    let contents = fs::read_to_string(&path_buf).map_err(|error| error.to_string())?;

    Ok(TextFile { path, contents })
}

#[tauri::command]
pub(crate) fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), contents).map_err(|error| error.to_string())
}

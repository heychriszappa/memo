/// Shared macOS notification helper — displays native notifications via osascript.
use std::process::Command;

#[cfg(target_os = "macos")]
pub fn show(title: &str, subtitle: &str, body: &str) -> Result<(), String> {
    let script = format!(
        "display notification \"{}\" with title \"{}\" subtitle \"{}\"",
        escape_applescript(body),
        escape_applescript(title),
        escape_applescript(subtitle),
    );

    let status = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .status()
        .map_err(|e| e.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Failed to show macOS notification".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn show(_title: &str, _subtitle: &str, _body: &str) -> Result<(), String> {
    Ok(())
}

fn escape_applescript(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', " ")
}

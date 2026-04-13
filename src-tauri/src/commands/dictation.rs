/// WhisperKit-backed dictation commands.
///
/// Mirrors the `dictation.*` JSON-RPC methods exposed by the DarwinKit
/// sidecar. Long-running operations (model download, model load, live
/// recognition) return immediately and stream state back to the frontend
/// via Tauri events routed through the central notification handler.
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

use super::darwinkit;

// ── Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictationModelInfo {
    pub id: String,
    pub label: String,
    pub size_mb: u64,
    pub description: String,
    pub downloaded: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DictationStatus {
    pub installed_models: Vec<String>,
    pub active_model: Option<String>,
    pub downloading: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DictationStartResult {
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DictationStopResult {
    pub text: String,
}

// ── Notification forwarding ────────────────────────────────────────

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// Call once from main.rs setup so the notification callback can emit
/// events to the webview.
pub fn register_notifications(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
}

/// Called by the centralized DarwinKit notification handler in main.rs.
/// Returns true if the method was a dictation notification and was handled.
pub fn handle_notification(method: &str, params: &serde_json::Value) -> bool {
    let event_name = match method {
        "dictation.partial" => "dictation:partial",
        "dictation.final" => "dictation:final",
        "dictation.error" => "dictation:error",
        "dictation.download_progress" => "dictation:download_progress",
        "dictation.download_complete" => "dictation:download_complete",
        "dictation.download_error" => "dictation:download_error",
        "dictation.model_loaded" => "dictation:model_loaded",
        "dictation.model_load_error" => "dictation:model_load_error",
        _ => return false,
    };

    if let Some(app) = APP_HANDLE.get() {
        let _ = app.emit(event_name, params.clone());
    } else {
        eprintln!("[dictation-rs] APP_HANDLE not set when firing {}", method);
    }

    true
}

// ── Tauri commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn dictation_list_models() -> Result<Vec<DictationModelInfo>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        let result = darwinkit::call("dictation.list_models", None)?;
        let models = result
            .get("models")
            .and_then(|v| v.as_array())
            .ok_or_else(|| "list_models returned no models array".to_string())?;

        let parsed: Vec<DictationModelInfo> = models
            .iter()
            .filter_map(|m| {
                Some(DictationModelInfo {
                    id: m.get("id")?.as_str()?.to_string(),
                    label: m.get("label")?.as_str()?.to_string(),
                    size_mb: m.get("size_mb")?.as_u64().unwrap_or(0),
                    description: m.get("description")?.as_str()?.to_string(),
                    downloaded: m.get("downloaded")?.as_bool().unwrap_or(false),
                })
            })
            .collect();
        Ok(parsed)
    })
    .await
    .map_err(|e| format!("list_models join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_get_status() -> Result<DictationStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        let result = darwinkit::call("dictation.status", None)?;
        let installed_models = result
            .get("installed_models")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        Ok(DictationStatus {
            installed_models,
            active_model: result
                .get("active_model")
                .and_then(|v| v.as_str())
                .map(String::from),
            downloading: result
                .get("downloading")
                .and_then(|v| v.as_str())
                .map(String::from),
        })
    })
    .await
    .map_err(|e| format!("status join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_download_model(model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        darwinkit::call(
            "dictation.download_model",
            Some(serde_json::json!({ "model_id": model_id })),
        )?;
        Ok(())
    })
    .await
    .map_err(|e| format!("download join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_cancel_download() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        darwinkit::call("dictation.cancel_download", None)?;
        Ok(())
    })
    .await
    .map_err(|e| format!("cancel join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_delete_model(model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        darwinkit::call(
            "dictation.delete_model",
            Some(serde_json::json!({ "model_id": model_id })),
        )?;
        Ok(())
    })
    .await
    .map_err(|e| format!("delete join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_set_active_model(model_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        // 200 s timeout on the RPC — model load blocks in the sidecar
        // until compilation finishes. Must be > the sidecar's internal
        // 180 s semaphore wait.
        darwinkit::call_with_timeout(
            "dictation.set_active_model",
            Some(serde_json::json!({ "model_id": model_id })),
            200,
        )?;
        Ok(())
    })
    .await
    .map_err(|e| format!("set_active join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_start(
    language: Option<String>,
    model_id: Option<String>,
) -> Result<DictationStartResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        // Assemble params. Both fields are optional; the sidecar picks
        // sensible fallbacks (system locale, first installed model) when
        // they're missing.
        let mut obj = serde_json::Map::new();
        if let Some(l) = language {
            obj.insert("language".to_string(), serde_json::json!(l));
        }
        if let Some(m) = model_id {
            obj.insert("model_id".to_string(), serde_json::json!(m));
        }
        let params = if obj.is_empty() {
            None
        } else {
            Some(serde_json::Value::Object(obj))
        };

        // First-load of a big model can take up to ~150s; give the
        // sidecar headroom so the blocking model load inside the
        // handler doesn't time out on the RPC side.
        let result = darwinkit::call_with_timeout("dictation.start", params, 200)?;
        Ok(DictationStartResult {
            status: result
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("started")
                .to_string(),
        })
    })
    .await
    .map_err(|e| format!("start join error: {}", e))?
}

#[tauri::command]
pub async fn dictation_stop() -> Result<DictationStopResult, String> {
    tauri::async_runtime::spawn_blocking(|| {
        if !darwinkit::is_available() {
            return Err("DarwinKit sidecar not running".to_string());
        }
        let result = darwinkit::call_with_timeout("dictation.stop", None, 5)?;
        Ok(DictationStopResult {
            text: result
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        })
    })
    .await
    .map_err(|e| format!("stop join error: {}", e))?
}

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::Emitter;

const ACP_AGENT_MESSAGE_EVENT: &str = "markra://acp-agent-message";

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
pub(crate) struct AcpAgentEnvVariable {
    name: String,
    value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
pub(crate) struct AcpAgentStartConfig {
    args: Vec<String>,
    command: String,
    cwd: Option<String>,
    env: Vec<AcpAgentEnvVariable>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AcpAgentConnection {
    connection_id: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AcpAgentMessageEvent {
    connection_id: String,
    message: String,
    r#type: &'static str,
}

struct AcpAgentProcess {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<ChildStdin>>,
}

#[derive(Default)]
pub(crate) struct AcpAgentProcessState {
    active_processes: Mutex<HashMap<String, AcpAgentProcess>>,
    next_connection_id: AtomicU64,
}

fn normalize_acp_agent_config(config: AcpAgentStartConfig) -> Result<AcpAgentStartConfig, String> {
    let command = config.command.trim().to_string();
    if command.is_empty() {
        return Err("ACP agent command is required.".to_string());
    }

    let cwd = config.cwd.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            return None;
        }

        Some(trimmed)
    });

    let mut env = Vec::new();
    for variable in config.env {
        let name = variable.name.trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name.contains('=') {
            return Err("ACP agent environment variable names cannot contain '='.".to_string());
        }

        env.push(AcpAgentEnvVariable {
            name,
            value: variable.value,
        });
    }

    Ok(AcpAgentStartConfig {
        args: config
            .args
            .into_iter()
            .map(|arg| arg.trim().to_string())
            .filter(|arg| !arg.is_empty())
            .collect(),
        command,
        cwd,
        env,
    })
}

fn spawn_output_reader<R: Read + Send + 'static>(
    app: tauri::AppHandle,
    connection_id: String,
    stream_type: &'static str,
    stream: R,
) {
    std::thread::spawn(move || {
        for line in BufReader::new(stream).lines() {
            let Ok(message) = line else {
                break;
            };

            let _ = app.emit(
                ACP_AGENT_MESSAGE_EVENT,
                AcpAgentMessageEvent {
                    connection_id: connection_id.clone(),
                    message,
                    r#type: stream_type,
                },
            );
        }
    });
}

fn acp_agent_exit_message(status: ExitStatus) -> String {
    status
        .code()
        .map(|code| format!("exit code {code}"))
        .unwrap_or_else(|| "terminated without an exit code".to_string())
}

fn spawn_exit_watcher(app: tauri::AppHandle, connection_id: String, child: Arc<Mutex<Child>>) {
    thread::spawn(move || loop {
        let status = {
            let Ok(mut child) = child.lock() else {
                return;
            };

            child.try_wait()
        };

        match status {
            Ok(Some(status)) => {
                let _ = app.emit(
                    ACP_AGENT_MESSAGE_EVENT,
                    AcpAgentMessageEvent {
                        connection_id,
                        message: acp_agent_exit_message(status),
                        r#type: "exit",
                    },
                );
                return;
            }
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => {
                let _ = app.emit(
                    ACP_AGENT_MESSAGE_EVENT,
                    AcpAgentMessageEvent {
                        connection_id,
                        message: format!("failed to monitor ACP agent exit: {error}"),
                        r#type: "exit",
                    },
                );
                return;
            }
        }
    });
}

fn spawn_acp_process(
    config: &AcpAgentStartConfig,
) -> Result<
    (
        Child,
        ChildStdin,
        impl Read + Send + 'static,
        impl Read + Send + 'static,
    ),
    String,
> {
    let mut command = Command::new(&config.command);
    command
        .args(&config.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(cwd) = &config.cwd {
        command.current_dir(cwd);
    }

    for variable in &config.env {
        command.env(&variable.name, &variable.value);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to start ACP agent: {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "ACP agent stdin was not available.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ACP agent stdout was not available.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "ACP agent stderr was not available.".to_string())?;

    Ok((child, stdin, stdout, stderr))
}

#[tauri::command]
pub(crate) fn start_acp_agent(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpAgentProcessState>,
    config: AcpAgentStartConfig,
) -> Result<AcpAgentConnection, String> {
    let config = normalize_acp_agent_config(config)?;
    let connection_number = state.next_connection_id.fetch_add(1, Ordering::Relaxed) + 1;
    let connection_id = format!("acp-{connection_number}");
    let (child, stdin, stdout, stderr) = spawn_acp_process(&config)?;

    let process = AcpAgentProcess {
        child: Arc::new(Mutex::new(child)),
        stdin: Arc::new(Mutex::new(stdin)),
    };
    spawn_output_reader(app.clone(), connection_id.clone(), "message", stdout);
    spawn_output_reader(app.clone(), connection_id.clone(), "stderr", stderr);
    spawn_exit_watcher(app, connection_id.clone(), process.child.clone());
    state
        .active_processes
        .lock()
        .map_err(|_| "ACP agent process state lock is poisoned.".to_string())?
        .insert(connection_id.clone(), process);

    Ok(AcpAgentConnection { connection_id })
}

#[tauri::command]
pub(crate) fn write_acp_agent_message(
    state: tauri::State<'_, AcpAgentProcessState>,
    connection_id: String,
    message: String,
) -> Result<(), String> {
    let stdin = state
        .active_processes
        .lock()
        .map_err(|_| "ACP agent process state lock is poisoned.".to_string())?
        .get(&connection_id)
        .map(|process| process.stdin.clone())
        .ok_or_else(|| format!("ACP agent connection was not found: {connection_id}"))?;
    let mut stdin = stdin
        .lock()
        .map_err(|_| "ACP agent stdin lock is poisoned.".to_string())?;

    stdin
        .write_all(message.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|error| format!("Failed to write ACP agent message: {error}"))
}

#[tauri::command]
pub(crate) fn stop_acp_agent(
    state: tauri::State<'_, AcpAgentProcessState>,
    connection_id: String,
) -> Result<(), String> {
    let process = state
        .active_processes
        .lock()
        .map_err(|_| "ACP agent process state lock is poisoned.".to_string())?
        .remove(&connection_id)
        .ok_or_else(|| format!("ACP agent connection was not found: {connection_id}"))?;
    let mut child = process
        .child
        .lock()
        .map_err(|_| "ACP agent child process lock is poisoned.".to_string())?;

    if child
        .try_wait()
        .map_err(|error| error.to_string())?
        .is_none()
    {
        child
            .kill()
            .map_err(|error| format!("Failed to stop ACP agent: {error}"))?;
    }

    child
        .wait()
        .map(|_| ())
        .map_err(|error| format!("Failed to wait for ACP agent: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_agent_command() {
        let config = AcpAgentStartConfig {
            args: vec![],
            command: "  ".to_string(),
            cwd: None,
            env: vec![],
        };

        assert!(normalize_acp_agent_config(config).is_err());
    }

    #[test]
    fn normalizes_agent_command_configuration() {
        let config = AcpAgentStartConfig {
            args: vec!["--experimental-acp".to_string()],
            command: " gemini ".to_string(),
            cwd: Some(" /mock-vault ".to_string()),
            env: vec![AcpAgentEnvVariable {
                name: " ACP_ENV ".to_string(),
                value: " test ".to_string(),
            }],
        };

        let normalized = normalize_acp_agent_config(config).expect("config should normalize");

        assert_eq!(normalized.command, "gemini");
        assert_eq!(normalized.args, vec!["--experimental-acp"]);
        assert_eq!(normalized.cwd.as_deref(), Some("/mock-vault"));
        assert_eq!(normalized.env[0].name, "ACP_ENV");
        assert_eq!(normalized.env[0].value, " test ");
    }

    #[cfg(unix)]
    #[test]
    fn formats_acp_agent_exit_code() {
        use std::os::unix::process::ExitStatusExt;

        assert_eq!(
            acp_agent_exit_message(ExitStatus::from_raw(256)),
            "exit code 1"
        );
    }
}

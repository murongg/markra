use crate::windows::is_settings_window_label;
use tauri::{Emitter, Manager, Runtime};

const APP_EXIT_REQUESTED_EVENT: &str = "markra://app-exit-requested";

#[derive(Clone, Copy)]
struct AppExitWindowInfo<'a> {
    focused: bool,
    label: &'a str,
    visible: bool,
}

fn is_app_exit_user_window(window: &AppExitWindowInfo<'_>) -> bool {
    window.visible && !is_settings_window_label(window.label)
}

fn app_exit_target_label<'a>(windows: &'a [AppExitWindowInfo<'a>]) -> Option<&'a str> {
    windows
        .iter()
        .filter(|window| is_app_exit_user_window(window))
        .find(|window| window.focused)
        .or_else(|| {
            windows
                .iter()
                .find(|window| is_app_exit_user_window(window))
        })
        .map(|window| window.label)
}

fn should_intercept_app_exit(code: Option<i32>, user_window_count: usize) -> bool {
    code.is_none() && user_window_count > 0
}

pub(crate) fn handle_app_exit_requested<R: Runtime>(
    app: &tauri::AppHandle<R>,
    code: Option<i32>,
    api: tauri::ExitRequestApi,
) {
    let windows = app.webview_windows();
    let window_infos = windows
        .values()
        .map(|window| AppExitWindowInfo {
            focused: window.is_focused().unwrap_or(false),
            label: window.label(),
            visible: window.is_visible().unwrap_or(false),
        })
        .collect::<Vec<_>>();
    let user_window_count = window_infos
        .iter()
        .filter(|window| is_app_exit_user_window(window))
        .count();
    if !should_intercept_app_exit(code, user_window_count) {
        return;
    }

    api.prevent_exit();
    if let Some(window) = app_exit_target_label(&window_infos).and_then(|label| windows.get(label))
    {
        let _ = window.emit(APP_EXIT_REQUESTED_EVENT, ());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn intercepts_user_exit_when_windows_are_open() {
        assert!(should_intercept_app_exit(None, 1));
    }

    #[test]
    fn allows_programmatic_or_windowless_exit() {
        assert!(!should_intercept_app_exit(Some(0), 1));
        assert!(!should_intercept_app_exit(None, 0));
    }

    #[test]
    fn ignores_settings_windows_for_app_exit_interception() {
        let windows = [AppExitWindowInfo {
            focused: true,
            label: "markra-settings",
            visible: false,
        }];
        let user_window_count = windows
            .iter()
            .filter(|window| is_app_exit_user_window(window))
            .count();

        assert_eq!(user_window_count, 0);
        assert!(!should_intercept_app_exit(None, user_window_count));
        assert_eq!(app_exit_target_label(&windows), None);
    }

    #[test]
    fn targets_visible_non_settings_windows_for_app_exit_confirmation() {
        let windows = [
            AppExitWindowInfo {
                focused: true,
                label: "markra-settings",
                visible: false,
            },
            AppExitWindowInfo {
                focused: false,
                label: "main",
                visible: true,
            },
        ];

        assert_eq!(app_exit_target_label(&windows), Some("main"));
    }
}

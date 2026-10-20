//! Paint the main Windows window natively as soon as its HWND exists, before WebView2 is created.
//! A temporary child control covers its client area until the initialized page can take over.
//! The top-level window, its size, position, menu and HWND are unchanged throughout startup.

use tauri::WebviewWindow;

pub struct Startup;

impl Startup {
    pub fn new() -> Self {
        #[cfg(windows)]
        windows::install();
        Self
    }

    pub fn finish(&self, window: &WebviewWindow) -> Result<(), String> {
        #[cfg(windows)]
        window.run_on_main_thread(windows::finish).map_err(|e| e.to_string())?;
        #[cfg(not(windows))]
        let _ = window;
        Ok(())
    }
}

impl Drop for Startup {
    fn drop(&mut self) {
        #[cfg(windows)]
        windows::finish();
    }
}

#[cfg(windows)]
mod windows {
    use std::ptr::{null, null_mut};
    use std::sync::Mutex;
    use windows_sys::core::w;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::*;
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::GetCurrentThreadId;
    use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    const CLASS: windows_sys::core::PCWSTR = w!("RnlViewerStartup");

    // The hook is local to this process's GUI thread. Release the lock before Win32 calls that
    // can send messages and reenter the hook. Normal creation, painting and dismissal stay on it.
    struct Surface {
        root: usize,
        child: usize,
        hook: usize,
        finished: bool,
    }
    static SURFACE: Mutex<Surface> = Mutex::new(Surface { root: 0, child: 0, hook: 0, finished: false });

    pub fn install() {
        // Register only a child-control class; no additional top-level window is created.
        unsafe {
            let class = WNDCLASSW {
                style: CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc: Some(procedure),
                hInstance: GetModuleHandleW(null()),
                hCursor: LoadCursorW(null_mut(), IDC_ARROW),
                lpszClassName: CLASS,
                ..std::mem::zeroed()
            };
            if RegisterClassW(&class) != 0 {
                let hook = SetWindowsHookExW(WH_CALLWNDPROCRET, Some(created), null_mut(), GetCurrentThreadId());
                if let Ok(mut surface) = SURFACE.lock() {
                    surface.hook = hook as usize;
                }
            }
        }
    }

    pub fn finish() {
        let (child, hook) = match SURFACE.lock() {
            Ok(mut surface) => {
                if surface.finished {
                    return;
                }
                surface.finished = true;
                (std::mem::take(&mut surface.child), std::mem::take(&mut surface.hook))
            }
            Err(_) => return,
        };
        // Dismiss only the temporary child control. Its parent is the permanent viewer window.
        unsafe {
            if hook != 0 {
                UnhookWindowsHookEx(hook as HHOOK);
            }
            if child != 0 && IsWindow(child as HWND) != 0 {
                DestroyWindow(child as HWND);
            }
            UnregisterClassW(CLASS, GetModuleHandleW(null()));
        }
    }

    unsafe extern "system" fn created(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 {
            // Attach after WM_NCCREATE installs Tauri's window data, before WM_CREATE configures
            // and shows it. WebView2 is constructed only after CreateWindowEx returns.
            let message = &*(lparam as *const CWPRETSTRUCT);
            observe(message);
        }
        CallNextHookEx(null_mut(), code, wparam, lparam)
    }

    unsafe fn observe(message: &CWPRETSTRUCT) {
        let (root, child) = match SURFACE.lock() {
            Ok(surface) if !surface.finished => (surface.root, surface.child),
            _ => return,
        };
        if root == 0 && message.message == WM_NCCREATE && GetAncestor(message.hwnd, GA_ROOT) == message.hwnd {
            let mut title = [0u16; 64];
            let count = GetWindowTextW(message.hwnd, title.as_mut_ptr(), title.len() as i32);
            if String::from_utf16_lossy(&title[..count.max(0) as usize]) != "RNL Viewer" {
                return;
            }
            // Claim the parent before creating a child, which recursively invokes this hook.
            if let Ok(mut surface) = SURFACE.lock() {
                surface.root = message.hwnd as usize;
            }
            let child = CreateWindowExW(
                WS_EX_NOPARENTNOTIFY,
                CLASS,
                w!("RNL Viewer startup"),
                WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS,
                0,
                0,
                0,
                0,
                message.hwnd,
                null_mut(),
                GetModuleHandleW(null()),
                null(),
            );
            if let Ok(mut surface) = SURFACE.lock() {
                surface.child = child as usize;
            }
            layout(message.hwnd, child);
        } else if root != 0
            && child != 0
            && message.hwnd as usize != child
            && matches!(message.message, WM_CREATE | WM_SIZE | WM_SHOWWINDOW | WM_WINDOWPOSCHANGED)
            && GetAncestor(message.hwnd, GA_ROOT) as usize == root
        {
            // Keep text above newly created WebView children, and follow user resizing.
            layout(root as HWND, child as HWND);
            if message.hwnd as usize == root && message.message == WM_CREATE {
                // Tauri has now applied its final size, position and menu. Console-hiding
                // launchers may override the first ShowWindow through STARTUPINFO.
                ShowWindow(message.hwnd, SW_SHOWNORMAL);
                ShowWindow(message.hwnd, SW_SHOW);
            }
            UpdateWindow(child as HWND);
        }
    }

    unsafe fn layout(root: HWND, child: HWND) {
        if child.is_null() {
            return;
        }
        let mut rect: RECT = std::mem::zeroed();
        GetClientRect(root, &mut rect);
        SetWindowPos(child, HWND_TOP, 0, 0, rect.right, rect.bottom, SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }

    unsafe extern "system" fn procedure(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        match message {
            WM_PAINT => {
                let mut paint = std::mem::zeroed();
                let dc = BeginPaint(window, &mut paint);
                let mut rect: RECT = std::mem::zeroed();
                GetClientRect(window, &mut rect);
                let background = CreateSolidBrush(0x00f2f4f4);
                FillRect(dc, &rect, background);
                DeleteObject(background);
                SetBkMode(dc, TRANSPARENT as i32);
                let dpi = GetDpiForWindow(window).max(96) as i32;
                let center = (rect.bottom - rect.top) / 2;
                let mut title = RECT { top: center - 32 * dpi / 96, bottom: center + 8 * dpi / 96, ..rect };
                draw(dc, w!("RNL Viewer"), &mut title, 28 * dpi / 96, 600, 0x001f1d1d);
                let version = format!("v{}\0", env!("CARGO_PKG_VERSION")).encode_utf16().collect::<Vec<_>>();
                let mut label = RECT { top: center + 10 * dpi / 96, bottom: center + 32 * dpi / 96, ..rect };
                draw(dc, version.as_ptr(), &mut label, 13 * dpi / 96, 400, 0x00706b6b);
                EndPaint(window, &paint);
                0
            }
            _ => DefWindowProcW(window, message, wparam, lparam),
        }
    }

    unsafe fn draw(dc: HDC, text: windows_sys::core::PCWSTR, rect: &mut RECT, size: i32, weight: i32, color: u32) {
        let font = CreateFontW(
            -size,
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            DEFAULT_CHARSET as u32,
            0,
            0,
            CLEARTYPE_QUALITY as u32,
            0,
            w!("Segoe UI"),
        );
        let old = SelectObject(dc, font);
        SetTextColor(dc, color);
        DrawTextW(dc, text, -1, rect, DT_CENTER | DT_SINGLELINE | DT_VCENTER);
        SelectObject(dc, old);
        DeleteObject(font);
    }
}

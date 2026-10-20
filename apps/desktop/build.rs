fn main() {
    // Refresh the executable's Windows resources when the icon changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}

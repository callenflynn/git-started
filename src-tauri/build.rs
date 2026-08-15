fn main() {
    // tauri-build does not emit rerun-if-changed for the bundle icons, so a
    // regenerated icons/icon.ico would otherwise be silently skipped and the
    // exe would keep the stale icon. Watch them explicitly.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build();
}

# Vendored crates

## wry 0.53.5

Patched copy of crates.io `wry@0.53.5`.

**Why:** Upstream macOS `collect_paths` unwraps a nil pasteboard payload when the drag
source only publishes modern `public.file-url` (e.g. dragging a selected file out of
the system open panel into the webview). That panics the main thread and the app
exits. Web is unaffected because it never hits wry.

**Patch:** Same fix as [tauri-apps/wry#1723](https://github.com/tauri-apps/wry/pull/1723)
(modern `readObjectsForClasses:options:` + no unwrap on legacy fallback).
Also strips `examples/` and allows a few upstream rustc lints so path-dep builds stay quiet.

**Remove when:** Tauri locks a wry release that includes #1723 (or equivalent).
Then delete `vendor/wry` and the `[patch.crates-io]` entry in `Cargo.toml`.

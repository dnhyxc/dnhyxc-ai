use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{IconMenuItem, IconMenuItemBuilder, MenuBuilder, NativeIcon, SubmenuBuilder};
use tauri::{AppHandle, Runtime, async_runtime};

use crate::utils::common::{get_store_value, set_screen_center};

/// 与前端 `WINDOW_SHORTCUT_KEYS` / `FILE_SHORTCUT_KEYS` / `shortcut_{n}` 对齐
pub const WIN_SHORTCUT_MINIMIZE: i32 = 25;
pub const WIN_SHORTCUT_CLOSE: i32 = 26;
pub const WIN_SHORTCUT_SCALE: i32 = 27;
pub const WIN_SHORTCUT_FILL: i32 = 28;
pub const WIN_SHORTCUT_CENTER: i32 = 29;
pub const WIN_SHORTCUT_FULLSCREEN: i32 = 30;
pub const FILE_SHORTCUT_ABOUT: i32 = 31;
pub const FILE_SHORTCUT_LOGOUT: i32 = 32;
pub const FILE_SHORTCUT_QUIT: i32 = 33;

const DEFAULT_MINIMIZE: &str = "Meta + M";
const DEFAULT_CLOSE: &str = "Meta + W";
const DEFAULT_SCALE: &str = "Meta + Shift + S";
const DEFAULT_FILL: &str = "Meta + Shift + F";
const DEFAULT_CENTER: &str = "Meta + Shift + C";
const DEFAULT_FULLSCREEN: &str = "Control + Meta + F";
const DEFAULT_ABOUT: &str = "Meta + Shift + A";
const DEFAULT_LOGOUT: &str = "Meta + Shift + L";
const DEFAULT_QUIT: &str = "Meta + Q";

pub struct MenuAccelHandles<R: Runtime> {
	about: IconMenuItem<R>,
	logout: IconMenuItem<R>,
	quit: IconMenuItem<R>,
	minimize: IconMenuItem<R>,
	close: IconMenuItem<R>,
	scale: IconMenuItem<R>,
	fill: IconMenuItem<R>,
	center: IconMenuItem<R>,
	fullscreen: IconMenuItem<R>,
}

pub fn setup_menu<R: tauri::Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
	let chords = load_menu_chords(app.handle());

	let about = IconMenuItemBuilder::with_id("about", "关于应用")
		.accelerator(store_chord_to_accel(&chords.about))
		.native_icon(NativeIcon::Info)
		.build(app)?;
	let logout = IconMenuItemBuilder::with_id("logout", "退出登录")
		.accelerator(store_chord_to_accel(&chords.logout))
		.native_icon(NativeIcon::User)
		.build(app)?;
	let quit = IconMenuItemBuilder::with_id("quit", "退出应用")
		.accelerator(store_chord_to_accel(&chords.quit))
		.native_icon(NativeIcon::StopProgress)
		.build(app)?;

	let file_menu = SubmenuBuilder::new(app, "File")
		.item(&about)
		.separator()
		.item(&logout)
		.item(&quit)
		.build()?;

	let minimize = IconMenuItemBuilder::with_id("minimize", "隐藏窗口")
		.accelerator(store_chord_to_accel(&chords.minimize))
		.native_icon(NativeIcon::Remove)
		.build(app)?;
	let close = IconMenuItemBuilder::with_id("close", "关闭窗口")
		.accelerator(store_chord_to_accel(&chords.close))
		.native_icon(NativeIcon::StopProgress)
		.build(app)?;
	let scale = IconMenuItemBuilder::with_id("scale", "缩放窗口")
		.accelerator(store_chord_to_accel(&chords.scale))
		.native_icon(NativeIcon::IconView)
		.build(app)?;
	let fill = IconMenuItemBuilder::with_id("fill", "填充窗口")
		.accelerator(store_chord_to_accel(&chords.fill))
		.native_icon(NativeIcon::EnterFullScreen)
		.build(app)?;
	let center = IconMenuItemBuilder::with_id("center", "居中窗口")
		.accelerator(store_chord_to_accel(&chords.center))
		.native_icon(NativeIcon::Computer)
		.build(app)?;
	let fullscreen = IconMenuItemBuilder::with_id("fullscreen", "全屏窗口")
		.accelerator(store_chord_to_accel(&chords.fullscreen))
		.native_icon(NativeIcon::EnterFullScreen)
		.build(app)?;

	let window_menu = SubmenuBuilder::new(app, "窗口")
		.item(&close)
		.separator()
		.item(&minimize)
		.item(&scale)
		.item(&fill)
		.item(&center)
		.separator()
		.item(&fullscreen)
		.build()?;

	let edit_menu = SubmenuBuilder::new(app, "编辑")
		.undo_with_text("撤回")
		.separator()
		.cut_with_text("剪切")
		.copy_with_text("复制")
		.paste_with_text("粘贴")
		.separator()
		.select_all_with_text("全选")
		.build()?;

	let menu = MenuBuilder::new(app)
		.items(&[&file_menu, &window_menu, &edit_menu])
		.build()?;

	app.set_menu(menu)?;

	app.manage(MenuAccelHandles {
		about: about.clone(),
		logout: logout.clone(),
		quit: quit.clone(),
		minimize: minimize.clone(),
		close: close.clone(),
		scale: scale.clone(),
		fill: fill.clone(),
		center: center.clone(),
		fullscreen: fullscreen.clone(),
	});

	#[cfg(target_os = "macos")]
	{
		macos_apply_uniform_menu_icons();
		macos_strip_edit_system_items();
	}

	app.on_menu_event(move |app_handle: &tauri::AppHandle<R>, event| {
		let win = app_handle.get_webview_window("main").unwrap();

		match event.id().0.as_str() {
			"minimize" => {
				let _ = win.minimize();
			}
			"close" => {
				let _ = win.close();
			}
			"scale" => {
				#[cfg(target_os = "macos")]
				{
					crate::system::zoom::toggle_main();
				}
				#[cfg(not(target_os = "macos"))]
				{
					if win.is_maximized().unwrap_or(false) {
						let _ = win.unmaximize();
					} else {
						let _ = win.maximize();
					}
				}
			}
			"center" => {
				set_screen_center(&win);
			}
			"fill" => {
				if let Ok(Some(monitor)) = win.current_monitor() {
					let size = monitor.size();
					let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
						width: size.width,
						height: size.height,
					}));
					let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
						x: 0,
						y: 0,
					}));
				}
			}
			"fullscreen" => {
				let next = !win.is_fullscreen().unwrap_or(false);
				// 与 Esc 同序：先通知前端收影院，再缩窗
				if !next {
					let _ = win.emit("host://will-exit-fullscreen", ());
				}
				let _ = win.set_fullscreen(next);
				crate::system::event::emit_window_fullscreen_state(&win);
			}
			"quit" => {
				let _ = app_handle.exit(0);
			}
			"logout" => {
				// 用 AppHandle 广播，确保前端 listen('logout') 一定能收到
				let _ = app_handle.emit("logout", ());
			}
			"about" => {
				// 已打开则原生侧置顶聚焦（macOS 上 JS setFocus 常被主窗盖住）
				if let Some(about) = app_handle.get_webview_window("about") {
					let _ = about.unminimize();
					let _ = about.show();
					let _ = about.set_focus();
				} else {
					let app_version = app_handle.package_info().version.to_string();
					let _ = app_handle.emit(
						"about",
						serde_json::json!({ "version": app_version }),
					);
				}
			}
			_ => {}
		}
	});

	Ok(())
}

struct MenuChords {
	about: String,
	logout: String,
	quit: String,
	minimize: String,
	close: String,
	scale: String,
	fill: String,
	center: String,
	fullscreen: String,
}

fn load_menu_chords<R: Runtime>(app: &AppHandle<R>) -> MenuChords {
	async_runtime::block_on(async {
		MenuChords {
			about: chord_or_default(app, FILE_SHORTCUT_ABOUT, DEFAULT_ABOUT).await,
			logout: chord_or_default(app, FILE_SHORTCUT_LOGOUT, DEFAULT_LOGOUT).await,
			quit: chord_or_default(app, FILE_SHORTCUT_QUIT, DEFAULT_QUIT).await,
			minimize: chord_or_default(app, WIN_SHORTCUT_MINIMIZE, DEFAULT_MINIMIZE).await,
			close: chord_or_default(app, WIN_SHORTCUT_CLOSE, DEFAULT_CLOSE).await,
			scale: chord_or_default(app, WIN_SHORTCUT_SCALE, DEFAULT_SCALE).await,
			fill: chord_or_default(app, WIN_SHORTCUT_FILL, DEFAULT_FILL).await,
			center: chord_or_default(app, WIN_SHORTCUT_CENTER, DEFAULT_CENTER).await,
			fullscreen: chord_or_default(app, WIN_SHORTCUT_FULLSCREEN, DEFAULT_FULLSCREEN).await,
		}
	})
}

async fn chord_or_default<R: Runtime>(app: &AppHandle<R>, key: i32, default: &str) -> String {
	let store_key = format!("shortcut_{key}");
	match get_store_value(app, &store_key).await {
		Ok(v) if !v.trim().is_empty() => v.trim().to_string(),
		_ => default.to_string(),
	}
}

/// store 格式 `Meta + Shift + S` → muda `Command+Shift+S`
fn store_chord_to_accel(chord: &str) -> String {
	chord
		.split(" + ")
		.map(str::trim)
		.filter(|s| !s.is_empty())
		.map(|s| {
			let lower = s.to_lowercase();
			match lower.as_str() {
				"meta" | "super" | "command" | "cmd" => "Command".to_string(),
				"control" | "ctrl" => "Control".to_string(),
				"alt" | "option" => "Alt".to_string(),
				"shift" => "Shift".to_string(),
				_ => s.to_string(),
			}
		})
		.collect::<Vec<_>>()
		.join("+")
}

/// 从 store 刷新菜单右侧快捷键（设置页改键后调用）
pub fn sync_window_menu_accelerators<R: Runtime>(app: &AppHandle<R>) {
	let Some(handles) = app.try_state::<MenuAccelHandles<R>>() else {
		return;
	};
	let chords = load_menu_chords(app);
	let _ = handles
		.about
		.set_accelerator(Some(store_chord_to_accel(&chords.about)));
	let _ = handles
		.logout
		.set_accelerator(Some(store_chord_to_accel(&chords.logout)));
	let _ = handles
		.quit
		.set_accelerator(Some(store_chord_to_accel(&chords.quit)));
	let _ = handles
		.minimize
		.set_accelerator(Some(store_chord_to_accel(&chords.minimize)));
	let _ = handles
		.close
		.set_accelerator(Some(store_chord_to_accel(&chords.close)));
	let _ = handles
		.scale
		.set_accelerator(Some(store_chord_to_accel(&chords.scale)));
	let _ = handles
		.fill
		.set_accelerator(Some(store_chord_to_accel(&chords.fill)));
	let _ = handles
		.center
		.set_accelerator(Some(store_chord_to_accel(&chords.center)));
	let _ = handles
		.fullscreen
		.set_accelerator(Some(store_chord_to_accel(&chords.fullscreen)));
}

/// NativeIcon::Info 等是彩色位图，与模板图标视觉尺寸不一致；改用同字号 SF Symbol 模板图。
#[cfg(target_os = "macos")]
fn macos_apply_uniform_menu_icons() {
	use objc2::MainThreadMarker;
	use objc2_app_kit::{
		NSApplication, NSFontWeightRegular, NSImage, NSImageSymbolConfiguration,
	};
	use objc2_foundation::{NSSize, NSString};

	let Some(mtm) = MainThreadMarker::new() else {
		return;
	};
	let app = NSApplication::sharedApplication(mtm);
	let Some(main_menu) = app.mainMenu() else {
		return;
	};

	let size_cfg =
		NSImageSymbolConfiguration::configurationWithPointSize_weight(14.0, unsafe {
			NSFontWeightRegular
		});
	let mono = NSImageSymbolConfiguration::configurationPreferringMonochrome();
	let cfg = size_cfg.configurationByApplyingConfiguration(&mono);

	// title → SF Symbol（固定 pointSize + template，菜单栏视觉一致）
	const MAP: &[(&str, &str)] = &[
		("关于应用", "info.circle"),
		("退出登录", "person.circle"),
		("退出应用", "xmark.circle"),
		("关闭窗口", "xmark"),
		("隐藏窗口", "minus"),
		("缩放窗口", "arrow.up.left.and.arrow.down.right"),
		("填充窗口", "rectangle.inset.filled"),
		("居中窗口", "dot.square"),
		("全屏窗口", "arrow.up.left.and.arrow.down.right"),
	];

	for top in main_menu.itemArray() {
		let Some(sub) = top.submenu() else {
			continue;
		};
		for item in sub.itemArray() {
			let title = item.title().to_string();
			let Some((_, symbol)) = MAP.iter().find(|(t, _)| *t == title.as_str()) else {
				continue;
			};
			let Some(base) = NSImage::imageWithSystemSymbolName_accessibilityDescription(
				&NSString::from_str(symbol),
				None,
			) else {
				continue;
			};
			let Some(img) = base.imageWithSymbolConfiguration(&cfg) else {
				continue;
			};
			img.setTemplate(true);
			img.setSize(NSSize::new(18.0, 18.0));
			item.setImage(Some(&img));
		}
	}
}

/// macOS 会往 Edit 菜单注入「自动填充 / 听写 / 表情」；延后多次剥离（系统可能晚于 set_menu 注入）。
#[cfg(target_os = "macos")]
fn macos_strip_edit_system_items() {
	use dispatch2::{DispatchQueue, DispatchTime};

	for delay_ns in [0_i64, 50_000_000, 250_000_000, 1_000_000_000] {
		let when = DispatchTime::NOW.time(delay_ns);
		let _ = DispatchQueue::main().after(when, || {
			strip_edit_system_items_now();
		});
	}
}

#[cfg(target_os = "macos")]
fn is_edit_system_junk_title(title: &str) -> bool {
	matches!(
		title,
		"AutoFill"
			| "Autofill"
			| "Auto Fill"
			| "自动填充"
			| "Start Dictation..."
			| "Start Dictation…"
			| "开始听写…"
			| "开始听写..."
			| "Emoji & Symbols"
			| "表情与符号"
	)
}

#[cfg(target_os = "macos")]
fn strip_edit_system_items_now() {
	use objc2::MainThreadMarker;
	use objc2_app_kit::NSApplication;

	let Some(mtm) = MainThreadMarker::new() else {
		return;
	};
	let app = NSApplication::sharedApplication(mtm);
	let Some(main_menu) = app.mainMenu() else {
		return;
	};

	for top in main_menu.itemArray() {
		if top.title().to_string() != "编辑" {
			continue;
		}
		let Some(edit) = top.submenu() else {
			continue;
		};
		let junk: Vec<_> = edit
			.itemArray()
			.into_iter()
			.filter(|item| is_edit_system_junk_title(&item.title().to_string()))
			.collect();
		for item in junk {
			edit.removeItem(&item);
		}
		// 去掉末尾多余分隔线
		loop {
			let Some(last) = edit.itemArray().into_iter().last() else {
				break;
			};
			if !last.isSeparatorItem() {
				break;
			}
			edit.removeItem(&last);
		}
	}
}

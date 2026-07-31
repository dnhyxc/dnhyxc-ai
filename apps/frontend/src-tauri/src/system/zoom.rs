//! macOS 窗口缩放：目标尺寸预布局 + 只动画窗口（揭开/裁剪）。
//!
//! 放大：WebView/页面先布到目标大尺寸，窗口揭开已画好的区域（无露白）。
//! 缩小：cover 随窗口进度一起收，避免拖到结束才一瞬间 reflow 抖动。
//! 开场不再空等预布局帧，首帧同时改布局并动窗口，减轻「布局已变、窗未动」的一瞬。

use dispatch2::{DispatchQueue, DispatchTime};
use objc2::runtime::{AnyObject, Imp, Sel};
use objc2::{sel, ClassType};
use objc2_app_kit::{NSColor, NSWindow};
use objc2_foundation::{NSPoint, NSRect, NSSize};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Mutex, Once};
use tauri::WebviewWindow;

const ANIM_SECS: f64 = 0.28;
const FRAME_NS: i64 = 16_666_667;

#[derive(Clone, Copy)]
struct Frame {
	x: f64,
	y: f64,
	w: f64,
	h: f64,
}

impl From<NSRect> for Frame {
	fn from(r: NSRect) -> Self {
		Self {
			x: r.origin.x,
			y: r.origin.y,
			w: r.size.width,
			h: r.size.height,
		}
	}
}

impl Frame {
	fn to_ns(self) -> NSRect {
		NSRect::new(NSPoint::new(self.x, self.y), NSSize::new(self.w, self.h))
	}
}

struct ZoomState {
	restore: Option<Frame>,
	filled: bool,
}

struct Anim {
	ns_ptr: usize,
	from: Frame,
	to: Frame,
	content_from: (f64, f64),
	content_to: (f64, f64),
	enlarging: bool,
	step: u32,
	steps: u32,
}

static INSTALL: Once = Once::new();
static ORIG_ZOOM: AtomicUsize = AtomicUsize::new(0);
static EMIT_WIN: Mutex<Option<WebviewWindow>> = Mutex::new(None);
static STATE: Mutex<ZoomState> = Mutex::new(ZoomState {
	restore: None,
	filled: false,
});
static ANIM: Mutex<Option<Anim>> = Mutex::new(None);
static BUSY: AtomicBool = AtomicBool::new(false);

pub fn install(win: &WebviewWindow) {
	if let Ok(mut g) = EMIT_WIN.lock() {
		*g = Some(win.clone());
	}

	if let Ok(ns) = win.ns_window() {
		unsafe {
			let ns = &*(ns as *const NSWindow);
			let bg = NSColor::colorWithSRGBRed_green_blue_alpha(0.118, 0.118, 0.118, 1.0);
			ns.setBackgroundColor(Some(&bg));
		}
	}

	INSTALL.call_once(|| {
		let Some(method) = NSWindow::class().instance_method(sel!(zoom:)) else {
			return;
		};
		ORIG_ZOOM.store(method.implementation() as usize, Ordering::SeqCst);
		let new: Imp = unsafe {
			std::mem::transmute(
				zoom_fwd as unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject),
			)
		};
		unsafe {
			method.set_implementation(new);
		}
	});
}

pub fn toggle(win: &WebviewWindow) {
	let Ok(ns) = win.ns_window() else {
		return;
	};
	unsafe { apply_toggle(&*(ns as *const NSWindow)) };
}

pub fn toggle_main() {
	// 必须先 clone 再放锁：toggle→tick→eval 还会锁 EMIT_WIN，持锁重入会卡死
	let win = {
		let Ok(g) = EMIT_WIN.lock() else {
			return;
		};
		g.as_ref().cloned()
	};
	let Some(win) = win else {
		return;
	};
	toggle(&win);
}

unsafe extern "C-unwind" fn zoom_fwd(
	this: *mut AnyObject,
	_cmd: Sel,
	sender: *mut AnyObject,
) {
	if EMIT_WIN.lock().ok().and_then(|g| g.as_ref().map(|_| ())).is_some() {
		unsafe { apply_toggle(&*(this as *const NSWindow)) };
		return;
	}
	let orig = ORIG_ZOOM.load(Ordering::SeqCst);
	if orig == 0 {
		return;
	}
	let f: unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject) =
		unsafe { std::mem::transmute(orig) };
	unsafe { f(this, _cmd, sender) };
}

fn ease(t: f64) -> f64 {
	if t < 0.5 {
		4.0 * t * t * t
	} else {
		1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
	}
}

fn lerp(a: Frame, b: Frame, t: f64) -> Frame {
	Frame {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		w: a.w + (b.w - a.w) * t,
		h: a.h + (b.h - a.h) * t,
	}
}

fn lerp2(a: (f64, f64), b: (f64, f64), t: f64) -> (f64, f64) {
	(a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
}

unsafe fn apply_toggle(ns: &NSWindow) {
	if BUSY.swap(true, Ordering::SeqCst) {
		return;
	}

	let from = Frame::from(ns.frame());
	let to = {
		let Ok(mut st) = STATE.lock() else {
			BUSY.store(false, Ordering::SeqCst);
			return;
		};
		if st.filled {
			st.filled = false;
			st.restore.unwrap_or(from)
		} else {
			let Some(screen) = ns.screen() else {
				BUSY.store(false, Ordering::SeqCst);
				return;
			};
			st.restore = Some(from);
			st.filled = true;
			Frame::from(screen.visibleFrame())
		}
	};

	let content_from = ns
		.contentView()
		.map(|c| {
			let b = c.bounds().size;
			(b.width.max(1.0), b.height.max(1.0))
		})
		.unwrap_or((from.w.max(1.0), from.h.max(1.0)));
	let content_to = (
		(content_from.0 + (to.w - from.w)).max(1.0),
		(content_from.1 + (to.h - from.h)).max(1.0),
	);
	let enlarging = to.w * to.h > from.w * from.h;

	if let Some(content) = ns.contentView() {
		content.setClipsToBounds(true);
	}

	let steps = ((ANIM_SECS * 60.0).round() as u32).max(1);
	if let Ok(mut g) = ANIM.lock() {
		*g = Some(Anim {
			ns_ptr: ns as *const NSWindow as usize,
			from,
			to,
			content_from,
			content_to,
			enlarging,
			step: 0,
			steps,
		});
	}

	// 首帧立刻：布局与窗口同帧起步，去掉预等待造成的「布局已变窗未动」
	tick();
}

fn schedule_tick() {
	let when = DispatchTime::NOW.time(FRAME_NS);
	let _ = DispatchQueue::main().after(when, || {
		tick();
	});
}

fn tick() {
	let (ns_ptr, frame, cover_w, cover_h, enlarging, done) = {
		let Ok(mut g) = ANIM.lock() else {
			BUSY.store(false, Ordering::SeqCst);
			return;
		};
		let Some(anim) = g.as_mut() else {
			BUSY.store(false, Ordering::SeqCst);
			return;
		};
		anim.step = anim.step.saturating_add(1);
		let raw_t = (anim.step as f64 / anim.steps as f64).min(1.0);
		let t = ease(raw_t);
		let frame = lerp(anim.from, anim.to, t);

		// 放大：cover 始终为目标大尺寸（窗口揭开）
		// 缩小：cover 随进度收到目标小尺寸（避免结束才跳）
		let (cover_w, cover_h) = if anim.enlarging {
			anim.content_to
		} else {
			lerp2(anim.content_from, anim.content_to, t)
		};

		let done = anim.step >= anim.steps;
		let out = (
			anim.ns_ptr,
			frame,
			cover_w,
			cover_h,
			anim.enlarging,
			done,
		);
		if done {
			*g = None;
		}
		out
	};

	unsafe {
		let ns = &*(ns_ptr as *const NSWindow);

		if enlarging && cover_w > 0.0 {
			// 放大：先保证大尺寸已钉住，再动窗口，同帧完成
			push_page_size(cover_w, cover_h, false);
			pin_webview_cover(ns, cover_w, cover_h);
		}

		ns.setFrame_display_animate(frame.to_ns(), true, false);

		if enlarging {
			pin_webview_cover(ns, cover_w, cover_h);
		} else {
			// 缩小：布局跟 cover 同步收
			push_page_size(cover_w, cover_h, false);
			pin_webview_cover(ns, cover_w, cover_h);
		}

		if done {
			pin_webview_fit(ns);
			clear_page_size_override();
			BUSY.store(false, Ordering::SeqCst);
		}
	}

	if !done {
		schedule_tick();
	}
}

/// 顶对齐钉住 cover 尺寸（超高时 y 为负，露出顶部）。
unsafe fn pin_webview_cover(ns: &NSWindow, cover_w: f64, cover_h: f64) {
	let Some(content) = ns.contentView() else {
		return;
	};
	content.setClipsToBounds(true);
	let b = content.bounds();
	let frame = NSRect::new(
		NSPoint::new(0.0, b.size.height - cover_h),
		NSSize::new(cover_w.max(1.0), cover_h.max(1.0)),
	);
	for view in content.subviews() {
		view.setFrame(frame);
	}
}

unsafe fn pin_webview_fit(ns: &NSWindow) {
	let Some(content) = ns.contentView() else {
		return;
	};
	let bounds = content.bounds();
	for view in content.subviews() {
		view.setFrame(bounds);
	}
	content.setNeedsLayout(true);
	content.layoutSubtreeIfNeeded();
	ns.displayIfNeeded();
}

fn push_page_size(w: f64, h: f64, clear_after: bool) {
	let Ok(g) = EMIT_WIN.lock() else {
		return;
	};
	let Some(win) = g.as_ref() else {
		return;
	};
	let js = if clear_after {
		r#"(function(){var r=document.documentElement,b=document.body;r.style.width="";r.style.height="";if(b){b.style.width="";b.style.height="";}var root=document.getElementById("root");if(root){root.style.width="";root.style.height="";}window.dispatchEvent(new Event("resize"));})()"#
			.to_string()
	} else {
		format!(
			r#"(function(){{var w={w:.0},h={h:.0};var r=document.documentElement,b=document.body;r.style.width=w+"px";r.style.height=h+"px";if(b){{b.style.width=w+"px";b.style.height=h+"px";}}var root=document.getElementById("root");if(root){{root.style.width=w+"px";root.style.height=h+"px";}}window.dispatchEvent(new Event("resize"));}})()"#
		)
	};
	let _ = win.eval(&js);
}

fn clear_page_size_override() {
	push_page_size(0.0, 0.0, true);
}

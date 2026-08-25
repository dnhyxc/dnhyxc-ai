//! macOS：在窗口真正退出全屏动画之前发出 will-exit，
//! 让 Host 先收起影院/播放器最大化（与 Esc 同序）。

use std::ptr::NonNull;
use std::sync::Mutex;

use block2::RcBlock;
use objc2::runtime::AnyObject;
use objc2_app_kit::NSWindowWillExitFullScreenNotification;
use objc2_foundation::{NSNotification, NSNotificationCenter, NSOperationQueue};
use tauri::{Emitter, WebviewWindow};

const WILL_EXIT: &str = "host://will-exit-fullscreen";

static EMIT_WIN: Mutex<Option<WebviewWindow>> = Mutex::new(None);

pub fn install(win: &WebviewWindow) {
	if let Ok(mut g) = EMIT_WIN.lock() {
		*g = Some(win.clone());
	}

	let ns_ptr = match win.ns_window() {
		Ok(p) => p as *const AnyObject,
		Err(_) => return,
	};

	unsafe {
		let center = NSNotificationCenter::defaultCenter();
		let block = RcBlock::new(|_notif: NonNull<NSNotification>| {
			let w = EMIT_WIN
				.lock()
				.ok()
				.and_then(|g| g.as_ref().cloned());
			if let Some(w) = w {
				let _ = w.emit(WILL_EXIT, ());
			}
		});

		let obj = &*ns_ptr;
		let observer = center.addObserverForName_object_queue_usingBlock(
			Some(NSWindowWillExitFullScreenNotification),
			Some(obj),
			Some(&*NSOperationQueue::mainQueue()),
			&block,
		);
		// 进程级常驻；忘掉 Retained 以免 !Send 无法进 static Mutex
		std::mem::forget(observer);
	}
}

import { setHostThemePropPattern } from './css/themeStrip';
import { setHostViteRootMarker } from './sandbox/reclaim';

export type StyleIsolationOptions = {
	themePropPattern?: RegExp;
	hostViteRootMarker?: string;
};

/** 在 createPluginRuntime / Host 启动时调用一次 */
export function configureStyleIsolation(opts?: StyleIsolationOptions) {
	if (opts?.themePropPattern) setHostThemePropPattern(opts.themePropPattern);
	if (opts?.hostViteRootMarker != null) {
		setHostViteRootMarker(opts.hostViteRootMarker);
	}
}

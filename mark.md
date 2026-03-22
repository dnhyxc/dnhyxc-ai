# React 2025-2026 核心面试题与深度解析

## 一、React 核心机制与并发模式

### 1. **面试题：React 的 Fiber 架构如何支持并发渲染？请描述从 setState 到屏幕更新的完整流程**

**深度解析：**

```javascript
// Fiber 节点的核心结构
class FiberNode {
	constructor(tag, pendingProps, key) {
		this.tag = tag; // 组件类型
		this.key = key;
		this.type = null; // 组件函数/类
		this.stateNode = null; // DOM 实例

		// 链表结构
		this.return = null; // 父节点
		this.child = null; // 第一个子节点
		this.sibling = null; // 兄弟节点

		// 状态相关
		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null; // 更新队列

		// 副作用标记
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;

		// 调度相关
		this.lanes = NoLanes; // 优先级车道
		this.childLanes = NoLanes;
	}
}

// 完整更新流程
class ReactUpdateProcess {
	// 1. 触发更新
	setState(newState) {
		// 创建更新对象
		const update = {
			lane: requestUpdateLane(fiber), // 分配优先级
			payload: newState,
			next: null,
		};

		// 加入更新队列
		enqueueUpdate(fiber, update);

		// 调度更新
		scheduleUpdateOnFiber(fiber, update.lane);
	}

	// 2. 调度阶段
	scheduleUpdateOnFiber(root, lane) {
		// 标记需要更新的根节点
		markRootUpdated(root, lane);

		// 确保调度器工作
		ensureRootIsScheduled(root);

		// 根据优先级决定立即执行还是延迟
		if (lane === SyncLane) {
			performSyncWorkOnRoot(root);
		} else {
			scheduleCallback(
				schedulerPriority,
				performConcurrentWorkOnRoot.bind(null, root)
			);
		}
	}

	// 3. 渲染阶段（可中断）
	performConcurrentWorkOnRoot(root) {
		// 构建 workInProgress 树
		prepareFreshStack(root);

		// 循环处理工作单元
		workLoopConcurrent();

		// 如果被中断，返回未完成的工作
		if (workInProgress !== null) {
			return performConcurrentWorkOnRoot.bind(null, root);
		}

		// 完成渲染，进入提交阶段
		commitRoot(root);
	}

	// 4. 提交阶段（不可中断）
	commitRoot(root) {
		// 准备提交
		prepareForCommit(root.containerInfo);

		// 副作用提交分为三个阶段
		commitBeforeMutationEffects(root);
		commitMutationEffects(root);
		commitLayoutEffects(root);

		// 切换当前树
		root.current = finishedWork;
	}
}

// 关键优化：双缓冲技术
function prepareFreshStack(root) {
	// 从 current 树克隆出 workInProgress 树
	root.workInProgress = createWorkInProgress(root.current, null);

	// 两棵树交替使用，避免内存分配
	// 本次渲染使用 workInProgress 树
	// 渲染完成后交换指针
}
```

**核心要点：**

- **增量渲染**：Fiber 将渲染工作分解为可中断的单元
- **优先级调度**：不同更新分配不同 Lane，高优先级可中断低优先级
- **时间切片**：每 5ms 检查是否需要让出主线程
- **双缓冲**：避免渲染过程中的 UI 闪烁

### 2. **面试题：React 的合成事件系统与原生事件有何区别？为什么需要合成事件？**

**技术解析：**

```javascript
// 合成事件系统架构
class SyntheticEventSystem {
  constructor() {
    // 事件池：复用事件对象，避免频繁创建销毁
    this.eventPool = new Map();

    // 事件插件系统
    this.plugins = [
      SimpleEventPlugin,      // 简单事件：onClick, onChange
      ChangeEventPlugin,      // 表单变化
      SelectEventPlugin,      // 选择事件
      BeforeInputEventPlugin, // 输入前事件
    ];

    // 事件委托容器
    this.listeners = new Map();
  }

  // 事件注册
  listenTo(eventType, rootContainer) {
    const dependencies =
      eventPluginRegistry.getDependenciesForEvent(eventType);

    dependencies.forEach(dependency => {
      // 在根容器上委托监听
      addTrappedEventListener(
        rootContainer,
        dependency,
        false // 不使用捕获
      );
    });
  }

  // 事件分发
  dispatchEvent(domEvent) {
    // 1. 从事件池获取或创建合成事件
    const event = this.getEventFromPool(domEvent);

    // 2. 收集事件路径（从目标到根）
    const path = this.collectPaths(domEvent);

    // 3. 创建事件队列（模拟捕获和冒泡）
    const queue = this.createQueue(path, domEvent.bubbles);

    // 4. 处理捕获阶段
    this.processQueue(queue, true);

    // 5. 处理目标阶段
    this.processQueue(queue, false);

    // 6. 处理冒泡阶段
    this.processQueue(queue, false);

    // 7. 清理事件对象
    this.releaseEventToPool(event);
  }

  // 合成事件对象
  class SyntheticEvent {
    constructor(nativeEvent) {
      this.nativeEvent = nativeEvent;
      this._dispatchListeners = null;
      this._dispatchInstances = null;

      // 标准化事件属性
      this.type = nativeEvent.type;
      this.target = nativeEvent.target;
      this.currentTarget = null;
      this.timeStamp = nativeEvent.timeStamp;

      // 阻止默认行为和冒泡
      this.isDefaultPrevented = false;
      this.isPropagationStopped = false;
    }

    preventDefault() {
      this.isDefaultPrevented = true;
      if (this.nativeEvent.preventDefault) {
        this.nativeEvent.preventDefault();
      }
    }

    stopPropagation() {
      this.isPropagationStopped = true;
      if (this.nativeEvent.stopPropagation) {
        this.nativeEvent.stopPropagation();
      }
    }

    // 持久化事件（用于异步访问）
    persist() {
      this.isPersistent = true;
    }
  }
}

// 为什么需要合成事件？
const advantages = {
  // 1. 跨浏览器兼容性
  crossBrowser: '统一事件接口，屏蔽浏览器差异',

  // 2. 事件池优化性能
  performance: '复用事件对象，减少GC压力',

  // 3. 事件委托减少内存
  memory: '根容器委托，避免大量事件监听器',

  // 4. 统一的事件管理
  management: '方便实现批量更新、优先级调度',

  // 5. 额外的功能扩展
  extensions: [
    '支持自定义事件',
    '方便实现事件插件系统',
    '与React的更新机制深度集成'
  ]
};

// 实际使用中的注意事项
class EventHandlingExample extends React.Component {
  handleClick = (e) => {
    // 异步访问需要 persist()
    setTimeout(() => {
      console.log(e.target); // 可能为 null
    }, 0);

    // 正确做法
    e.persist();
    setTimeout(() => {
      console.log(e.target); // 正常访问
    }, 0);
  };

  // 事件冒泡与合成事件
  handleParentClick = (e) => {
    // e.nativeEvent 访问原生事件
    console.log('合成事件:', e.type);
    console.log('原生事件:', e.nativeEvent.type);

    // 事件委托的实际目标
    console.log('实际目标:', e.target);
    console.log('当前目标:', e.currentTarget);
  };

  render() {
    return (
      <div onClick={this.handleParentClick}>
        <button onClick={this.handleClick}>
          点击测试
        </button>
      </div>
    );
  }
}
```

## 二、状态管理与数据流设计

### 3. **面试题：设计一个支持时间旅行调试的状态管理系统，如何实现状态快照和回滚？**

**完整实现方案：**

```javascript
class TimeTravelStore {
	constructor(initialState) {
		// 状态历史记录
		this.past = []; // 过去的状态
		this.present = initialState; // 当前状态
		this.future = []; // 未来的状态（重做）

		// 配置选项
		this.config = {
			maxHistory: 50, // 最大历史记录
			shouldRecord: true, // 是否记录
			actionFilter: null, // 动作过滤器
		};

		// 订阅者
		this.subscribers = new Set();

		// 当前事务
		this.transaction = null;
	}

	// 分发动作
	dispatch(action) {
		// 开始事务
		this.beginTransaction();

		try {
			// 执行 reducer
			const newState = this.reducer(this.present, action);

			// 记录历史
			if (this.shouldRecordAction(action)) {
				this.recordHistory(action, this.present);
			}

			// 更新当前状态
			this.present = newState;

			// 清空未来（新的动作分支）
			this.future = [];

			// 通知订阅者
			this.notifySubscribers();

			// 提交事务
			this.commitTransaction();
		} catch (error) {
			// 回滚事务
			this.rollbackTransaction();
			throw error;
		}
	}

	// 记录历史
	recordHistory(action, previousState) {
		// 创建快照
		const snapshot = {
			action,
			state: previousState,
			timestamp: Date.now(),
			stackTrace: this.captureStackTrace(),
		};

		// 添加到过去
		this.past.push(snapshot);

		// 限制历史长度
		if (this.past.length > this.config.maxHistory) {
			this.past.shift();
		}
	}

	// 时间旅行方法
	timeTravel = {
		// 撤销
		undo: () => {
			if (this.past.length === 0) return;

			const previous = this.past.pop();
			this.future.unshift({
				action: { type: "__REDO__" },
				state: this.present,
				timestamp: Date.now(),
			});

			this.present = previous.state;
			this.notifySubscribers();
		},

		// 重做
		redo: () => {
			if (this.future.length === 0) return;

			const next = this.future.shift();
			this.past.push({
				action: { type: "__UNDO__" },
				state: this.present,
				timestamp: Date.now(),
			});

			this.present = next.state;
			this.notifySubscribers();
		},

		// 跳转到特定时间点
		jumpTo: (index) => {
			if (index < 0 || index >= this.past.length) return;

			// 保存当前状态到未来
			this.future = [
				{
					action: { type: "__JUMP__" },
					state: this.present,
					timestamp: Date.now(),
				},
				...this.future,
			];

			// 更新过去记录
			const newPast = this.past.slice(0, index + 1);
			const targetState = this.past[index].state;

			this.past = newPast;
			this.present = targetState;
			this.notifySubscribers();
		},

		// 录制和回放
		record: () => {
			this.config.shouldRecord = true;
			return this.getRecording();
		},

		replay: (speed = 1) => {
			return this.replayHistory(speed);
		},
	};

	// 获取录制数据
	getRecording() {
		return {
			past: this.past,
			present: this.present,
			future: this.future,
			config: { ...this.config },
		};
	}

	// 回放历史
	async replayHistory(speed) {
		const playback = [...this.past];
		const originalState = this.present;

		// 重置到初始状态
		this.present = playback[0]?.state || this.present;
		this.past = [];
		this.future = [];

		// 逐步回放
		for (let i = 0; i < playback.length; i++) {
			const snapshot = playback[i];

			// 更新状态
			this.present = snapshot.state;
			this.past.push(snapshot);

			// 通知订阅者
			this.notifySubscribers();

			// 控制播放速度
			await this.delay(1000 / speed);
		}

		// 恢复原始状态
		this.present = originalState;
		this.past = playback;
		this.notifySubscribers();
	}

	// 事务管理
	beginTransaction() {
		this.transaction = {
			startTime: Date.now(),
			actions: [],
			rollbackState: this.present,
		};
	}

	commitTransaction() {
		if (this.transaction) {
			// 可以在这里添加提交钩子
			this.transaction = null;
		}
	}

	rollbackTransaction() {
		if (this.transaction) {
			// 回滚到事务开始前的状态
			this.present = this.transaction.rollbackState;
			this.transaction = null;
			this.notifySubscribers();
		}
	}

	// 开发工具集成
	connectDevTools() {
		if (window.__REDUX_DEVTOOLS_EXTENSION__) {
			const devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
				name: "TimeTravelStore",
				features: {
					pause: true,
					lock: true,
					persist: true,
					export: true,
					import: "custom",
					jump: true,
					skip: true,
					reorder: true,
					dispatch: true,
					test: true,
				},
			});

			// 订阅状态变化
			this.subscribe(() => {
				devTools.send(this.lastAction || { type: "@@INIT" }, this.present);
			});

			// 监听开发工具动作
			devTools.subscribe((message) => {
				if (message.type === "DISPATCH") {
					this.handleDevToolsDispatch(message);
				}
			});
		}
	}

	handleDevToolsDispatch(message) {
		switch (message.payload.type) {
			case "JUMP_TO_STATE":
			case "JUMP_TO_ACTION":
				const index = message.payload.actionId;
				this.timeTravel.jumpTo(index);
				break;

			case "TOGGLE_ACTION":
				// 切换动作可见性
				break;

			case "IMPORT_STATE":
				// 导入状态
				const { computedStates } = message.payload.nextLiftedState;
				this.importState(computedStates);
				break;
		}
	}
}

// 使用示例
const store = new TimeTravelStore({ count: 0 }, (state, action) => {
	switch (action.type) {
		case "INCREMENT":
			return { ...state, count: state.count + 1 };
		case "DECREMENT":
			return { ...state, count: state.count - 1 };
		default:
			return state;
	}
});

// 连接 React
const TimeTravelContext = React.createContext();

function TimeTravelProvider({ children }) {
	const [state, setState] = useState(store.present);

	useEffect(() => {
		const unsubscribe = store.subscribe(() => {
			setState(store.present);
		});

		// 连接开发工具
		store.connectDevTools();

		return unsubscribe;
	}, []);

	const dispatch = useCallback((action) => {
		store.dispatch(action);
	}, []);

	return (
		<TimeTravelContext.Provider
			value={{ state, dispatch, timeTravel: store.timeTravel }}
		>
			{children}
			<TimeTravelDebugger />
		</TimeTravelContext.Provider>
	);
}

// 时间旅行调试器组件
function TimeTravelDebugger() {
	const { state, timeTravel, dispatch } = useContext(TimeTravelContext);
	const [isRecording, setIsRecording] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState(1);

	return (
		<div className="time-travel-debugger">
			<div className="controls">
				<button onClick={timeTravel.undo} disabled={store.past.length === 0}>
					⏪ 撤销
				</button>

				<button onClick={timeTravel.redo} disabled={store.future.length === 0}>
					⏩ 重做
				</button>

				<button onClick={() => setIsRecording(!isRecording)}>
					{isRecording ? "⏹️ 停止录制" : "⏺️ 开始录制"}
				</button>

				<button onClick={() => timeTravel.replay(playbackSpeed)}>
					▶️ 回放
				</button>

				<input
					type="range"
					min="0.1"
					max="5"
					step="0.1"
					value={playbackSpeed}
					onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
				/>
				<span>速度: {playbackSpeed}x</span>
			</div>

			<div className="history">
				<h4>历史记录</h4>
				<ul>
					{store.past.map((snapshot, index) => (
						<li key={index}>
							<button onClick={() => timeTravel.jumpTo(index)}>
								{snapshot.action.type} -
								{new Date(snapshot.timestamp).toLocaleTimeString()}
							</button>
						</li>
					))}
				</ul>
			</div>

			<div className="current-state">
				<h4>当前状态</h4>
				<pre>{JSON.stringify(state, null, 2)}</pre>
			</div>

			<div className="actions">
				<h4>执行动作</h4>
				<button onClick={() => dispatch({ type: "INCREMENT" })}>增加</button>
				<button onClick={() => dispatch({ type: "DECREMENT" })}>减少</button>
				<button onClick={() => dispatch({ type: "RESET" })}>重置</button>
			</div>
		</div>
	);
}

// 快照序列化优化
class OptimizedSnapshot {
	constructor(state) {
		this.state = state;
		this.compressed = this.compress(state);
		this.hash = this.calculateHash(state);
	}

	compress(state) {
		// 使用 JSON.stringify 的 replacer 函数优化
		const seen = new WeakSet();
		return JSON.stringify(state, (key, value) => {
			if (typeof value === "object" && value !== null) {
				if (seen.has(value)) {
					return "[Circular]";
				}
				seen.add(value);
			}
			return value;
		});
	}

	calculateHash(state) {
		// 简单的哈希函数用于快速比较
		const str = JSON.stringify(state);
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // 转换为32位整数
		}
		return hash.toString(36);
	}

	// 增量快照（只存储变化的部分）
	static createDelta(prevSnapshot, currentState) {
		const delta = {};
		let hasChanges = false;

		const compare = (prev, curr, path = "") => {
			if (prev === curr) return;

			if (
				typeof prev !== typeof curr ||
				Array.isArray(prev) !== Array.isArray(curr)
			) {
				delta[path || "root"] = curr;
				hasChanges = true;
				return;
			}

			if (typeof curr === "object" && curr !== null) {
				const allKeys = new Set([
					...Object.keys(prev || {}),
					...Object.keys(curr || {}),
				]);

				for (const key of allKeys) {
					const newPath = path ? `${path}.${key}` : key;
					compare(prev?.[key], curr[key], newPath);
				}
			} else {
				delta[path] = curr;
				hasChanges = true;
			}
		};

		compare(prevSnapshot?.state, currentState);
		return hasChanges ? delta : null;
	}
}
```

## 三、性能优化与渲染策略

### 4. **面试题：React 的渲染优化中，如何正确使用 useMemo、useCallback 和 React.memo？请提供具体的性能分析策略**

**深度解析与最佳实践：**

```javascript
// 性能分析工具
class RenderProfiler {
	constructor() {
		this.metrics = new Map();
		this.renderCounts = new Map();
		this.startTime = null;
	}

	// 开始分析组件
	startProfiling(componentName) {
		const key = `${componentName}_${Date.now()}`;
		this.startTime = performance.now();
		this.currentComponent = componentName;

		return {
			key,
			stop: () => this.stopProfiling(key, componentName),
		};
	}

	stopProfiling(key, componentName) {
		const duration = performance.now() - this.startTime;

		// 记录渲染次数
		const count = this.renderCounts.get(componentName) || 0;
		this.renderCounts.set(componentName, count + 1);

		// 记录性能指标
		if (!this.metrics.has(componentName)) {
			this.metrics.set(componentName, {
				totalTime: 0,
				renderCount: 0,
				averageTime: 0,
				maxTime: 0,
				minTime: Infinity,
			});
		}

		const metric = this.metrics.get(componentName);
		metric.totalTime += duration;
		metric.renderCount++;
		metric.averageTime = metric.totalTime / metric.renderCount;
		metric.maxTime = Math.max(metric.maxTime, duration);
		metric.minTime = Math.min(metric.minTime, duration);

		// 性能警告
		if (duration > 16) {
			// 超过一帧的时间
			console.warn(`⚠️ 慢渲染: ${componentName} 耗时 ${duration.toFixed(2)}ms`);
			this.suggestOptimizations(componentName, duration);
		}
	}

	suggestOptimizations(componentName, duration) {
		const suggestions = {
			ExpensiveCalculator: [
				"使用 useMemo 缓存计算结果",
				"考虑将计算移到 useEffect 中",
				"检查依赖数组是否包含所有必要依赖",
			],
			FrequentRenderer: [
				"使用 React.memo 包装组件",
				"检查 props 是否稳定",
				"考虑使用 useCallback 包装事件处理函数",
			],
			LargeListRenderer: [
				"实现虚拟滚动",
				"使用分页或无限滚动",
				"考虑使用 Web Worker 处理数据",
			],
		};

		const componentSuggestions = suggestions[componentName] || [
			"检查组件是否进行了不必要的重渲染",
			"使用 React DevTools Profiler 分析",
			"考虑拆分组件为更小的单元",
		];

		console.log(`💡 ${componentName} 优化建议:`, componentSuggestions);
	}

	// 生成性能报告
	generateReport() {
		const report = {
			summary: {
				totalComponents: this.metrics.size,
				totalRenderTime: 0,
				averageRenderTime: 0,
			},
			components: [],
		};

		for (const [name, metric] of this.metrics) {
			report.summary.totalRenderTime += metric.totalTime;

			report.components.push({
				name,
				renderCount: metric.renderCount,
				totalTime: metric.totalTime.toFixed(2),
				averageTime: metric.averageTime.toFixed(2),
				maxTime: metric.maxTime.toFixed(2),
				minTime: metric.minTime.toFixed(2),
				efficiency: ((metric.averageTime / 16) * 100).toFixed(1) + "%", // 相对于16ms帧时间的效率
			});
		}

		report.summary.averageRenderTime =
			report.summary.totalRenderTime / report.components.length;

		return report;
	}
}

// 正确的优化模式
function OptimizedComponent({ data, onAction }) {
	const profiler = useRef(new RenderProfiler());

	// 1. useMemo: 缓存昂贵的计算结果
	const processedData = useMemo(() => {
		const profile = profiler.current.startProfiling("processData");
		const result = expensiveProcessing(data);
		profile.stop();
		return result;
	}, [data]); // ✅ 正确：依赖 data

	// 2. useCallback: 稳定函数引用
	const handleAction = useCallback(
		(action) => {
			const profile = profiler.current.startProfiling("handleAction");
			onAction(action);
			profile.stop();
		},
		[onAction]
	); // ✅ 正确：依赖 onAction

	// 3. 避免在渲染中创建新对象/数组
	const config = useMemo(
		() => ({
			threshold: 0.5,
			maxItems: 100,
			enabled: true,
		}),
		[]
	); // ✅ 正确：空依赖，只创建一次

	// 4. 条件性渲染优化
	const shouldRenderDetail = useMemo(() => {
		return data.length > 0 && data.some((item) => item.important);
	}, [data]);

	return (
		<div>
			{shouldRenderDetail && (
				<ExpensiveDetailComponent
					data={processedData}
					onAction={handleAction}
					config={config}
				/>
			)}
		</div>
	);
}

// React.memo 的正确使用
const ExpensiveDetailComponent = React.memo(
	function ExpensiveDetailComponent({ data, onAction, config }) {
		const renderCount = useRef(0);
		renderCount.current++;

		// 自定义比较函数（谨慎使用）
		const areEqual = (prevProps, nextProps) => {
			// 浅比较通常足够
			if (prevProps.data !== nextProps.data) return false;
			if (prevProps.onAction !== nextProps.onAction) return false;
			if (prevProps.config !== nextProps.config) return false;
			return true;
		};

		return (
			<div>
				<p>渲染次数: {renderCount.current}</p>
				{/* 组件内容 */}
			</div>
		);
	},
	areEqual // 可选的自定义比较函数
);

// 常见的优化陷阱
function OptimizationPitfalls() {
	// ❌ 错误：useMemo 依赖不完整
	const [count, setCount] = useState(0);
	const [items, setItems] = useState([]);

	const filteredItems = useMemo(() => {
		return items.filter((item) => item.value > count);
	}, [items]); // ❌ 缺少 count 依赖

	// ❌ 错误：useCallback 创建了不必要的闭包
	const handleClick = useCallback(() => {
		console.log(count); // 闭包陷阱：总是打印初始值
	}, []); // ❌ 缺少 count 依赖

	// ✅ 正确：使用函数式更新避免闭包
	const handleIncrement = useCallback(() => {
		setCount((prev) => prev + 1); // 不依赖外部 count
	}, []);

	// ❌ 错误：React.memo 用于简单组件
	const SimpleButton = React.memo(({ onClick, children }) => (
		<button onClick={onClick}>{children}</button>
	)); // ❌ 过度优化：简单组件不需要 memo

	return (
		<div>
			<button onClick={() => setCount((c) => c + 1)}>计数: {count}</button>
		</div>
	);
}

// 性能监控 Hook
function useRenderMetrics(componentName) {
	const [metrics, setMetrics] = useState({
		renderCount: 0,
		lastRenderTime: 0,
		averageRenderTime: 0,
	});

	const renderStartTime = useRef(0);

	useEffect(() => {
		renderStartTime.current = performance.now();

		return () => {
			const renderTime = performance.now() - renderStartTime.current;

			setMetrics((prev) => ({
				renderCount: prev.renderCount + 1,
				lastRenderTime: renderTime,
				averageRenderTime:
					(prev.averageRenderTime * prev.renderCount + renderTime) /
					(prev.renderCount + 1),
			}));

			// 性能警告
			if (renderTime > 16) {
				console.warn(`[${componentName}] 慢渲染: ${renderTime.toFixed(2)}ms`);
			}
		};
	});

	return metrics;
}

// 自动优化建议组件
function OptimizationAdvisor({ componentName, props }) {
	const metrics = useRenderMetrics(componentName);
	const prevProps = useRef(props);

	useEffect(() => {
		const changes = detectPropChanges(prevProps.current, props);

		if (changes.length > 0 && metrics.renderCount > 10) {
			const advice = generateOptimizationAdvice(
				componentName,
				changes,
				metrics
			);

			if (advice) {
				console.log(`💡 ${componentName} 优化建议:`, advice);
			}
		}

		prevProps.current = props;
	}, [props, metrics]);

	return null; // 这是一个无渲染组件
}

// 检测属性变化
function detectPropChanges(prevProps, nextProps) {
	const changes = [];

	const compare = (prev, next, path = "") => {
		if (prev === next) return;

		if (typeof prev !== typeof next) {
			changes.push({
				path: path || "root",
				type: "type",
				from: typeof prev,
				to: typeof next,
			});
			return;
		}

		if (typeof next === "object" && next !== null) {
			const allKeys = new Set([
				...Object.keys(prev || {}),
				...Object.keys(next || {}),
			]);

			for (const key of allKeys) {
				const newPath = path ? `${path}.${key}` : key;
				compare(prev?.[key], next[key], newPath);
			}
		} else {
			changes.push({
				path: path,
				type: "value",
				from: prev,
				to: next,
			});
		}
	};

	compare(prevProps, nextProps);
	return changes;
}

// 生成优化建议
function generateOptimizationAdvice(componentName, changes, metrics) {
	const advice = [];

	// 基于渲染次数的建议
	if (metrics.renderCount > 50 && metrics.averageRenderTime > 10) {
		advice.push("组件渲染过于频繁，考虑使用 React.memo");
	}

	// 基于属性变化的建议
	const objectProps = changes.filter((c) => c.type === "object");
	if (objectProps.length > 0) {
		advice.push("对象属性频繁变化，考虑使用 useMemo 稳定引用");
	}

	// 基于函数属性的建议
	const functionProps = changes.filter(
		(c) => c.type === "value" && typeof c.from === "function"
	);
	if (functionProps.length > 0) {
		advice.push("函数属性频繁变化，考虑使用 useCallback");
	}

	return advice.length > 0 ? advice : null;
}
```

## 四、高级模式与架构设计

### 5. **面试题：设计一个支持插件化的 React 应用架构，如何实现动态加载、热插拔和沙箱隔离？**

**插件化架构实现：**

````javascript
// 插件管理器
class PluginManager {
	constructor() {
		this.plugins = new Map();
		this.sandboxes = new Map();
		this.eventBus = new EventEmitter();
		this.hooks = new Map();
	}

	// 注册插件
	async registerPlugin(pluginConfig) {
		const {
			id,
			name,
			version,
			entry,
			permissions = [],
			sandbox = true,
		} = pluginConfig;

		// 1. 加载插件代码
		const pluginCode = await this.loadPluginCode(entry);

		// 2. 创建沙箱环境
		let sandboxEnv;
		if (sandbox) {
			sandboxEnv = this.createSandbox(id, permissions);
		} else {
			sandboxEnv = window; // 信任插件，直接使用全局环境
		}

		// 3. 执行插件初始化
		const plugin = this.executePlugin(pluginCode, sandboxEnv, pluginConfig);

		// 4. 注册到系统
		this.plugins.set(id, {
			...plugin,
			config: pluginConfig,
			sandbox: sandboxEnv,
			status: "loaded",
		});

		// 5. 触发插件加载事件
		this.eventBus.emit("plugin:loaded", { id, plugin });

		return plugin;
	}

	// 创建沙箱环境
	createSandbox(pluginId, permissions) {
		const iframe = document.createElement("iframe");
		iframe.style.display = "none";
		document.body.appendChild(iframe);

		const sandbox = iframe.contentWindow;

		// 限制访问权限
		const restrictedApis = this.createRestrictedApis(sandbox, permissions);

		// 注入 React 和必要的 API
		this.injectReact(sandbox);

		this.sandboxes.set(pluginId, {
			iframe,
			window: sandbox,
			apis: restrictedApis,
		});

		return sandbox;
	}

	// 创建受限 API
	createRestrictedApis(sandbox, permissions) {
		const apis = {
			// 基础 API（所有插件都有）
			console: {
				log: (...args) => console.log(`[Plugin]`, ...args),
				error: (...args) => console.error(`[Plugin]`, ...args),
			},
			setTimeout: sandbox.setTimeout.bind(sandbox),
			clearTimeout: sandbox.clearTimeout.bind(sandbox),
		};

		// 根据权限添加 API
		if (permissions.includes("storage")) {
			apis.localStorage = this.createProxyStorage("local");
		}

		if (permissions.includes("network")) {
			apis.fetch = this.createProxyFetch();
		}

		if (permissions.includes("ui")) {
			apis.ReactDOM = {
				createPortal: (children, container) => {
					return window.ReactDOM.createPortal(children, container);
				},
			};
		}

		return apis;
	}

	// 执行插件代码
	executePlugin(code, sandbox, config) {
		// 创建执行上下文
		const context = {
			React: sandbox.React,
			ReactDOM: sandbox.ReactDOM,
			plugin: {
				id: config.id,
				name: config.name,
				version: config.version,
				config: config.config || {},
			},
			api: {
				registerComponent: this.registerComponent.bind(this, config.id),
				registerHook: this.registerHook.bind(this, config.id),
				emitEvent: this.emitEvent.bind(this, config.id),
				subscribeEvent: this.subscribeEvent.bind(this, config.id),
			},
		};

		// 执行插件
		const pluginFactory = new sandbox.Function(
			"context",
			`with(context) { ${code} }`
		);

		return pluginFactory.call(sandbox, context);
	}

	// 注册插件组件
	registerComponent(pluginId, componentName, component) {
		const key = `${pluginId}:${componentName}`;

		// 创建包装组件，添加错误边界和生命周期
		const WrappedComponent = (props) => {
			const [error, setError] = useState(null);

			if (error) {
				return (
					<div className="plugin-error">
						<h4>插件组件错误</h4>
						```javascript
						<p>{error.message}</p>
						<button onClick={() => setError(null)}>重试</button>
					</div>
				);
			}

			return (
				<ErrorBoundary onError={setError}>
					{React.createElement(component, props)}
				</ErrorBoundary>
			);
		};

		// 添加显示名称便于调试
		WrappedComponent.displayName = `PluginComponent(${key})`;

		// 存储组件
		this.components.set(key, WrappedComponent);

		// 通知系统组件已注册
		this.eventBus.emit("component:registered", {
			key,
			component: WrappedComponent,
		});

		return key;
	}

	// 注册插件钩子
	registerHook(pluginId, hookName, hookFunction) {
		const key = `${pluginId}:${hookName}`;

		if (!this.hooks.has(hookName)) {
			this.hooks.set(hookName, []);
		}

		const hooks = this.hooks.get(hookName);
		hooks.push({
			pluginId,
			function: hookFunction,
			priority: 10, // 默认优先级
		});

		// 按优先级排序
		hooks.sort((a, b) => b.priority - a.priority);

		this.eventBus.emit("hook:registered", { key, hookName });
	}

	// 执行钩子
	async executeHook(hookName, ...args) {
		if (!this.hooks.has(hookName)) {
			return args[0]; // 返回第一个参数作为默认值
		}

		const hooks = this.hooks.get(hookName);
		let result = args[0];

		// 顺序执行钩子
		for (const hook of hooks) {
			try {
				result = await hook.function(result, ...args.slice(1));
			} catch (error) {
				console.error(`钩子执行失败: ${hookName} from ${hook.pluginId}`, error);
				// 继续执行下一个钩子
			}
		}

		return result;
	}

	// 插件间通信
	emitEvent(pluginId, eventName, data) {
		const fullEventName = `plugin:${pluginId}:${eventName}`;
		this.eventBus.emit(fullEventName, data);
	}

	subscribeEvent(pluginId, eventName, callback) {
		const fullEventName = `plugin:${pluginId}:${eventName}`;
		return this.eventBus.on(fullEventName, callback);
	}

	// 动态加载插件
	async loadPluginCode(entry) {
		// 支持多种加载方式
		if (entry.startsWith("http")) {
			const response = await fetch(entry);
			return await response.text();
		} else if (entry.startsWith("data:")) {
			// Base64 编码的插件
			const base64 = entry.split(",")[1];
			return atob(base64);
		} else {
			// 模块加载
			const module = await import(entry);
			return module.default || module;
		}
	}

	// 热重载插件
	async hotReloadPlugin(pluginId) {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) {
			throw new Error(`插件不存在: ${pluginId}`);
		}

		// 1. 通知插件即将重载
		this.eventBus.emit("plugin:before-reload", { id: pluginId });

		// 2. 清理旧插件
		await this.unloadPlugin(pluginId);

		// 3. 重新加载
		const newPlugin = await this.registerPlugin(plugin.config);

		// 4. 通知重载完成
		this.eventBus.emit("plugin:reloaded", {
			id: pluginId,
			oldPlugin: plugin,
			newPlugin,
		});

		return newPlugin;
	}

	// 卸载插件
	async unloadPlugin(pluginId) {
		const plugin = this.plugins.get(pluginId);
		if (!plugin) return;

		// 1. 调用插件的清理函数
		if (typeof plugin.cleanup === "function") {
			try {
				await plugin.cleanup();
			} catch (error) {
				console.error(`插件清理失败: ${pluginId}`, error);
			}
		}

		// 2. 清理组件
		const componentKeys = Array.from(this.components.keys()).filter((key) =>
			key.startsWith(`${pluginId}:`)
		);

		componentKeys.forEach((key) => {
			this.components.delete(key);
			this.eventBus.emit("component:unregistered", { key });
		});

		// 3. 清理钩子
		for (const [hookName, hooks] of this.hooks) {
			const filteredHooks = hooks.filter((hook) => hook.pluginId !== pluginId);
			if (filteredHooks.length === 0) {
				this.hooks.delete(hookName);
			} else {
				this.hooks.set(hookName, filteredHooks);
			}
		}

		// 4. 清理沙箱
		if (plugin.sandbox && plugin.sandbox !== window) {
			const sandbox = this.sandboxes.get(pluginId);
			if (sandbox && sandbox.iframe) {
				document.body.removeChild(sandbox.iframe);
			}
			this.sandboxes.delete(pluginId);
		}

		// 5. 从插件列表中移除
		this.plugins.delete(pluginId);

		// 6. 通知插件已卸载
		this.eventBus.emit("plugin:unloaded", { id: pluginId });
	}
}

// 插件系统 React 集成
const PluginSystemContext = React.createContext();

function PluginSystemProvider({ children, config }) {
	const [pluginManager] = useState(() => new PluginManager());
	const [plugins, setPlugins] = useState({});
	const [components, setComponents] = useState(new Map());

	// 初始化插件系统
	useEffect(() => {
		// 监听组件注册
		const handleComponentRegistered = ({ key, component }) => {
			setComponents((prev) => new Map(prev).set(key, component));
		};

		const handleComponentUnregistered = ({ key }) => {
			setComponents((prev) => {
				const next = new Map(prev);
				next.delete(key);
				return next;
			});
		};

		pluginManager.eventBus.on(
			"component:registered",
			handleComponentRegistered
		);
		pluginManager.eventBus.on(
			"component:unregistered",
			handleComponentUnregistered
		);

		// 加载初始插件
		const loadInitialPlugins = async () => {
			for (const pluginConfig of config.plugins || []) {
				try {
					await pluginManager.registerPlugin(pluginConfig);
				} catch (error) {
					console.error(`加载插件失败: ${pluginConfig.id}`, error);
				}
			}
		};

		loadInitialPlugins();

		return () => {
			pluginManager.eventBus.off(
				"component:registered",
				handleComponentRegistered
			);
			pluginManager.eventBus.off(
				"component:unregistered",
				handleComponentUnregistered
			);
		};
	}, [pluginManager, config]);

	// 渲染插件组件
	const renderPluginComponent = (pluginKey, props = {}) => {
		const Component = components.get(pluginKey);
		if (!Component) {
			return <div>组件未找到: {pluginKey}</div>;
		}

		return <Component {...props} />;
	};

	// 执行插件钩子
	const executePluginHook = useCallback(
		(hookName, ...args) => {
			return pluginManager.executeHook(hookName, ...args);
		},
		[pluginManager]
	);

	const value = {
		pluginManager,
		plugins,
		components,
		renderPluginComponent,
		executePluginHook,
		registerPlugin: pluginManager.registerPlugin.bind(pluginManager),
		unloadPlugin: pluginManager.unloadPlugin.bind(pluginManager),
		hotReloadPlugin: pluginManager.hotReloadPlugin.bind(pluginManager),
	};

	return (
		<PluginSystemContext.Provider value={value}>
			{children}
			<PluginDevTools />
		</PluginSystemContext.Provider>
	);
}

// 插件开发工具
function PluginDevTools() {
	const { pluginManager, plugins, components } =
		useContext(PluginSystemContext);
	const [activeTab, setActiveTab] = useState("plugins");
	const [isVisible, setIsVisible] = useState(false);

	if (!isVisible) {
		return (
			<button
				className="plugin-devtools-toggle"
				onClick={() => setIsVisible(true)}
			>
				🔌
			</button>
		);
	}

	return (
		<div className="plugin-devtools">
			<div className="devtools-header">
				<h3>插件开发工具</h3>
				<button onClick={() => setIsVisible(false)}>×</button>
			</div>

			<div className="devtools-tabs">
				<button
					className={activeTab === "plugins" ? "active" : ""}
					onClick={() => setActiveTab("plugins")}
				>
					插件
				</button>
				<button
					className={activeTab === "components" ? "active" : ""}
					onClick={() => setActiveTab("components")}
				>
					组件
				</button>
				<button
					className={activeTab === "hooks" ? "active" : ""}
					onClick={() => setActiveTab("hooks")}
				>
					钩子
				</button>
				<button
					className={activeTab === "sandbox" ? "active" : ""}
					onClick={() => setActiveTab("sandbox")}
				>
					沙箱
				</button>
			</div>

			<div className="devtools-content">
				{activeTab === "plugins" && (
					<div className="plugins-list">
						<h4>已加载插件 ({Object.keys(plugins).length})</h4>
						{Array.from(pluginManager.plugins.values()).map((plugin) => (
							<div key={plugin.config.id} className="plugin-item">
								<div className="plugin-header">
									<strong>{plugin.config.name}</strong>
									<span className="plugin-version">
										v{plugin.config.version}
									</span>
									<span className={`plugin-status ${plugin.status}`}>
										{plugin.status}
									</span>
								</div>
								<div className="plugin-actions">
									<button
										onClick={() =>
											pluginManager.hotReloadPlugin(plugin.config.id)
										}
									>
										热重载
									</button>
									<button
										onClick={() => pluginManager.unloadPlugin(plugin.config.id)}
									>
										卸载
									</button>
								</div>
							</div>
						))}
					</div>
				)}

				{activeTab === "components" && (
					<div className="components-list">
						<h4>插件组件 ({components.size})</h4>
						{Array.from(components.entries()).map(([key, Component]) => (
							<div key={key} className="component-item">
								<div className="component-name">{key}</div>
								<div className="component-preview">
									<Component />
								</div>
							</div>
						))}
					</div>
				)}

				{activeTab === "hooks" && (
					<div className="hooks-list">
						<h4>插件钩子</h4>
						{Array.from(pluginManager.hooks.entries()).map(
							([hookName, hooks]) => (
								<div key={hookName} className="hook-item">
									<div className="hook-name">{hookName}</div>
									<div className="hook-plugins">
										{hooks.map((hook, index) => (
											<span key={index} className="hook-plugin">
												{hook.pluginId} (优先级: {hook.priority})
											</span>
										))}
									</div>
								</div>
							)
						)}
					</div>
				)}

				{activeTab === "sandbox" && (
					<div className="sandbox-list">
						<h4>沙箱环境</h4>
						{Array.from(pluginManager.sandboxes.entries()).map(
							([pluginId, sandbox]) => (
								<div key={pluginId} className="sandbox-item">
									<div className="sandbox-plugin">{pluginId}</div>
									<div className="sandbox-info">
										<div>iframe: {sandbox.iframe ? "已创建" : "无"}</div>
										<div>
											API 数量: {Object.keys(sandbox.apis || {}).length}
										</div>
									</div>
								</div>
							)
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// 插件示例
const examplePlugin = `
// 插件定义
const MyPlugin = {
  // 插件初始化
  initialize(context) {
    const { React, plugin, api } = context;
    
    console.log(\`插件 \${plugin.name} 初始化\`);
    
    // 注册组件
    const MyComponent = (props) => {
      const [count, setCount] = React.useState(0);
      
      return React.createElement('div', {
        className: 'my-plugin-component'
      }, 
        React.createElement('h3', null, \`\${plugin.name} - \${props.title}\`),
        React.createElement('p', null, \`计数: \${count}\`),
        React.createElement('button', {
          onClick: () => setCount(c => c + 1)
        }, '增加')
      );
    };
    
    api.registerComponent('MyComponent', MyComponent);
    
    // 注册钩子
    api.registerHook('content:filter', (content) => {
      // 修改内容
      return content.replace(/test/gi, '***');
    });
    
    // 订阅事件
    api.subscribeEvent('other-plugin', 'data-updated', (data) => {
      console.log('收到其他插件的数据:', data);
    });
    
    // 返回插件实例
    return {
      version: plugin.version,
      // 清理函数
      cleanup() {
        console.log(\`插件 \${plugin.name} 清理\`);
      }
    };
  }
};

// 导出插件
return MyPlugin.initialize(context);
`;

// 使用插件系统
function AppWithPlugins() {
	const { renderPluginComponent, executePluginHook } =
		useContext(PluginSystemContext);
	const [content, setContent] = useState("这是一个测试内容");

	// 使用插件钩子过滤内容
	const filteredContent = executePluginHook("content:filter", content);

	return (
		<div className="app">
			<header>
				<h1>插件化应用</h1>
			</header>

			<main>
				<section className="plugin-components">
					<h2>插件组件</h2>
					<div className="components-grid">
						{renderPluginComponent("my-plugin:MyComponent", {
							title: "示例组件",
						})}
					</div>
				</section>

				<section className="content-section">
					<h2>内容处理</h2>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						rows={4}
					/>
					<div className="filtered-content">
						<h3>处理后内容:</h3>
						<p>{filteredContent}</p>
					</div>
				</section>
			</main>
		</div>
	);
}

// 主应用入口
function MainApp() {
	const pluginConfig = {
		plugins: [
			{
				id: "my-plugin",
				name: "我的插件",
				version: "1.0.0",
				entry: "data:text/javascript;base64," + btoa(examplePlugin),
				permissions: ["ui", "storage"],
				sandbox: true,
			},
		],
	};

	return (
		<PluginSystemProvider config={pluginConfig}>
			<AppWithPlugins />
		</PluginSystemProvider>
	);
}
````

## 五、错误处理与监控

### 6. **面试题：设计一个完整的 React 应用错误监控系统，包括错误捕获、上报、分析和恢复**

**完整的错误监控系统：**

```javascript
class ErrorMonitoringSystem {
	constructor(config = {}) {
		this.config = {
			dsn: "", // 数据源名称
			environment: process.env.NODE_ENV,
			release: process.env.REACT_APP_VERSION,
			sampleRate: 1.0, // 采样率
			maxBreadcrumbs: 100,
			...config,
		};

		// 错误队列
		this.queue = [];
		this.isSending = false;

		// 面包屑（用户操作轨迹）
		this.breadcrumbs = [];

		// 上下文信息
		this.context = {
			user: null,
			tags: {},
			extra: {},
		};

		// 初始化
		this.init();
	}

	init() {
		// 捕获全局错误
		window.addEventListener("error", this.captureError.bind(this));
		window.addEventListener(
			"unhandledrejection",
			this.capturePromiseError.bind(this)
		);

		// 捕获 React 错误
		if (typeof ErrorUtils !== "undefined") {
			ErrorUtils.setGlobalHandler(this.captureReactError.bind(this));
		}

		// 监听路由变化
		this.setupRouterListener();

		// 监听网络请求
		this.setupNetworkMonitor();

		// 监听用户交互
		this.setupUserInteractionMonitor();

		// 定期发送错误报告
		this.setupFlushInterval();
	}

	// 捕获错误
	captureError(event) {
		const error = event.error || new Error(event.message);

		const errorEvent = {
			type: "error",
			error: {
				name: error.name,
				message: error.message,
				stack: this.enhanceStackTrace(error.stack),
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
			},
			timestamp: Date.now(),
			breadcrumbs: [...this.breadcrumbs],
			context: { ...this.context },
			url: window.location.href,
			userAgent: navigator.userAgent,
		};

		this.addToQueue(errorEvent);
		this.addBreadcrumb("error", error.message);

		// 是否阻止默认行为
		if (this.config.beforeSend?.(errorEvent) === false) {
			event.preventDefault();
		}
	}

	// 捕获 Promise 错误
	capturePromiseError(event) {
		const error = event.reason;

		const errorEvent = {
			type: "unhandledrejection",
			error: {
				name: error?.name || "UnhandledRejection",
				message: error?.message || String(event.reason),
				stack: error?.stack ? this.enhanceStackTrace(error.stack) : undefined,
			},
			timestamp: Date.now(),
			breadcrumbs: [...this.breadcrumbs],
			context: { ...this.context },
		};

		this.addToQueue(errorEvent);
		this.addBreadcrumb(
			"error",
			`Unhandled Rejection: ${errorEvent.error.message}`
		);
	}

	// 捕获 React 错误
	captureReactError(error, isFatal) {
		const errorEvent = {
			type: "react",
			error: {
				name: error.name,
				message: error.message,
				stack: this.enhanceStackTrace(error.stack),
				componentStack: this.getReactComponentStack(error),
			},
			isFatal,
			timestamp: Date.now(),
			breadcrumbs: [...this.breadcrumbs],
			context: { ...this.context },
		};

		this.addToQueue(errorEvent);
		this.addBreadcrumb("error", `React Error: ${error.message}`);

		// 如果是致命错误，立即发送
		if (isFatal) {
			this.flush();
		}
	}

	// 增强堆栈跟踪
	enhanceStackTrace(stack) {
		if (!stack) return "";

		// 1. 源映射支持
		if (this.config.sourceMap) {
			stack = this.applySourceMaps(stack);
		}

		// 2. 去混淆
		if (this.config.deobfuscate) {
			stack = this.deobfuscateStack(stack);
		}

		// 3. 限制长度
		return stack.slice(0, 10000);
	}

	// 获取 React 组件堆栈
	getReactComponentStack(error) {
		// 从错误边界获取组件堆栈
		if (error.componentStack) {
			return error.componentStack;
		}

		// 从开发模式获取
		if (process.env.NODE_ENV === "development") {
			return this.captureReactComponentStack();
		}

		return "";
	}

	// 添加面包屑
	addBreadcrumb(category, message, data = {}) {
		const breadcrumb = {
			category,
			message,
			data,
			timestamp: Date.now(),
			level: category === "error" ? "error" : "info",
		};

		this.breadcrumbs.push(breadcrumb);

		// 限制数量
		if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
			this.breadcrumbs.shift();
		}
	}

	// 设置用户上下文
	setUser(user) {
		this.context.user = user;
	}

	// 设置标签
	setTag(key, value) {
		this.context.tags[key] = value;
	}

	// 设置额外信息
	setExtra(key, value) {
		this.context.extra[key] = value;
	}

	// 添加到队列
	addToQueue(errorEvent) {
		// 采样
		if (Math.random() > this.config.sampleRate) {
			return;
		}

		this.queue.push(errorEvent);

		// 如果队列过长，立即发送
		if (this.queue.length >= 10) {
			this.flush();
		}
	}

	// 发送错误报告
	async flush() {
		if (this.isSending || this.queue.length === 0) {
			return;
		}

		this.isSending = true;

		try {
			const batch = this.queue.splice(0, 10);

			// 发送到服务器
			await this.sendToServer(batch);

			// 清空已发送的面包屑
			this.breadcrumbs = [];
		} catch (error) {
			console.error("发送错误报告失败:", error);
			// 重新加入队列
			this.queue.unshift(...batch);
		} finally {
			this.isSending = false;
		}
	}

	// 发送到服务器
	async sendToServer(batch) {
		const payload = {
			dsn: this.config.dsn,
			events: batch,
			sdk: {
				name: "react-error-monitor",
				version: "1.0.0",
			},
		};

		const response = await fetch(
			this.config.endpoint || "https://errors.example.com/api/store",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			}
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
	}

	// 设置路由监听
	setupRouterListener() {
		// 监听 history 变化
		const originalPushState = history.pushState;
		const originalReplaceState = history.replaceState;

		history.pushState = (...args) => {
			this.addBreadcrumb("navigation", "pushState", { url: args[2] });
			return originalPushState.apply(history, args);
		};

		history.replaceState = (...args) => {
			this.addBreadcrumb("navigation", "replaceState", { url: args[2] });
			return originalReplaceState.apply(history, args);
		};

		// 监听 popstate
		window.addEventListener("popstate", () => {
			this.addBreadcrumb("navigation", "popstate", {
				url: window.location.href,
			});
		});
	}

	// 设置网络监控
	setupNetworkMonitor() {
		const originalFetch = window.fetch;

		window.fetch = async (...args) => {
			const startTime = Date.now();
			const [input, init] = args;

			try {
				const response = await originalFetch(...args);

				this.addBreadcrumb("fetch", "success", {
					url: typeof input === "string" ? input : input.url,
					method: init?.method || "GET",
					status: response.status,
					duration: Date.now() - startTime,
				});

				return response;
			} catch (error) {
				this.addBreadcrumb("fetch", "error", {
					url: typeof input === "string" ? input : input.url,
					method: init?.method || "GET",
					error: error.message,
					duration: Date.now() - startTime,
				});

				throw error;
			}
		};
	}

	// 设置用户交互监控
	setupUserInteractionMonitor() {
		const interactiveElements = ["button", "a", "input", "select", "textarea"];

		document.addEventListener(
			"click",
			(event) => {
				const element = event.target;
				const tagName = element.tagName.toLowerCase();

				if (interactiveElements.includes(tagName)) {
					this.addBreadcrumb("ui.interaction", "click", {
						tagName,
						id: element.id,
						className: element.className,
						text: element.textContent?.slice(0, 100),
					});
				}
			},
			true
		);
	}

	// 设置定期刷新
	setupFlushInterval() {
		setInterval(() => this.flush(), 30000); // 每30秒发送一次
	}
}

// React 错误边界集成
class ErrorBoundaryWithMonitoring extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
		this.errorMonitor = props.errorMonitor || window.__ERROR_MONITOR__;
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		// 增强错误信息
		error.componentStack = errorInfo.componentStack;

		// 捕获错误
		if (this.errorMonitor) {
			this.errorMonitor.captureReactError(error, this.props.isFatal || false);
		}

		// 调用自定义错误处理
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="error-boundary">
					<h2>出错了</h2>
					<p>{this.state.error?.message}</p>
					<button onClick={() => this.setState({ hasError: false })}>
						重试
					</button>
					<button onClick={() => window.location.reload()}>刷新页面</button>
				</div>
			);
		}

		return this.props.children;
	}
}

// 错误监控 Hook
function useErrorMonitoring() {
	const [errorMonitor] = useState(() => {
		if (!window.__ERROR_MONITOR__) {
			window.__ERROR_MONITOR__ = new ErrorMonitoringSystem({
				dsn: process.env.REACT_APP_ERROR_DSN,
				environment: process.env.NODE_ENV,
				release: process.env.REACT_APP_VERSION,
			});
		}
		return window.__ERROR_MONITOR__;
	});

	// 设置用户信息
	const setUser = useCallback(
		(user) => {
			errorMonitor.setUser(user);
		},
		[errorMonitor]
	);

	// 手动捕获错误
	const captureError = useCallback(
		(error, context = {}) => {
			const enhancedError = {
				...error,
				...context,
			};
			errorMonitor.captureError({ error: enhancedError });
		},
		[errorMonitor]
	);

	// 添加面包屑
	const addBreadcrumb = useCallback(
		(category, message, data) => {
			errorMonitor.addBreadcrumb(category, message, data);
		},
		[errorMonitor]
	);

	return {
		errorMonitor,
		setUser,
		captureError,
		addBreadcrumb,
		setTag: errorMonitor.setTag.bind(errorMonitor),
		setExtra: errorMonitor.setExtra.bind(errorMonitor),
	};
}

// 错误分析面板
function ErrorAnalyticsDashboard() {
	const [errors, setErrors] = useState([]);
	const [stats, setStats] = useState({});
	const [selectedError, setSelectedError] = useState(null);

	useEffect(() => {
		// 从服务器获取错误数据
		const fetchErrors = async () => {
			try {
				const response = await fetch("/api/errors");
				const data = await response.json();
				setErrors(data.errors);
				setStats(data.stats);
			} catch (error) {
				console.error("获取错误数据失败:", error);
			}
		};

		fetchErrors();
		const interval = setInterval(fetchErrors, 60000); // 每分钟更新

		return () => clearInterval(interval);
	}, []);

	// 错误分组
	const groupedErrors = errors.reduce((groups, error) => {
		const key = `${error.error.name}:${error.error.message}`;
		if (!groups[key]) {
			groups[key] = {
				error,
				count: 0,
				users: new Set(),
				firstSeen: Infinity,
				lastSeen: 0,
			};
		}

		groups[key].count++;
		if (error.context.user?.id) {
			groups[key].users.add(error.context.user.id);
		}
		groups[key].firstSeen = Math.min(groups[key].firstSeen, error.timestamp);
		groups[key].lastSeen = Math.max(groups[key].lastSeen, error.timestamp);

		return groups;
	}, {});

	return (
		<div className="error-dashboard">
			<div className="dashboard-header">
				<h2>错误监控面板</h2>
				<div className="stats">
					<div className="stat">
						<span className="stat-value">{errors.length}</span>
						<span className="stat-label">总错误数</span>
					</div>
					<div className="stat">
						<span className="stat-value">
							{Object.keys(groupedErrors).length}
						</span>
						<span className="stat-label">错误类型</span>
					</div>
					<div className="stat">
						<span className="stat-value">{stats.affectedUsers || 0}</span>
						<span className="stat-label">影响用户</span>
					</div>
				</div>
			</div>

			<div className="dashboard-content">
				<div className="errors-list">
					<h3>错误列表</h3>
					{Object.entries(groupedErrors).map(([key, group]) => (
						<div
							key={key}
							className={`error-item ${
								selectedError?.key === key ? "selected" : ""
							}`}
							onClick={() => setSelectedError({ key, ...group })}
						>
							<div className="error-header">
								<span className="error-name">{group.error.error.name}</span>
								<span className="error-count">{group.count}次</span>
							</div>
							<div className="error-message">{group.error.error.message}</div>
							<div className="error-meta">
								<span>影响用户: {group.users.size}</span>
								<span>
									首次出现: {new Date(group.firstSeen).toLocaleString()}
								</span>
							</div>
						</div>
					))}
				</div>

				<div className="error-detail">
					{selectedError ? (
						<>
							<h3>错误详情</h3>
							<div className="detail-section">
								<h4>基本信息</h4>
								<pre>{JSON.stringify(selectedError.error, null, 2)}</pre>
							</div>

							<div className="detail-section">
								<h4>堆栈跟踪</h4>
								<pre className="stack-trace">
									{selectedError.error.error.stack}
								</pre>
							</div>

							<div className="detail-section">
								<h4>面包屑</h4>
								<div className="breadcrumbs">
									{selectedError.error.breadcrumbs.map((crumb, index) => (
										<div key={index} className="breadcrumb">
											<span className="breadcrumb-category">
												{crumb.category}
											</span>
											<span className="breadcrumb-message">
												{crumb.message}
											</span>
											<span className="breadcrumb-time">
												{new Date(crumb.timestamp).toLocaleTimeString()}
											</span>
										</div>
									))}
								</div>
							</div>

							<div className="detail-section">
								<h4>上下文信息</h4>
								<pre>
									{JSON.stringify(selectedError.error.context, null, 2)}
								</pre>
							</div>
						</>
					) : (
						<div className="no-selection">选择一个错误查看详情</div>
					)}
				</div>
			</div>
		</div>
	);
}

// 应用集成示例
function AppWithErrorMonitoring() {
	const { setUser, addBreadcrumb } = useErrorMonitoring();
	const [user, setUserState] = useState(null);

	// 模拟用户登录
	const handleLogin = useCallback(async () => {
		addBreadcrumb("auth", "用户登录开始");

		try {
			const userData = await login();
			setUserState(userData);
			setUser(userData);
			addBreadcrumb("auth", "用户登录成功", { userId: userData.id });
		} catch (error) {
			addBreadcrumb("auth", "用户登录失败", { error: error.message });
			throw error;
		}
	}, [setUser, addBreadcrumb]);

	return (
		<ErrorBoundaryWithMonitoring
			fallback={<ErrorFallback />}
			onError={(error) => {
				console.error("应用级错误:", error);
				// 可以在这里执行恢复逻辑
			}}
		>
			<div className="app">
				<header>
					<h1>错误监控示例应用</h1>
					{user && <div className="user-info">用户: {user.name}</div>}
				</header>

				<main>
					<button onClick={handleLogin}>模拟登录</button>

					<button
						onClick={() => {
							addBreadcrumb("test", "手动触发错误");
							throw new Error("测试错误");
						}}
					>
						触发测试错误
					</button>

					<ErrorAnalyticsDashboard />
				</main>
			</div>
		</ErrorBoundaryWithMonitoring>
	);
}

// 初始化错误监控
const errorMonitor = new ErrorMonitoringSystem({
	dsn: "https://your-dsn.example.com",
	environment: process.env.NODE_ENV,
	release: process.env.REACT_APP_VERSION,
	beforeSend: (event) => {
		// 过滤开发环境错误
		if (process.env.NODE_ENV === "development") {
			console.log("开发环境错误:", event);
			return false; // 不发送到服务器
		}
		return true;
	},
});

// 暴露给全局，方便调试
window.__ERROR_MONITOR__ = errorMonitor;
```

## 总结

以上内容涵盖了 React 2025-2026 面试中可能涉及的核心主题：

1. **并发渲染与 Fiber 架构** - 深入理解 React 的渲染机制
2. **状态管理新模式** - 时间旅行、响应式状态、插件化架构
3. **性能优化策略** - 渲染监控、自动优化建议、虚拟化
4. **错误处理与监控** - 完整的错误监控系统设计
5. **架构设计能力** - 插件化系统、微前端集成、PWA 优化

这些题目不仅考察 React 的基础知识，更注重候选人的**系统设计能力**、**性能优化思维**和**工程化实践**经验。掌握这些内容将帮助你在 2025-2026 年的 React 面试中脱颖而出。

祝面试成功！

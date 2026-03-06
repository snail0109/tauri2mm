import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MapView from "./components/MapView";
import SettingsPage from "./components/SettingsPage";
import { buildTerminalInfo, getCurrentGps } from "./lib/device";
import { emptyStore, fetchStore, saveStore } from "./lib/gitee";
import { defaultSettings, loadCachedStore, loadOrCreateTerminalId, loadSettings, saveCachedStore } from "./lib/storage";
import type { Gps, TerminalInfo, TerminalStatus, TerminalStore } from "./lib/types";

/**
 * 应用主组件 —— 多终端在线管理
 *
 * 核心数据流：
 * 1. 通过 Gitee Gist 作为远程存储，保存所有终端的状态信息（TerminalStore）
 * 2. 定时轮询（pullStore）拉取最新的终端列表，同时写入本地缓存
 * 3. 当前设备通过 join/exit 加入或退出在线列表，通过 heartbeat 定时续约保持在线
 * 4. 根据 last_update + onlineTimeoutMinutes 判断终端是否"计算在线"
 */
function App() {
  // ───────── 状态定义 ─────────

  /** 当前设备的唯一标识，首次启动时自动生成并持久化 */
  const [terminalId, setTerminalId] = useState<string | null>(null);
  /** 用户设置（Gitee 凭证、刷新频率、在线超时等），从本地存储加载 */
  const [settings, setSettings] = useState(() => loadSettings());

  /** 当前页面路由：主页 / 设置页 */
  const [page, setPage] = useState<"main" | "settings">("main");

  /** 远程终端数据仓库，优先从本地缓存恢复，否则初始化空仓库 */
  const [store, setStore] = useState<TerminalStore>(() => loadCachedStore() ?? emptyStore());
  /** 远程数据操作的错误信息，用于页面顶部横幅提示 */
  const [storeError, setStoreError] = useState<string | null>(null);
  /** 是否正在拉取远程数据，用于按钮 loading 状态 */
  const [storeLoading, setStoreLoading] = useState(false);

  /** 当前设备的本地在线状态（join 后变 online，exit 后变 offline） */
  const [localStatus, setLocalStatus] = useState<TerminalStatus>("offline");
  /** 最近一次同步成功的提示文案，如 "Synced at 14:30:00" */
  const [syncNote, setSyncNote] = useState<string | null>(null);

  /** 防抖标记：防止并发触发 pullStore */
  const refreshInFlight = useRef(false);
  /** 防抖标记：防止并发触发 heartbeat */
  const heartbeatInFlight = useRef(false);

  // ───────── 初始化：加载或生成终端 ID ─────────

  useEffect(() => {
    void loadOrCreateTerminalId().then(setTerminalId);
  }, []);

  // ───────── 派生数据 ─────────

  /**
   * Gitee Gist 配置对象，从 settings 中提取并 trim 处理
   * 当凭证变化时自动重新计算，供 fetchStore / saveStore 使用
   */
  const giteeCfg = useMemo(
    () => ({
      accessToken: (settings.giteeAccessToken || "").trim(),
      gistId: (settings.giteeGistId || "").trim(),
      fileName: (settings.gistFileName || "").trim() || defaultSettings.gistFileName,
    }),
    [settings.giteeAccessToken, settings.giteeGistId, settings.gistFileName],
  );

  /**
   * 计算所有终端的"在线/离线"状态
   * 逻辑：终端 status 为 "online" 且 last_update 距当前时间不超过 onlineTimeoutMinutes → 在线
   * 返回数组：[{ info: 终端原始数据, computedOnline: 是否计算在线 }]
   */
  const now = Date.now();
  const computedTerminals = useMemo(() => {
    // 计算所有终端的在线状态, 转换成毫秒计算
    const timeoutMs = settings.onlineTimeoutMinutes * 60_000;
    const list = Object.values(store.terminals ?? {});
    return list.map((t) => ({
      info: t,
      computedOnline: isComputedOnline(t, timeoutMs, now),
    }));
  }, [store, settings.onlineTimeoutMinutes, now]);

  /** 仅在线终端的原始 TerminalInfo 列表 */
  const onlineTerminals = useMemo(
    () => computedTerminals.filter((t) => t.computedOnline).map((t) => t.info),
    [computedTerminals],
  );
  /** 仅在线终端（保留 computedOnline 标记），用于终端卡片列表渲染 */
  const onlineComputedTerminals = useMemo(() => computedTerminals.filter((t) => t.computedOnline), [computedTerminals]);
  /** 是否存在任何终端数据（控制终端列表和地图区域的显隐） */
  const hasTerminalData = computedTerminals.length > 0;
  /** 在线且携带 GPS 坐标的终端，传给 MapView 组件在地图上打点 */
  const mapTerminals = useMemo(() => onlineTerminals.filter((t) => t.gps), [onlineTerminals]);

  // ───────── 远程数据操作方法 ─────────

  /**
   * 拉取远程仓库数据（只读）
   * - 使用 refreshInFlight 防止并发请求
   * - 拉取成功后同步到 state 和本地缓存
   * - 同时根据拉取到的数据刷新当前设备的 localStatus
   */
  async function pullStore() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setStoreLoading(true);
    setStoreError(null);
    try {
      const s = await fetchStore(giteeCfg);
      setStore(s);
      saveCachedStore(s);
      console.log("Pulled store:", s);
      // 同步当前设备的在线状态到 localStatus
      if (terminalId) {
        const me = s.terminals?.[terminalId];
        if (me) {
          const timeoutMs = settings.onlineTimeoutMinutes * 60_000;
          const online = isComputedOnline(me, timeoutMs, Date.now());
          setLocalStatus(online ? "online" : "offline");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch store";
      setStoreError(msg);
    } finally {
      setStoreLoading(false);
      refreshInFlight.current = false;
    }
  }

  /**
   * 合并写入远程仓库（读-改-写）
   * 流程：先 fetch 最新数据 → 应用 update 回调生成新数据 → save 回远程
   * 这种"先拉后写"模式可以避免覆盖其他终端刚写入的数据
   * @param update 接收最新 store，返回修改后的 store
   */
  async function withMergedStore(update: (s: TerminalStore) => TerminalStore) {
    setStoreError(null);
    try {
      const latest = await fetchStore(giteeCfg);
      const next = update(latest);
      await saveStore(giteeCfg, next);
      setStore(next);
      saveCachedStore(next);
      setSyncNote(`Synced at ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setStoreError(msg);
      setSyncNote(null);
    }
  }

  /**
   * 加入在线列表
   * 获取当前 GPS → 构建完整终端信息（含平台、型号、CPU、内存等）→ 合并写入远程
   */
  async function join() {
    if (!terminalId) return;
    const gps = await getCurrentGps(8000);
    const info = await buildTerminalInfo({
      terminalId,
      status: "online",
      gps,
    });
    await withMergedStore((s) => ({
      terminals: {
        ...(s.terminals ?? {}),
        [terminalId]: info,
      },
    }));
    setLocalStatus("online");
  }

  /**
   * 心跳续约：定时更新当前终端的 GPS 和 last_update
   * - 使用 heartbeatInFlight 防止并发
   * - 若远程已有该终端记录则增量更新，否则构建最小化记录写入
   */
  async function heartbeat() {
    if (!terminalId) return;
    if (heartbeatInFlight.current) return;
    heartbeatInFlight.current = true;
    try {
      const gps = await getCurrentGps(8000);
      const iso = new Date().toISOString();
      await withMergedStore((s) => {
        const existing = s.terminals?.[terminalId];
        const next: TerminalInfo = existing
          ? { ...existing, gps, status: "online", last_update: iso }
          : {
            terminal_id: terminalId,
            platform: "Unknown",
            device_model: "Unknown",
            cpu: "unknown",
            memory: "unknown",
            gps,
            status: "online",
            last_update: iso,
          };

        return { terminals: { ...(s.terminals ?? {}), [terminalId]: next } };
      });
      setLocalStatus("online");
    } finally {
      heartbeatInFlight.current = false;
    }
  }

  /**
   * 退出在线列表
   * 将当前终端的 status 设为 "offline" 并更新 last_update 时间戳
   */
  async function exit() {
    if (!terminalId) return;
    const iso = new Date().toISOString();
    await withMergedStore((s) => {
      const existing = s.terminals?.[terminalId];
      if (!existing) return s;
      return {
        terminals: {
          ...(s.terminals ?? {}),
          [terminalId]: { ...existing, status: "offline", last_update: iso },
        },
      };
    });
    setLocalStatus("offline");
  }

  // ───────── 定时任务 ─────────

  /**
   * 定时轮询远程数据
   * 启动时立即拉取一次，之后按 settings.refreshSeconds 间隔轮询
   * 依赖项变化（刷新频率或 Gitee 配置改变）时重新启动定时器
   */
  useEffect(() => {
    void pullStore();
    const t = window.setInterval(() => void pullStore(), settings.refreshSeconds * 1000);
    return () => window.clearInterval(t);
  }, [settings.refreshSeconds, giteeCfg.gistId, giteeCfg.fileName, giteeCfg.accessToken]);

  /**
   * 心跳定时器：仅在当前设备处于 online 状态时启动
   * 每 30 秒发送一次心跳，更新 GPS 和 last_update
   * 当设备退出或配置变化时清除定时器
   */
  useEffect(() => {
    if (localStatus !== "online") return;
    const t = window.setInterval(() => void heartbeat(), 30000);
    return () => window.clearInterval(t);
  }, [localStatus, giteeCfg.gistId, giteeCfg.fileName, giteeCfg.accessToken, terminalId]);

  // ───────── 页面渲染 ─────────

  /** 设置页：传入 onBack 回调，返回时可携带更新后的 settings */
  if (page === "settings") {
    return (
      <div className="app">
        <SettingsPage onBack={(newSettings) => {
          if (newSettings) setSettings(newSettings);
          setPage("main");
        }} />
      </div>
    );
  }

  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">多终端在线管理</div>
        </div>
        {/* 设置按钮（齿轮图标） */}
        <div className="settingsBtn" onClick={() => setPage("settings")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
      </header>

      <main className="content">
        {/* 顶部横幅：显示错误信息或同步成功提示 */}
        {(storeError || syncNote) && (
          <div className="banner">
            {storeError ? <span className="error">{storeError}</span> : <span className="muted">{syncNote}</span>}
          </div>
        )}

        <section className="grid">
          {/* 操作卡片：加入/退出按钮 + 当前状态 */}
          <div className="card">
            <div className="row">
              {/* 加入按钮：需要 terminalId 和 Gitee 配置就绪才可用 */}
              <button onClick={() => void join()} disabled={storeLoading || !terminalId || !settings.giteeAccessToken || !settings.giteeGistId}>
                加入（Join）
              </button>
              {/* 退出按钮：需要当前设备在线或远程存在该终端记录 */}
              <button onClick={() => void exit()} disabled={storeLoading || (localStatus !== "online" && !store.terminals[terminalId ?? ""])}>
                退出（Exit）
              </button>
            </div>
            {/* 当前设备在线状态指示（绿色pill=在线，灰色pill=离线） */}
            <div className="kv">
              <div className="k">当前状态</div>
              <div className="v">
                <span className={localStatus === "online" ? "pill ok" : "pill"}>{localStatus}</span>
              </div>
            </div>
          </div>

          {/* 以下区域仅在有终端数据时显示 */}
          {hasTerminalData && (
            <>
              {/* 在线终端卡片列表 */}
              <div className="card span2">
                <div className="row spread">
                  <h2>在线终端</h2>
                  <div className="row">
                    {/* 手动刷新按钮 */}
                    <button onClick={() => void pullStore()} disabled={storeLoading}>
                      {storeLoading ? "刷新中…" : "刷新"}
                    </button>
                  </div>
                </div>

                {/* 终端卡片视图：遍历在线终端，展示平台、型号、CPU、内存、GPS、最后更新时间 */}
                <div className="mobileCards">
                  {onlineComputedTerminals
                    .slice()
                    .map(({ info, computedOnline }) => (
                      <div key={info.terminal_id} className={computedOnline ? "terminalCard" : "terminalCard offline"}>
                        <div className="terminalHeader">
                          <div className="terminalPlatform">{info.platform}</div>
                          <span className={computedOnline ? "pill ok" : "pill"}>{computedOnline ? "online" : "offline"}</span>
                        </div>
                        <div className="terminalInfo">
                          <div className="terminalInfoLabel">型号:</div>
                          <div className="terminalInfoValue">{info.device_model}</div>
                          <div className="terminalInfoLabel">CPU:</div>
                          <div className="terminalInfoValue">{info.cpu}</div>
                          <div className="terminalInfoLabel">内存:</div>
                          <div className="terminalInfoValue">{info.memory}</div>
                          {info.gps && (
                            <>
                              <div className="terminalInfoLabel">GPS:</div>
                              <div className="terminalInfoValue">{formatGps(info.gps)}</div>
                            </>
                          )}
                          <div className="terminalInfoLabel">更新:</div>
                          <div className="terminalInfoValue">{safeLocalTime(info.last_update)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* 地图分布卡片：使用高德地图展示在线且有 GPS 的终端位置 */}
              <div className="card span2">
                <div className="row spread">
                  <h2>地图分布</h2>
                  <div className="muted">仅显示在线且有 GPS 的终端</div>
                </div>
                {mapTerminals.length > 0 && <MapView
                  terminals={mapTerminals}
                  amapKey={settings.amapKey}
                  amapSecurityCode={settings.amapSecurityCode}
                />
                }
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;

// ───────── 工具函数 ─────────

/**
 * 安全地将 ISO 时间字符串转为本地可读格式
 * 若解析失败则原样返回，避免显示 "Invalid Date"
 */
function safeLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/**
 * 判断终端是否"计算在线"
 * 条件：status 字段为 "online" 且 last_update 时间距离当前未超过 timeoutMs 毫秒
 * @param t         终端信息
 * @param timeoutMs 在线超时阈值（毫秒）
 * @param nowMs     当前时间戳（毫秒）
 */
function isComputedOnline(t: TerminalInfo, timeoutMs: number, nowMs: number): boolean {
  if (t.status !== "online") return false;
  const ts = Date.parse(t.last_update);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts <= timeoutMs;
}

/**
 * 格式化 GPS 坐标为 "纬度, 经度" 字符串，保留6位小数
 */
function formatGps(gps: Gps): string {
  if (!gps) return "-";
  return `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`;
}

export const CSS_STYLES = `
#vd-toggle { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; padding: 9px 14px; border-radius: 999px; border: 1px solid #334155; background: rgba(15,23,42,.58); color: #e2e8f0; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: .3px; cursor: pointer; box-shadow: 0 6px 16px rgba(15,23,42,.35); backdrop-filter: blur(10px); }
#vd-toggle:hover { background: rgba(30,41,59,.68); }
body.vd-on #vd-toggle { background: rgba(14,165,233,.66); border-color: #0284c7; color: #04283f; }
[data-vd-frame] { position: fixed; z-index: 2147482998; box-sizing: border-box; pointer-events: none; border: 1.5px solid #38bdf8; background: rgba(56,189,248,.08); }
[data-vd-layout-container] { position: fixed; z-index: 2147482996; display: none; box-sizing: border-box; pointer-events: none; border: 2px dashed rgba(251,191,36,.82); background: rgba(251,191,36,.08); }
[data-vd-selection-member] { position: fixed; z-index: 2147482997; display: none; box-sizing: border-box; pointer-events: none; border: 2px solid rgba(167,139,250,.88); background: rgba(167,139,250,.045); }
[data-vd-selection-member][data-vd-active] { z-index: 2147482998; border: 3px solid #22d3ee; background: rgba(34,211,238,.10); box-shadow: 0 0 0 1px rgba(8,145,178,.45), 0 0 12px rgba(34,211,238,.38); }
[data-vd-badge] { position: fixed; z-index: 2147482999; pointer-events: none; display: none; box-sizing: border-box; max-width: 70vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 8px; border-radius: 6px; border: 1px solid #334155; background: rgba(15,23,42,.55); color: #7dd3fc; font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; backdrop-filter: blur(10px); }
[data-vd-handle] { position: fixed; z-index: 2147482999; box-sizing: border-box; width: 12px; height: 12px; border-radius: 3px; border: 2px solid #0ea5e9; background: #fff; cursor: nwse-resize !important; }
[data-vd-handle][data-mode="w"] { cursor: ew-resize !important; }
[data-vd-handle][data-mode="h"] { cursor: ns-resize !important; }
[data-vd-bar] { position: fixed; z-index: 2147482999; display: none; flex-direction: column; align-items: stretch; gap: 5px; width: max-content; max-width: min(360px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 4px 6px; border-radius: 9px; border: 1px solid rgba(125,211,252,.42); background: rgba(15,23,42,.92); box-shadow: 0 8px 20px rgba(2,6,23,.4); backdrop-filter: blur(10px); }
[data-vd-bar][data-vd-expanded] { width: min(360px, calc(100vw - 16px)); }
[data-vd-bar-controls] { display: flex; align-items: center; gap: 6px; min-height: 28px; }
[data-vd-bar] [data-vd-label] { max-width: 38vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #7dd3fc; font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-vd-bar][data-vd-expanded] [data-vd-label] { max-width: none; min-width: 0; flex: 1; }
[data-vd-bar] button { padding: 6px 10px; border: 0; border-radius: 6px; background: rgba(30,41,59,.58); color: #e2e8f0; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-bar] button:hover { filter: brightness(1.15); }
[data-vd-bar] [data-vd-layout-toggle] { display: none; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0; background: rgba(14,165,233,.22); color: #bae6fd; }
[data-vd-bar] [data-vd-layout-toggle] { flex: 0 0 28px; }
[data-vd-batch] { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: none; flex-direction: column; gap: 8px; width: min(430px, calc(100vw - 32px)); max-height: min(42vh, 360px); box-sizing: border-box; padding: 12px; border: 1px solid rgba(148,163,184,.32); border-radius: 12px; background: rgba(15,23,42,.58); color: #e2e8f0; box-shadow: 0 12px 32px rgba(2,6,23,.38); backdrop-filter: blur(12px); font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-batch-header] { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #bae6fd; font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; cursor: grab; user-select: none; }
[data-vd-batch-hide] { padding: 4px 7px !important; background: rgba(51,65,85,.52) !important; }
[data-vd-batch-restore] { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: none; padding: 9px 12px; border: 1px solid rgba(148,163,184,.32); border-radius: 9px; background: rgba(15,23,42,.58); color: #bae6fd; box-shadow: 0 8px 20px rgba(2,6,23,.35); backdrop-filter: blur(10px); font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-change-list] { display: flex; flex-direction: column; gap: 5px; overflow: auto; min-height: 0; }
[data-vd-note] { width: 100%; min-height: 54px; max-height: 120px; box-sizing: border-box; padding: 8px 9px; resize: vertical; border: 1px solid rgba(148,163,184,.22); border-radius: 7px; outline: none; background: rgba(15,23,42,.34); color: #e2e8f0; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-note]::placeholder { color: #94a3b8; }
[data-vd-comment-panel] { position: fixed; z-index: 2147483001; display: none; width: min(260px, calc(100vw - 32px)); box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid rgba(148,163,184,.32); border-radius: 10px; background: rgba(15,23,42,.6); color: #e2e8f0; box-shadow: 0 16px 32px rgba(2,6,23,.45); backdrop-filter: blur(12px); }
[data-vd-comment-panel] textarea { width: 100%; min-height: 72px; resize: vertical; box-sizing: border-box; padding: 8px 9px; border: 1px solid rgba(148,163,184,.22); border-radius: 7px; background: rgba(15,23,42,.34); color: #e2e8f0; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-comment-panel] textarea::placeholder { color: #94a3b8; }
[data-vd-comment-panel] div { display: flex; justify-content: flex-end; gap: 6px; }
[data-vd-comment-panel] button { padding: 6px 10px; border: 0; border-radius: 6px; background: rgba(51,65,85,.55); color: #e2e8f0; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-comment-panel] button:last-child { background: rgba(14,165,233,.68); color: #04283f; }
[data-vd-change] { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 7px 8px; border: 1px solid rgba(148,163,184,.15); border-radius: 7px; background: rgba(30,41,59,.38); }
[data-vd-change-label] { overflow: hidden; color: #cbd5e1; text-overflow: ellipsis; white-space: nowrap; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-vd-batch-actions] { display: flex; justify-content: flex-end; gap: 6px; }
[data-vd-batch] button { padding: 6px 10px; border: 0; border-radius: 6px; background: rgba(51,65,85,.52); color: #e2e8f0; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-batch] button[data-vd-apply] { background: rgba(14,165,233,.68); color: #04283f; }
[data-vd-layout] { display: none; flex-direction: column; gap: 9px; max-height: min(65vh, 390px); overflow: auto; box-sizing: border-box; padding: 10px 6px 6px; border-top: 1px solid rgba(125,211,252,.2); color: #e2e8f0; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
[data-vd-layout] strong { color: #bae6fd; font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-vd-layout-target] { overflow: hidden; color: #94a3b8; font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
[data-vd-layout-controls] { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
[data-vd-layout-field] { display: flex; flex-direction: column; gap: 4px; min-width: 0; color: #94a3b8; font: 10px/1.2 ui-sans-serif, system-ui, sans-serif; }
[data-vd-layout-field] select { width: 100%; min-width: 0; padding: 7px 6px; border: 1px solid rgba(148,163,184,.22); border-radius: 6px; background: rgba(30,41,59,.9); color: #e2e8f0; font: 11px/1.2 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
[data-vd-layout] select:disabled { opacity: .5; }
body.vd-on [data-vd-ui] button { cursor: pointer !important; }
[data-vd-toast] { position: fixed; z-index: 2147483000; left: 50%; transform: translateX(-50%); bottom: 60px; display: none; padding: 8px 14px; border-radius: 8px; border: 1px solid #334155; background: rgba(15,23,42,.55); color: #e2e8f0; font: 600 12px/1.4 ui-sans-serif, system-ui, sans-serif; box-shadow: 0 8px 24px rgba(2,6,23,.45); backdrop-filter: blur(10px); }
[data-vd-toast][data-err] { border-color: #f43f5e; color: #fecdd3; }
body.vd-on { user-select: none; }
body.vd-on * { cursor: crosshair !important; }
`

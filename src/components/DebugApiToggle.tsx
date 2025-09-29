import React, { useEffect, useRef, useState } from 'react';
import { isDevelopment, shouldUseCSharpApi, setUseCSharpApiOverride, getUseCSharpApiOverride } from '@/config/environment';

export const DebugApiToggle: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [useApi, setUseApi] = useState<boolean>(shouldUseCSharpApi());
    const [minimized, setMinimized] = useState<boolean>(false);
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 10, y: 10 });
    const draggingRef = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Persist keys
    const POS_KEY = 'debug.apiToggle.pos';
    const MIN_KEY = 'debug.apiToggle.min';

    useEffect(() => {
        if (!isDevelopment()) return;
        setVisible(true);
        // Load minimize state
        try {
            const m = localStorage.getItem(MIN_KEY);
            if (m !== null) setMinimized(m === 'true');
        } catch { }
        // Load override
        const override = getUseCSharpApiOverride();
        if (typeof override === 'boolean') setUseApi(override);
        // Load position or place bottom-right
        try {
            const p = localStorage.getItem(POS_KEY);
            if (p) {
                const parsed = JSON.parse(p);
                setPos(parsed);
            } else {
                const w = window.innerWidth;
                const h = window.innerHeight;
                setPos({ x: Math.max(10, w - 180), y: Math.max(10, h - 80) });
            }
        } catch {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setPos({ x: Math.max(10, w - 180), y: Math.max(10, h - 80) });
        }
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!draggingRef.current.active) return;
            const x = e.clientX - draggingRef.current.dx;
            const y = e.clientY - draggingRef.current.dy;
            setPos({ x, y });
        };
        const onUp = () => {
            if (!draggingRef.current.active) return;
            draggingRef.current.active = false;
            try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [pos]);

    if (!visible) return null;

    const beginDrag = (e: React.MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        draggingRef.current.active = true;
        draggingRef.current.dx = e.clientX - (rect?.left ?? pos.x);
        draggingRef.current.dy = e.clientY - (rect?.top ?? pos.y);
    };

    const toggleApi = () => {
        const next = !useApi;
        setUseApi(next);
        setUseCSharpApiOverride(next);
        setTimeout(() => window.location.reload(), 50);
    };

    const clearOverride = () => {
        setUseCSharpApiOverride(null);
        setTimeout(() => window.location.reload(), 50);
    };

    const toggleMin = () => {
        const next = !minimized;
        setMinimized(next);
        try { localStorage.setItem(MIN_KEY, next ? 'true' : 'false'); } catch { }
    };

    return (
        <div
            ref={containerRef}
            style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, userSelect: draggingRef.current.active ? 'none' : 'auto' }}
        >
            {minimized ? (
                <div
                    onMouseDown={beginDrag}
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '6px 8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'move' }}
                >
                    <span style={{ fontSize: 12 }}>C# API: {useApi ? 'On' : 'Off'}</span>
                    <button onClick={toggleMin} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', padding: '2px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Expand</button>
                </div>
            ) : (
                <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '8px 10px', borderRadius: 8, minWidth: 160 }}>
                    <div onMouseDown={beginDrag} style={{ cursor: 'move', fontSize: 12, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Debug Controls</span>
                        <button onClick={toggleMin} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', padding: '0 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>–</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12 }}>C# API</span>
                        <button onClick={toggleApi} style={{ background: useApi ? '#22c55e' : '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>
                            {useApi ? 'On' : 'Off'}
                        </button>
                        <button onClick={clearOverride} title="Clear override" style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', padding: '2px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                            Reset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};



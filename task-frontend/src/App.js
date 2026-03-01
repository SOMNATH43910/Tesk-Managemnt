import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const API = 'http://localhost:8096/api';

/* ─── Animated counter ─── */
function useCounter(target, duration = 1200, started = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started || target === 0) { setVal(0); return; }
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, started]);
  return val;
}

/* ─── Sound Engine ─── */
const SFX = {
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  play(type) {
    try {
      this.init();
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      const now = this.ctx.currentTime;
      if (type === 'click') {
        o.type = 'sine'; o.frequency.setValueAtTime(880, now); o.frequency.exponentialRampToValueAtTime(440, now + 0.1);
        g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        o.start(now); o.stop(now + 0.15);
      } else if (type === 'success') {
        o.type = 'triangle';
        [0, 0.08, 0.16].forEach((t, i) => {
          const oo = this.ctx.createOscillator(); const gg = this.ctx.createGain();
          oo.connect(gg); gg.connect(this.ctx.destination);
          oo.type = 'triangle'; oo.frequency.value = [523, 659, 784][i];
          gg.gain.setValueAtTime(0.12, now + t); gg.gain.exponentialRampToValueAtTime(0.001, now + t + 0.2);
          oo.start(now + t); oo.stop(now + t + 0.25);
        });
        o.stop(now); return;
      } else if (type === 'error') {
        o.type = 'sawtooth'; o.frequency.setValueAtTime(220, now); o.frequency.setValueAtTime(180, now + 0.1);
        g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        o.start(now); o.stop(now + 0.25);
      } else if (type === 'nav') {
        o.type = 'sine'; o.frequency.setValueAtTime(660, now); o.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        o.start(now); o.stop(now + 0.12);
      } else if (type === 'hover') {
        o.type = 'sine'; o.frequency.value = 1200;
        g.gain.setValueAtTime(0.04, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        o.start(now); o.stop(now + 0.06);
      } else if (type === 'delete') {
        o.type = 'sawtooth'; o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.2);
        g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.start(now); o.stop(now + 0.2);
      } else if (type === 'xp') {
        [0, 0.06, 0.12, 0.18].forEach((t, i) => {
          const oo = this.ctx.createOscillator(); const gg = this.ctx.createGain();
          oo.connect(gg); gg.connect(this.ctx.destination);
          oo.type = 'sine'; oo.frequency.value = [523, 659, 784, 1047][i];
          gg.gain.setValueAtTime(0.1, now + t); gg.gain.exponentialRampToValueAtTime(0.001, now + t + 0.15);
          oo.start(now + t); oo.stop(now + t + 0.2);
        });
        o.stop(now); return;
      }
      if (o) try { o.start(now); o.stop(now + 0.3); } catch(e) {}
    } catch(e) {}
  }
};

/* ─── Mini Bar Chart ─── */
function MiniBarChart({ data, color, dark }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px' }}>
        {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '3px' }}>
              <div style={{
                flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end',
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
                borderRadius: '4px 4px 0 0', overflow: 'hidden', minHeight: '8px',
              }}>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: `linear-gradient(180deg, ${color}, ${color}88)`,
                  height: `${(d.value / max) * 100}%`,
                  minHeight: d.value > 0 ? '4px' : '0',
                  boxShadow: `0 0 8px ${color}66`,
                  transition: 'height 1s cubic-bezier(.16,1,.3,1)',
                  animation: 'barRise 1s cubic-bezier(.16,1,.3,1) both',
                  animationDelay: `${i * 0.07}s`,
                }} />
              </div>
              <span style={{ fontSize: '9px', color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', fontFamily: 'monospace' }}>{d.label}</span>
            </div>
        ))}
      </div>
  );
}

/* ─── Donut Chart ─── */
function DonutChart({ segments, size = 80, dark }) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  let offset = 0;
  const r = 28, cx = 40, cy = 40, circ = 2 * Math.PI * r;
  return (
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} strokeWidth="10" />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circ;
          const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                      stroke={seg.color} strokeWidth="10"
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={-offset * circ}
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 4px ${seg.color})`, transition: 'all 1s ease', transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
              />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fill={dark ? '#fff' : '#111'} fontSize="14" fontWeight="700" fontFamily="monospace">
          {total}
        </text>
      </svg>
  );
}

/* ─── XP Bar ─── */
function XPBar({ xp, level, dark }) {
  const nextLevel = level * 100;
  const pct = Math.min((xp % 100) / 100 * 100, 100);
  return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #f472b6, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '900', fontSize: '13px', color: '#fff',
          boxShadow: '0 0 15px rgba(244,114,182,0.5)',
          fontFamily: 'monospace', flexShrink: 0,
        }}>LV{level}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'monospace', letterSpacing: '1px' }}>XP {xp % 100}/{100}</span>
            <span style={{ fontSize: '10px', color: '#f472b6', fontFamily: 'monospace' }}>★ {xp} TOTAL</span>
          </div>
          <div style={{ height: '6px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)', borderRadius: '100px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '100px',
              background: 'linear-gradient(90deg, #f472b6, #a855f7, #6366f1)',
              width: `${pct}%`, transition: 'width 1s cubic-bezier(.16,1,.3,1)',
              boxShadow: '0 0 10px rgba(244,114,182,0.7)',
              animation: 'xpFill 1.5s cubic-bezier(.16,1,.3,1) both',
            }} />
          </div>
        </div>
      </div>
  );
}

/* ─── Achievement Badge ─── */
function AchievementToast({ ach, onDone }) {
  useEffect(() => { SFX.play('xp'); const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, []);
  return (
      <div style={{
        position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, rgba(30,0,60,0.97), rgba(60,0,90,0.97))',
        border: '1px solid rgba(244,114,182,0.5)',
        borderRadius: '16px', padding: '18px 28px',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: '14px',
        boxShadow: '0 0 40px rgba(244,114,182,0.4), 0 20px 60px rgba(0,0,0,0.5)',
        animation: 'achIn .6s cubic-bezier(.16,1,.3,1)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ fontSize: '32px', animation: 'achBounce .6s ease infinite alternate' }}>{ach.icon}</div>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#f472b6', letterSpacing: '2px', marginBottom: '3px' }}>🏆 ACHIEVEMENT UNLOCKED</div>
          <div style={{ fontWeight: '800', fontSize: '16px', color: '#fff', fontFamily: 'monospace' }}>{ach.name}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>{ach.desc} · +{ach.xp} XP</div>
        </div>
      </div>
  );
}

/* ─── Stars Background ─── */
function StarField({ dark }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.2,
      speed: Math.random() * 0.3 + 0.05,
      twinkle: Math.random() * Math.PI * 2,
      color: ['#f472b6', '#a855f7', '#818cf8', '#ffffff', '#06b6d4'][Math.floor(Math.random() * 5)],
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.twinkle += 0.02;
        s.y -= s.speed;
        if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; }
        const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.shadowBlur = 6;
        ctx.shadowColor = s.color;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [dark]);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: dark ? 0.7 : 0.15 }} />;
}

/* ─── Neon Grid ─── */
function NeonGrid({ dark }) {
  return (
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
        linear-gradient(${dark ? 'rgba(244,114,182,0.04)' : 'rgba(168,85,247,0.06)'} 1px, transparent 1px),
        linear-gradient(90deg, ${dark ? 'rgba(244,114,182,0.04)' : 'rgba(168,85,247,0.06)'} 1px, transparent 1px)
      `,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 100%, black 40%, transparent 100%)',
        animation: 'gridPerspective 12s ease-in-out infinite',
      }} />
  );
}

/* ─── Scanlines ─── */
function Scanlines() {
  return (
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)',
      }} />
  );
}

/* ─── Achievements Config ─── */
const ACHIEVEMENTS = [
  { id: 'first_project', icon: '🚀', name: 'Pioneer', desc: 'Created first project', xp: 50, check: (s) => s.projects >= 1 },
  { id: 'task_master', icon: '⚡', name: 'Task Master', desc: 'Created 5 tasks', xp: 100, check: (s) => s.tasks >= 5 },
  { id: 'team_builder', icon: '👥', name: 'Team Builder', desc: 'Added 3 team members', xp: 75, check: (s) => s.users >= 3 },
  { id: 'completionist', icon: '🏆', name: 'Completionist', desc: 'Completed 3 tasks', xp: 150, check: (s) => s.done >= 3 },
  { id: 'chat_starter', icon: '💬', name: 'Communicator', desc: 'Sent first message', xp: 25, check: (s) => s.messages >= 1 },
  { id: 'project_hoarder', icon: '📁', name: 'Architect', desc: 'Created 3 projects', xp: 200, check: (s) => s.projects >= 3 },
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600;700;800&display=swap');

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── DARK THEME ── */
.theme-dark {
  --bg: #0a0015;
  --bg2: #0d001e;
  --surface: rgba(20, 0, 40, 0.85);
  --surface2: rgba(30, 0, 55, 0.7);
  --surface3: rgba(40, 5, 70, 0.6);
  --border: rgba(244,114,182,0.1);
  --border2: rgba(244,114,182,0.25);
  --border3: rgba(244,114,182,0.5);
  --pink: #f472b6;
  --pink2: #ec4899;
  --purple: #a855f7;
  --purple2: #c084fc;
  --cyan: #06b6d4;
  --yellow: #fbbf24;
  --green: #10b981;
  --red: #ef4444;
  --text: #fce7f3;
  --text2: #9d6b8a;
  --text3: #5a3d52;
  --shadow: rgba(244,114,182,0.15);
  --glow-pink: 0 0 20px rgba(244,114,182,0.4), 0 0 60px rgba(244,114,182,0.15);
  --glow-purple: 0 0 20px rgba(168,85,247,0.4), 0 0 60px rgba(168,85,247,0.15);
  --scanline-opacity: 0.06;
}

/* ── LIGHT THEME ── */
.theme-light {
  --bg: #fdf4ff;
  --bg2: #f5e6ff;
  --surface: rgba(255,240,255,0.9);
  --surface2: rgba(248,225,255,0.85);
  --surface3: rgba(240,210,255,0.7);
  --border: rgba(168,85,247,0.15);
  --border2: rgba(168,85,247,0.3);
  --border3: rgba(168,85,247,0.6);
  --pink: #db2777;
  --pink2: #be185d;
  --purple: #7c3aed;
  --purple2: #6d28d9;
  --cyan: #0891b2;
  --yellow: #d97706;
  --green: #059669;
  --red: #dc2626;
  --text: #2d0040;
  --text2: #7e3a8a;
  --text3: #c084fc;
  --shadow: rgba(168,85,247,0.15);
  --glow-pink: 0 0 15px rgba(219,39,119,0.2);
  --glow-purple: 0 0 15px rgba(124,58,237,0.2);
  --scanline-opacity: 0.02;
}

html { scroll-behavior: smooth; }
body { background: var(--bg); color: var(--text); font-family: 'Exo 2', sans-serif; min-height: 100vh; overflow-x: hidden; }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: linear-gradient(var(--pink), var(--purple)); border-radius: 4px; }

/* ── KEYFRAMES ── */
@keyframes gridPerspective { 0%,100%{transform:perspective(400px) rotateX(2deg)} 50%{transform:perspective(400px) rotateX(3deg)} }
@keyframes barRise { from{transform:scaleY(0);transform-origin:bottom} to{transform:scaleY(1)} }
@keyframes achIn { from{opacity:0;transform:translateX(-50%) translateY(-30px) scale(.8)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
@keyframes achBounce { from{transform:scale(1) rotate(-5deg)} to{transform:scale(1.2) rotate(5deg)} }
@keyframes xpFill { from{width:0} }
@keyframes neonFlicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.3} 94%{opacity:1} 96%{opacity:0.6} 97%{opacity:1} }
@keyframes synthPulse { 0%,100%{box-shadow:var(--glow-pink)} 50%{box-shadow:var(--glow-purple)} }
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes spinRing { to{transform:rotate(360deg)} }
@keyframes retroSweep { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
@keyframes cardIn { from{opacity:0;transform:translateY(20px) scale(.95)} to{opacity:1;transform:none} }
@keyframes modalIn { from{opacity:0;transform:scale(.75) rotate(-2deg)} 70%{transform:scale(1.03) rotate(.5deg)} to{opacity:1;transform:none} }
@keyframes slideLeft { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:none} }
@keyframes toastIn { from{opacity:0;transform:translateX(120%) scale(.8)} to{opacity:1;transform:none} }
@keyframes toastOut { to{opacity:0;transform:translateX(120%) scale(.8)} }
@keyframes pulse2 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.5)} }
@keyframes dashMove { to{stroke-dashoffset:-20} }
@keyframes retroGlow { 0%,100%{text-shadow:0 0 10px var(--pink),0 0 20px var(--pink),0 0 40px var(--purple)} 50%{text-shadow:0 0 15px var(--purple),0 0 30px var(--purple),0 0 60px var(--pink)} }
@keyframes scanDown { from{transform:translateY(-100%)} to{transform:translateY(100vh)} }
@keyframes levelUp { 0%{transform:scale(1)} 30%{transform:scale(1.3) rotate(-3deg)} 60%{transform:scale(0.9) rotate(3deg)} 100%{transform:scale(1)} }

/* ── SPLASH ── */
.splash {
  position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:28px;
  background:var(--bg);transition:opacity 1s ease,visibility 1s ease;
}
.splash.out{opacity:0;visibility:hidden;pointer-events:none}

.splash-cassette {
  position:relative;width:160px;height:100px;
  background:linear-gradient(135deg,rgba(30,0,60,.9),rgba(60,0,90,.9));
  border:2px solid var(--pink);border-radius:12px;
  box-shadow:0 0 40px rgba(244,114,182,.5),inset 0 0 20px rgba(244,114,182,.1);
  display:flex;align-items:center;justify-content:center;
  animation:float 3s ease-in-out 1.5s infinite;
}
.splash-cassette::before {
  content:'◀▶ TASKFLOW ◀▶';
  position:absolute;top:10px;left:0;right:0;
  font-family:'VT323',monospace;font-size:13px;color:var(--pink);
  text-align:center;letter-spacing:2px;
  animation:neonFlicker 4s ease-in-out 2s infinite;
}
.cassette-reel {
  width:30px;height:30px;border-radius:50%;
  border:2px solid var(--purple);
  position:relative;
  animation:spinRing 1s linear infinite;
}
.cassette-reel::after{content:'';position:absolute;inset:6px;border-radius:50%;background:var(--purple);opacity:.4}
.cassette-reels{display:flex;gap:24px}

.splash-title {
  font-family:'Press Start 2P',monospace;font-size:28px;
  color:var(--pink);letter-spacing:4px;
  animation:retroGlow 2s ease-in-out infinite, fadeUp .8s ease .5s both;
  text-align:center;line-height:1.5;
}
.splash-sub {
  font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--text2);
  letter-spacing:4px;animation:fadeUp .6s ease .8s both;
}
.splash-bar{width:320px;animation:fadeUp .5s ease 1s both}
.splash-track{background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:100px;height:4px;overflow:hidden}
.splash-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--purple),var(--pink));box-shadow:0 0 12px var(--pink);animation:xpFill 2.5s ease 1.2s forwards;width:0}
.splash-status{font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--purple);letter-spacing:3px;animation:fadeUp .4s ease 1.2s both}

/* ── THEME TOGGLE ── */
.theme-toggle {
  position:fixed;top:16px;right:16px;z-index:1000;
  width:52px;height:28px;border-radius:100px;
  background:var(--surface);border:1px solid var(--border2);
  cursor:pointer;transition:all .3s;box-shadow:var(--glow-pink);
  display:flex;align-items:center;padding:3px;
}
.toggle-knob {
  width:22px;height:22px;border-radius:50%;
  background:linear-gradient(135deg,var(--pink),var(--purple));
  box-shadow:0 0 12px var(--pink);
  transition:transform .35s cubic-bezier(.34,1.56,.64,1);
  display:flex;align-items:center;justify-content:center;font-size:11px;
}
.theme-toggle.light .toggle-knob{transform:translateX(24px)}

/* ── AUTH ── */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;z-index:10;animation:fadeUp .7s ease both}

.auth-card {
  position:relative;background:var(--surface);backdrop-filter:blur(20px);
  border:1px solid var(--border2);border-radius:20px;padding:44px;
  width:100%;max-width:460px;
  box-shadow:0 0 60px var(--shadow),0 40px 80px rgba(0,0,0,.3);
  animation:cardIn .7s cubic-bezier(.16,1,.3,1) both;overflow:hidden;
}
.auth-card::before {
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--pink),var(--purple),var(--cyan),transparent);
  animation:neonFlicker 3s ease-in-out infinite;
}
.auth-card-scan {
  position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(244,114,182,.6),transparent);
  animation:scanDown 3s linear infinite;pointer-events:none;z-index:1;
}

.auth-logo{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:32px}
.auth-logo-icon{
  width:52px;height:52px;border-radius:14px;
  background:linear-gradient(135deg,var(--pink),var(--purple));
  display:flex;align-items:center;justify-content:center;font-size:24px;
  box-shadow:var(--glow-pink);animation:synthPulse 3s ease-in-out infinite;
  position:relative;overflow:hidden;
}
.auth-logo-icon::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 30%,rgba(255,255,255,.3) 50%,transparent 70%);animation:retroSweep 3s ease-in-out infinite}
.auth-logo-name{font-family:'Press Start 2P',monospace;font-size:16px;color:var(--pink);animation:retroGlow 2s ease-in-out infinite;letter-spacing:2px}

.auth-heading{font-family:'VT323',monospace;font-size:32px;text-align:center;margin-bottom:4px;color:var(--text);letter-spacing:3px}
.auth-sub{font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text2);text-align:center;margin-bottom:24px;letter-spacing:2px}

.auth-tabs{display:flex;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:24px;gap:4px;position:relative}
.tab-track{
  position:absolute;top:4px;bottom:4px;
  background:linear-gradient(135deg,rgba(244,114,182,.15),rgba(168,85,247,.15));
  border:1px solid rgba(244,114,182,.3);border-radius:10px;
  transition:all .4s cubic-bezier(.34,1.56,.64,1);
}
.auth-tab{flex:1;padding:10px;border-radius:10px;border:none;background:transparent;color:var(--text2);font-family:'VT323',monospace;font-size:20px;cursor:pointer;transition:all .3s;position:relative;z-index:1;letter-spacing:2px}
.auth-tab.active{color:var(--pink);text-shadow:0 0 10px rgba(244,114,182,.6)}
.auth-tab:hover:not(.active){color:var(--text)}

.form-group{margin-bottom:16px;position:relative}
.form-label{display:block;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--purple);text-transform:uppercase;letter-spacing:2px;margin-bottom:7px}
.f-wrap{position:relative}
.form-input{
  width:100%;background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:10px;
  padding:12px 16px;color:var(--text);font-family:'Exo 2',sans-serif;font-size:15px;font-weight:500;
  outline:none;transition:all .3s;
}
.form-input:focus{border-color:var(--pink);box-shadow:0 0 0 3px rgba(244,114,182,.1),0 0 20px rgba(244,114,182,.12);transform:translateY(-1px);background:rgba(244,114,182,.03)}
.form-input::placeholder{color:var(--text3)}
.f-line{position:absolute;bottom:-1px;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--pink),transparent);box-shadow:0 0 8px var(--pink);opacity:0;transition:opacity .3s;pointer-events:none;border-radius:100px}
.form-input:focus + .f-line{opacity:1}
select.form-input option{background:#1a0030}

.btn-auth{
  width:100%;position:relative;overflow:hidden;
  background:transparent;border:2px solid var(--pink);border-radius:12px;
  padding:14px;margin-top:8px;font-family:'Press Start 2P',monospace;font-size:11px;
  color:var(--pink);cursor:pointer;transition:all .3s;letter-spacing:2px;
  text-transform:uppercase;text-shadow:0 0 8px rgba(244,114,182,.5);
}
.btn-auth::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(244,114,182,.15),rgba(168,85,247,.15));opacity:0;transition:opacity .3s}
.btn-auth::after{content:'';position:absolute;top:0;left:-100%;bottom:0;width:50%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);transition:left .5s}
.btn-auth:hover::before{opacity:1}
.btn-auth:hover::after{left:150%}
.btn-auth:hover{box-shadow:var(--glow-pink);transform:translateY(-2px);border-color:var(--purple)}
.btn-auth:active{transform:scale(.97)}
.btn-auth:disabled{opacity:.4;cursor:not-allowed;transform:none}

.auth-hint{text-align:center;margin-top:14px;font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text3);letter-spacing:1px}
.auth-hint strong{color:var(--pink)}

.auth-err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:12px 16px;font-size:13px;color:#f87171;margin-bottom:14px;font-family:'Share Tech Mono',monospace;animation:fadeUp .3s ease}

/* ── LAYOUT ── */
.layout{display:flex;height:100vh;overflow:hidden;position:relative;z-index:10}

/* ── SIDEBAR ── */
.sidebar{
  width:256px;flex-shrink:0;background:var(--surface);backdrop-filter:blur(20px);
  border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0;
  position:relative;animation:slideLeft .7s cubic-bezier(.16,1,.3,1) both;
}
.sidebar::after{content:'';position:absolute;top:0;right:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,var(--pink),var(--purple),transparent);opacity:.3;animation:neonFlicker 4s ease-in-out infinite}

.brand{display:flex;align-items:center;gap:12px;padding:0 18px 20px;border-bottom:1px solid var(--border)}
.brand-ico{
  width:40px;height:40px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,var(--pink),var(--purple));
  display:flex;align-items:center;justify-content:center;font-size:20px;
  animation:synthPulse 3s ease-in-out infinite;
}
.brand-name{font-family:'Press Start 2P',monospace;font-size:11px;color:var(--pink);letter-spacing:1px;animation:retroGlow 2s ease-in-out infinite;line-height:1.5}

.xp-section{padding:12px 18px;border-bottom:1px solid var(--border)}

.nav-sec{padding:14px 14px 6px;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:3px}

.nav-item{
  display:flex;align-items:center;gap:12px;padding:11px 18px;margin:2px 10px;
  border-radius:12px;cursor:pointer;transition:all .3s cubic-bezier(.34,1.56,.64,1);
  font-size:15px;font-weight:600;color:var(--text2);position:relative;overflow:hidden;
  letter-spacing:.5px;
}
.nav-item::before{content:'';position:absolute;left:-100%;top:0;bottom:0;width:100%;background:linear-gradient(90deg,transparent,rgba(244,114,182,.06),transparent);transition:left .4s}
.nav-item:hover::before{left:100%}
.nav-item:hover{background:rgba(244,114,182,.06);color:var(--text);transform:translateX(4px)}
.nav-item.active{
  background:linear-gradient(135deg,rgba(244,114,182,.12),rgba(168,85,247,.1));
  color:var(--pink);border:1px solid rgba(244,114,182,.2);
  box-shadow:0 4px 20px rgba(244,114,182,.1);
  text-shadow:0 0 10px rgba(244,114,182,.4);
}
.nav-bar{position:absolute;left:0;top:20%;bottom:20%;width:3px;background:linear-gradient(var(--pink),var(--purple));border-radius:0 3px 3px 0;transform:scaleY(0);transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.nav-item.active .nav-bar{transform:scaleY(1)}
.nav-icon{font-size:18px;width:24px;text-align:center;transition:transform .3s}
.nav-item:hover .nav-icon,.nav-item.active .nav-icon{transform:scale(1.2) rotate(-8deg);filter:drop-shadow(0 0 6px var(--pink))}
.nav-badge{margin-left:auto;font-size:9px;font-weight:700;padding:2px 8px;border-radius:100px;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:'Share Tech Mono',monospace;animation:synthPulse 2s ease-in-out infinite}

.sidebar-user{margin-top:auto;padding:14px 18px 0;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px}
.user-ava{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-family:'Press Start 2P',monospace;font-size:13px;color:#fff;flex-shrink:0;box-shadow:var(--glow-pink);animation:synthPulse 3s ease-in-out infinite}
.user-name{font-size:14px;font-weight:700;color:var(--text)}
.user-role{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--pink);letter-spacing:1px}
.btn-exit{margin-left:auto;background:transparent;border:1px solid var(--border);color:var(--text2);padding:6px 10px;border-radius:8px;font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;cursor:pointer;transition:all .3s}
.btn-exit:hover{border-color:var(--red);color:var(--red);box-shadow:0 0 10px rgba(239,68,68,.2)}

/* ── MAIN ── */
.main{flex:1;overflow-y:auto;background:var(--bg);animation:fadeUp .6s ease .2s both}

/* ── TOPBAR ── */
.topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 26px;border-bottom:1px solid var(--border);
  background:rgba(var(--bg),.8);backdrop-filter:blur(16px);
  position:sticky;top:0;z-index:100;
}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--pink),var(--purple),transparent);animation:neonFlicker 3s ease-in-out infinite}
.page-title{font-family:'Press Start 2P',monospace;font-size:14px;color:var(--pink);animation:retroGlow 2s ease-in-out infinite;letter-spacing:2px}
.page-sub{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2);margin-top:4px;letter-spacing:1px}

.live-badge{display:flex;align-items:center;gap:8px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);padding:6px 14px;border-radius:100px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--green);letter-spacing:2px}
.live-dot{width:6px;height:6px;background:var(--green);border-radius:50%;animation:pulse2 1.5s ease-in-out infinite;box-shadow:0 0 8px var(--green)}

/* ── CONTENT ── */
.content{padding:22px 26px}

/* ── STATS ── */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.stat-card{
  background:var(--surface);backdrop-filter:blur(12px);border:1px solid var(--border);
  border-radius:16px;padding:20px;position:relative;overflow:hidden;cursor:default;
  transition:all .4s cubic-bezier(.34,1.56,.64,1);animation:cardIn .6s cubic-bezier(.16,1,.3,1) both;
}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--pink),var(--purple));transform:scaleX(0);transform-origin:left;transition:transform .5s cubic-bezier(.34,1.56,.64,1)}
.stat-card:hover::before{transform:scaleX(1)}
.stat-card:hover{border-color:rgba(244,114,182,.25);box-shadow:var(--glow-pink);transform:translateY(-8px) scale(1.02)}
.stat-card-sweep{position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(244,114,182,.04) 50%,transparent 70%);transform:translateX(-100%);transition:transform .6s}
.stat-card:hover .stat-card-sweep{transform:translateX(100%)}
.stat-ico{font-size:26px;margin-bottom:12px;display:block;transition:transform .3s}
.stat-card:hover .stat-ico{transform:scale(1.2) rotate(-10deg);filter:drop-shadow(0 0 8px var(--pink))}
.stat-val{font-family:'Press Start 2P',monospace;font-size:26px;margin-bottom:6px;color:var(--text);line-height:1.3}
.stat-lbl{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px}
.stat-tag{position:absolute;top:16px;right:16px;font-family:'Share Tech Mono',monospace;font-size:9px;padding:3px 9px;border-radius:100px;font-weight:600;letter-spacing:1px}
.tag-pink{background:rgba(244,114,182,.1);color:var(--pink);border:1px solid rgba(244,114,182,.2)}
.tag-purple{background:rgba(168,85,247,.1);color:var(--purple2);border:1px solid rgba(168,85,247,.2)}
.tag-green{background:rgba(16,185,129,.1);color:var(--green);border:1px solid rgba(16,185,129,.2)}
.tag-yellow{background:rgba(251,191,36,.1);color:var(--yellow);border:1px solid rgba(251,191,36,.2)}

/* ── SECTION HEADER ── */
.sec-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px}
.sec-title{font-family:'VT323',monospace;font-size:24px;color:var(--text);letter-spacing:2px}
.sec-title::before{content:'> ';color:var(--pink)}

/* ── BUTTONS ── */
.btn-primary{
  background:transparent;border:2px solid var(--pink);color:var(--pink);
  border-radius:10px;padding:9px 20px;font-family:'VT323',monospace;font-size:18px;
  cursor:pointer;transition:all .3s;display:flex;align-items:center;gap:8px;
  position:relative;overflow:hidden;letter-spacing:2px;
}
.btn-primary::after{content:'';position:absolute;top:0;left:-100%;bottom:0;width:50%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);transition:left .5s}
.btn-primary:hover::after{left:150%}
.btn-primary:hover{background:rgba(244,114,182,.1);box-shadow:var(--glow-pink);transform:translateY(-2px);text-shadow:0 0 8px rgba(244,114,182,.6)}
.btn-primary:active{transform:scale(.97)}

.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:8px;padding:6px 14px;font-family:'Exo 2',sans-serif;font-size:13px;cursor:pointer;transition:all .25s}
.btn-ghost:hover{border-color:var(--pink);color:var(--pink);background:rgba(244,114,182,.04)}

/* ── SEARCH ── */
.search-wrap{position:relative}
.search-input{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 14px 9px 38px;color:var(--text);font-family:'Exo 2',sans-serif;font-size:14px;outline:none;transition:all .3s;width:210px}
.search-input:focus{border-color:var(--pink);width:250px;box-shadow:0 0 15px rgba(244,114,182,.12)}
.search-input::placeholder{color:var(--text3)}
.search-ico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none}

/* ── CARDS ── */
.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(295px,1fr));gap:14px}
.proj-card{
  background:var(--surface);backdrop-filter:blur(12px);border:1px solid var(--border);
  border-radius:14px;padding:20px;transition:all .4s cubic-bezier(.16,1,.3,1);
  animation:cardIn .5s cubic-bezier(.16,1,.3,1) both;position:relative;overflow:hidden;cursor:default;
}
.proj-card:hover{border-color:rgba(244,114,182,.2);box-shadow:var(--glow-pink);transform:translateY(-6px)}
.proj-card::after{content:'';position:absolute;bottom:0;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,var(--pink),transparent);opacity:0;transition:opacity .3s}
.proj-card:hover::after{opacity:.6}
.card-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.card-title{font-family:'Exo 2',sans-serif;font-size:16px;font-weight:700;flex:1;margin-right:10px}
.card-actions{display:flex;gap:7px}
.card-desc{font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.65}
.card-meta{display:flex;gap:12px;flex-wrap:wrap}
.meta-item{display:flex;align-items:center;gap:5px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2)}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-family:'Share Tech Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.5px}
.b-active{background:rgba(16,185,129,.1);color:var(--green);border:1px solid rgba(16,185,129,.2)}
.b-hold{background:rgba(251,191,36,.1);color:var(--yellow);border:1px solid rgba(251,191,36,.2)}
.b-done{background:rgba(168,85,247,.1);color:var(--purple2);border:1px solid rgba(168,85,247,.2)}
.b-todo{background:rgba(6,182,212,.08);color:var(--cyan);border:1px solid rgba(6,182,212,.15)}
.b-prog{background:rgba(251,191,36,.08);color:var(--yellow);border:1px solid rgba(251,191,36,.12)}
.b-review{background:rgba(168,85,247,.08);color:var(--purple2);border:1px solid rgba(168,85,247,.12)}
.b-low{background:rgba(16,185,129,.08);color:var(--green);border:1px solid rgba(16,185,129,.12)}
.b-med{background:rgba(251,191,36,.08);color:var(--yellow);border:1px solid rgba(251,191,36,.12)}
.b-high{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.15)}
.b-crit{background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.2);animation:neonFlicker 1.5s ease-in-out infinite}

/* ── ICON BTN ── */
.btn-ico{width:29px;height:29px;border-radius:7px;border:1px solid var(--border);background:rgba(0,0,0,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .3s cubic-bezier(.34,1.56,.64,1);color:var(--text2)}
.btn-ico:hover{border-color:var(--pink);color:var(--pink);background:rgba(244,114,182,.08);transform:scale(1.15) rotate(-8deg)}
.btn-ico.del:hover{border-color:var(--red);color:#f87171;background:rgba(239,68,68,.08);transform:scale(1.15) rotate(8deg)}

/* ── FILTER CHIPS ── */
.filter-row{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.chip{background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:6px 16px;border-radius:100px;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;transition:all .3s cubic-bezier(.34,1.56,.64,1)}
.chip:hover{border-color:rgba(244,114,182,.3);color:var(--pink);transform:translateY(-2px)}
.chip.on{background:rgba(244,114,182,.08);border-color:rgba(244,114,182,.3);color:var(--pink);box-shadow:0 0 12px rgba(244,114,182,.12);text-shadow:0 0 8px rgba(244,114,182,.4)}

/* ── KANBAN ── */
.kanban{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;align-items:start}
.kb-col{background:var(--surface);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:14px;padding:14px;animation:cardIn .5s ease both}
.kb-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.kb-title{font-family:'VT323',monospace;font-size:18px;color:var(--text);letter-spacing:2px}
.kb-count{background:rgba(244,114,182,.1);color:var(--pink);font-family:'Share Tech Mono',monospace;font-size:10px;padding:2px 8px;border-radius:100px;border:1px solid rgba(244,114,182,.2)}
.task-card{
  background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:13px;
  margin-bottom:9px;transition:all .3s cubic-bezier(.34,1.56,.64,1);animation:cardIn .4s ease both;
  cursor:default;position:relative;overflow:hidden;
}
.task-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--pink),var(--purple));transform:scaleY(0);transform-origin:top;transition:transform .3s cubic-bezier(.34,1.56,.64,1);border-radius:3px 0 0 3px}
.task-card:hover::before{transform:scaleY(1)}
.task-card:hover{border-color:rgba(244,114,182,.18);transform:translateY(-3px) translateX(2px);box-shadow:0 6px 20px rgba(0,0,0,.3)}
.task-title{font-size:13px;font-weight:600;margin-bottom:7px;line-height:1.4}
.task-meta-row{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.task-who{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2)}

/* ── TABLE ── */
.tbl-wrap{background:var(--surface);backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:14px;overflow:hidden;animation:cardIn .5s ease both}
table{width:100%;border-collapse:collapse}
thead tr{border-bottom:1px solid var(--border2);background:rgba(244,114,182,.04)}
th{padding:13px 16px;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--pink);text-transform:uppercase;letter-spacing:2px;text-align:left}
td{padding:13px 16px;font-size:13px;border-bottom:1px solid var(--border);font-family:'Exo 2',sans-serif;font-weight:500}
tr:last-child td{border-bottom:none}
tbody tr{transition:all .2s}
tbody tr:hover{background:rgba(244,114,182,.04)}

/* ── CHAT ── */
.chat-wrap{display:grid;grid-template-columns:230px 1fr;gap:0;height:calc(100vh - 135px);background:var(--surface);backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:14px;overflow:hidden;animation:cardIn .5s ease both}
.chat-side{border-right:1px solid var(--border);padding:14px;display:flex;flex-direction:column;gap:5px;overflow-y:auto}
.chat-side-title{font-family:'VT323',monospace;font-size:20px;color:var(--pink);margin-bottom:8px;padding:0 4px;letter-spacing:2px}
.channel{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;cursor:pointer;transition:all .3s;font-size:14px;font-weight:600;color:var(--text2);position:relative;overflow:hidden}
.channel:hover{background:rgba(244,114,182,.06);color:var(--text)}
.channel.on{background:rgba(244,114,182,.08);color:var(--pink);border:1px solid rgba(244,114,182,.15);text-shadow:0 0 8px rgba(244,114,182,.4)}
.ch-unread{margin-left:auto;background:var(--pink);color:#fff;font-family:'Share Tech Mono',monospace;font-size:9px;padding:2px 7px;border-radius:100px}
.chat-main{display:flex;flex-direction:column}
.chat-hdr{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px}
.chat-hdr-title{font-family:'VT323',monospace;font-size:22px;color:var(--pink);letter-spacing:2px;animation:retroGlow 2s ease-in-out infinite}
.chat-hdr-sub{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2);letter-spacing:1px}
.msgs{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px}
.msg{display:flex;gap:10px;animation:cardIn .3s ease}
.msg.me{flex-direction:row-reverse}
.msg-ava{width:32px;height:32px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-family:'Press Start 2P',monospace;font-size:11px;color:#fff}
.msg-body{max-width:68%}
.msg-info{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text2);margin-bottom:4px;letter-spacing:.5px}
.msg.me .msg-info{text-align:right}
.msg-bub{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 13px;font-size:13px;line-height:1.6;font-family:'Exo 2',sans-serif;transition:all .2s}
.msg-bub:hover{border-color:rgba(244,114,182,.2)}
.msg.me .msg-bub{background:linear-gradient(135deg,rgba(244,114,182,.08),rgba(168,85,247,.08));border-color:rgba(244,114,182,.2)}
.chat-inp-row{padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:9px}
.chat-inp{flex:1;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:9px;padding:10px 15px;color:var(--text);font-family:'Exo 2',sans-serif;font-size:14px;outline:none;transition:all .3s}
.chat-inp:focus{border-color:var(--pink);box-shadow:0 0 12px rgba(244,114,182,.12)}
.chat-inp::placeholder{color:var(--text3)}
.btn-send{background:linear-gradient(135deg,rgba(244,114,182,.2),rgba(168,85,247,.2));border:2px solid var(--pink);color:var(--pink);border-radius:9px;padding:10px 16px;font-family:'VT323',monospace;font-size:18px;cursor:pointer;transition:all .3s;letter-spacing:2px}
.btn-send:hover{box-shadow:var(--glow-pink);transform:translateY(-2px)}

/* ── DASHBOARD CHARTS ── */
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.dash-grid2{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-top:14px}
.panel{background:var(--surface);backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:14px;padding:20px;animation:cardIn .5s ease both}
.panel-title{font-family:'VT323',monospace;font-size:22px;color:var(--pink);letter-spacing:2px;margin-bottom:16px}
.panel-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);transition:all .2s}
.panel-row:last-child{border-bottom:none}
.panel-row:hover{padding-left:6px;background:rgba(244,114,182,.03)}
.panel-row-name{font-size:13px;font-weight:600;font-family:'Exo 2',sans-serif}

/* ── ACHIEVEMENTS ── */
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:14px}
.ach-card{
  background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;
  display:flex;align-items:center;gap:12px;transition:all .3s;animation:cardIn .5s ease both;
}
.ach-card.unlocked{border-color:rgba(244,114,182,.3);background:linear-gradient(135deg,rgba(244,114,182,.06),rgba(168,85,247,.06));box-shadow:var(--glow-pink)}
.ach-card.locked{opacity:.45;filter:grayscale(.6)}
.ach-card:hover.unlocked{transform:translateY(-4px)}
.ach-ico{font-size:28px;flex-shrink:0;animation:float 3s ease-in-out infinite}
.ach-card.locked .ach-ico{filter:grayscale(1);animation:none}
.ach-name{font-family:'VT323',monospace;font-size:18px;letter-spacing:1px;color:var(--text)}
.ach-desc{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text2);letter-spacing:1px;margin-top:2px}
.ach-xp{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--pink);margin-top:4px}

/* ── MODAL ── */
.modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.8);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeUp .2s ease}
.modal{
  background:var(--surface);backdrop-filter:blur(20px);
  border:1px solid var(--border2);border-radius:18px;padding:34px;
  width:100%;max-width:470px;max-height:90vh;overflow-y:auto;
  animation:modalIn .5s cubic-bezier(.16,1,.3,1);
  box-shadow:0 0 60px var(--shadow),0 40px 80px rgba(0,0,0,.5);
  position:relative;overflow-x:hidden;
}
.modal::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--pink),var(--purple),transparent);animation:neonFlicker 2s ease-in-out infinite}
.modal-scan{position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(244,114,182,.5),transparent);animation:scanDown 2.5s linear infinite;pointer-events:none;z-index:1}
.modal-title{font-family:'VT323',monospace;font-size:28px;letter-spacing:3px;margin-bottom:24px;color:var(--pink);animation:retroGlow 2s ease-in-out infinite}
.modal-actions{display:flex;gap:12px;margin-top:24px}
.btn-save{flex:1;background:transparent;border:2px solid var(--pink);color:var(--pink);border-radius:10px;padding:12px;font-family:'VT323',monospace;font-size:20px;cursor:pointer;transition:all .3s;letter-spacing:2px}
.btn-save:hover{background:rgba(244,114,182,.1);box-shadow:var(--glow-pink);transform:translateY(-1px)}
.btn-cancel{flex:1;background:transparent;color:var(--text2);border:1px solid var(--border);border-radius:10px;padding:12px;font-family:'Exo 2',sans-serif;font-size:14px;cursor:pointer;transition:all .3s}
.btn-cancel:hover{border-color:var(--red);color:var(--red)}

/* ── TOAST ── */
.toast-wrap{position:fixed;bottom:22px;right:22px;z-index:9998;display:flex;flex-direction:column;gap:9px}
.toast{
  background:var(--surface);backdrop-filter:blur(16px);border:1px solid var(--border2);border-radius:11px;
  padding:12px 16px;font-size:13px;color:var(--text);display:flex;align-items:center;gap:10px;
  box-shadow:0 8px 30px rgba(0,0,0,.4);
  animation:toastIn .5s cubic-bezier(.16,1,.3,1),toastOut .4s ease 2.7s forwards;
  min-width:240px;max-width:360px;font-family:'Exo 2',sans-serif;font-weight:600;
}
.toast.success{border-left:3px solid var(--green)}
.toast.error{border-left:3px solid var(--red)}
.toast.info{border-left:3px solid var(--cyan)}

/* ── EMPTY ── */
.empty{text-align:center;padding:60px 20px;color:var(--text2)}
.empty-ico{font-size:44px;display:block;margin-bottom:14px;animation:float 3s ease-in-out infinite;filter:grayscale(.3) opacity(.5)}
.empty-title{font-family:'VT323',monospace;font-size:22px;color:var(--text);margin-bottom:6px;letter-spacing:2px}
.empty-sub{font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px}

/* ── NOTIFS ── */
.notif-bar{margin-bottom:18px;display:flex;flex-direction:column;gap:7px}
.notif-item{display:flex;align-items:center;gap:9px;background:rgba(244,114,182,.05);border:1px solid rgba(244,114,182,.12);border-radius:9px;padding:9px 13px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--pink);letter-spacing:1px;animation:slideLeft .4s ease}

@media(max-width:1200px){.kanban{grid-template-columns:repeat(2,1fr)}.stats-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){.sidebar{display:none}.chat-wrap{grid-template-columns:1fr}.dash-grid2{grid-template-columns:1fr 1fr}}
`;

const PAGES = ['dashboard', 'projects', 'tasks', 'users', 'chat', 'achievements'];
const PAGE_ICONS = { dashboard: '◈', projects: '⬡', tasks: '◉', users: '★', chat: '♫', achievements: '🏆' };
const PAGE_LABELS = { dashboard: 'DASHBOARD', projects: 'PROJECTS', tasks: 'TASKS', users: 'TEAM', chat: 'COMMS', achievements: 'ACHIEVEMENTS' };
const EMPTY_PROJECT = { name: '', description: '', status: 'ACTIVE', deadline: '' };
const EMPTY_TASK = { title: '', description: '', priority: 'MEDIUM', status: 'TODO', deadline: '' };
const EMPTY_USER = { username: '', email: '', password: '', role: 'DEVELOPER' };
const TASK_COLS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const COL_LABELS = { TODO: '▷ TODO', IN_PROGRESS: '⚡ IN PROG', IN_REVIEW: '◉ REVIEW', DONE: '✓ DONE' };

function StatCard({ icon, target, label, badge, tagType, delay, started, dark }) {
  const v = useCounter(target, 1300, started);
  return (
      <div className="stat-card" style={{ animationDelay: delay }}>
        <div className="stat-card-sweep" />
        <span className="stat-ico">{icon}</span>
        <div className="stat-val">{v}</div>
        <div className="stat-lbl">{label}</div>
        <span className={`stat-tag ${tagType}`}>{badge}</span>
      </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [splash, setSplash] = useState(true);
  const [statsOn, setStatsOn] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [authUser, setAuthUser] = useState({ username: '', password: '' });
  const [signUp, setSignUp] = useState({ username: '', email: '', password: '', role: 'DEVELOPER' });
  const [authErr, setAuthErr] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Synthwave sprint planning at 3pm! 🎵', user: 'Rahul', mine: false, time: '09:12' },
    { id: 2, text: 'Will the neon designs be ready? 💜', user: 'Priya', mine: false, time: '09:15' },
    { id: 3, text: "Absolutely! Check DM for preview ⚡", user: 'Rahul', mine: false, time: '09:16' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [activeChannel, setActiveChannel] = useState('general');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [unlockedAchs, setUnlockedAchs] = useState([]);
  const [currentAch, setCurrentAch] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const stompRef = useRef(null);
  const currentUserRef = useRef(null);

  const sfx = useCallback((type) => { if (soundOn) SFX.play(type); }, [soundOn]);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => {
    const t1 = setTimeout(() => setSplash(false), 3600);
    const t2 = setTimeout(() => setStatsOn(true), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (!loggedIn || !currentUser) return;
    const creds = { username: currentUser.username, password: currentUser._pwd };
    fetchAll(creds); connectWS();
    return () => { if (stompRef.current) stompRef.current.deactivate(); };
  }, [loggedIn]);

  /* Achievement checker */
  const checkAchievements = useCallback((state) => {
    ACHIEVEMENTS.forEach(ach => {
      if (!unlockedAchs.includes(ach.id) && ach.check(state)) {
        setUnlockedAchs(p => [...p, ach.id]);
        setXp(x => { const nx = x + ach.xp; setLevel(Math.floor(nx / 100) + 1); return nx; });
        setCurrentAch(ach);
      }
    });
  }, [unlockedAchs]);

  useEffect(() => {
    checkAchievements({
      projects: projects.length, tasks: tasks.length,
      users: users.length, done: tasks.filter(t => t.status === 'DONE').length,
      messages: messages.filter(m => m.mine).length,
    });
  }, [projects, tasks, users, messages]);

  const getCreds = () => {
    const u = currentUserRef.current;
    return u ? { username: u.username, password: u._pwd } : { username: 'admin', password: 'admin123' };
  };

  const fetchAll = async (creds) => {
    const c = creds || getCreds();
    try {
      const [p, t, u] = await Promise.all([
        axios.get(`${API}/projects`, { auth: c }),
        axios.get(`${API}/tasks`, { auth: c }),
        axios.get(`${API}/users`, { auth: c }),
      ]);
      setProjects(p.data); setTasks(t.data); setUsers(u.data);
    } catch (e) { console.error(e); }
  };

  const connectWS = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8096/ws'),
      onConnect: () => {
        client.subscribe('/topic/tasks', msg => { setNotifications(p => [msg.body, ...p].slice(0, 5)); addToast(msg.body, 'info'); });
        client.subscribe('/topic/projects', msg => { setNotifications(p => [msg.body, ...p].slice(0, 5)); });
      }
    });
    client.activate(); stompRef.current = client;
  };

  const addToast = (text, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  };

  const gainXp = (amount) => {
    setXp(x => { const nx = x + amount; setLevel(Math.floor(nx / 100) + 1); return nx; });
    sfx('xp');
  };

  /* AUTH */
  const handleLogin = async () => {
    setAuthErr(''); sfx('click');
    if (!authUser.username || !authUser.password) { setAuthErr('USERNAME + PASSWORD REQUIRED'); sfx('error'); return; }
    setAuthLoading(true);
    const loginCreds = { username: authUser.username, password: authUser.password };
    try {
      let ok = false;
      for (const ep of [`${API}/projects`, `${API}/tasks`, `${API}/users`]) {
        try {
          await axios.get(ep, { auth: loginCreds }); ok = true; break;
        } catch (e) {
          const s = e.response?.status;
          if (s === 403) { ok = true; break; }
          else if (s === 401) { setAuthErr('INVALID CREDENTIALS'); setAuthLoading(false); sfx('error'); return; }
        }
      }
      if (!ok) { setAuthErr('SERVER UNREACHABLE'); setAuthLoading(false); sfx('error'); return; }
      const userObj = { username: authUser.username, _pwd: authUser.password };
      currentUserRef.current = userObj;
      setCurrentUser(userObj); setLoggedIn(true);
      sfx('success'); addToast(`WELCOME ${authUser.username.toUpperCase()}! 🎵`, 'success');
    } catch (e) { setAuthErr('LOGIN FAILED'); sfx('error'); }
    finally { setAuthLoading(false); }
  };

  const handleSignUp = async () => {
    setAuthErr(''); sfx('click');
    if (!signUp.username || !signUp.email || !signUp.password) { setAuthErr('ALL FIELDS REQUIRED'); sfx('error'); return; }
    if (signUp.password.length < 4) { setAuthErr('PASSWORD MIN 4 CHARS'); sfx('error'); return; }
    setAuthLoading(true);
    try {
      let success = false;
      try {
        await axios.post(`${API}/users`, signUp); success = true;
      } catch (e1) {
        const s = e1.response?.status;
        if (s === 409 || s === 400) { setAuthErr('USER ALREADY EXISTS'); sfx('error'); return; }
        if (s === 401 || s === 403) {
          try { await axios.post(`${API}/users`, signUp, { auth: { username: 'admin', password: 'admin123' } }); success = true; }
          catch (e2) { if (e2.response?.status === 409) { setAuthErr('USER ALREADY EXISTS'); sfx('error'); return; } throw e2; }
        } else throw e1;
      }
      if (success) {
        sfx('success'); addToast('ACCOUNT CREATED! LOGIN NOW 🎵', 'success');
        setAuthTab('login'); setAuthUser({ username: signUp.username, password: signUp.password });
        setSignUp({ username: '', email: '', password: '', role: 'DEVELOPER' });
      }
    } catch (e) { setAuthErr(`SIGNUP FAILED: ${e.response?.status || 'NETWORK ERROR'}`); sfx('error'); }
    finally { setAuthLoading(false); }
  };

  /* CRUD */
  const createProject = async () => {
    sfx('click');
    try { await axios.post(`${API}/projects`, modalData, { auth: getCreds() }); await fetchAll(); setModal(null); addToast('PROJECT CREATED ⬡', 'success'); sfx('success'); gainXp(20); }
    catch (e) { addToast('ERROR CREATING PROJECT', 'error'); sfx('error'); }
  };
  const deleteProject = async (id) => {
    sfx('delete');
    try { await axios.delete(`${API}/projects/${id}`, { auth: getCreds() }); setProjects(p => p.filter(x => x.id !== id)); addToast('PROJECT DELETED', 'info'); }
    catch (e) {}
  };
  const createTask = async () => {
    sfx('click');
    try { await axios.post(`${API}/tasks`, modalData, { auth: getCreds() }); await fetchAll(); setModal(null); addToast('TASK CREATED ✓', 'success'); sfx('success'); gainXp(10); }
    catch (e) { addToast('ERROR CREATING TASK', 'error'); sfx('error'); }
  };
  const updateTaskStatus = async (id, status) => {
    sfx('nav');
    try {
      await axios.patch(`${API}/tasks/${id}/status?status=${status}`, {}, { auth: getCreds() });
      setTasks(p => p.map(t => t.id === id ? { ...t, status } : t));
      addToast(`MOVED → ${status.replace('_', ' ')}`, 'info');
      if (status === 'DONE') gainXp(25);
    } catch (e) {}
  };
  const deleteTask = async (id) => {
    sfx('delete');
    try { await axios.delete(`${API}/tasks/${id}`, { auth: getCreds() }); setTasks(p => p.filter(x => x.id !== id)); addToast('TASK DELETED', 'info'); }
    catch (e) {}
  };
  const createUser = async () => {
    sfx('click');
    try { await axios.post(`${API}/users`, modalData, { auth: getCreds() }); await fetchAll(); setModal(null); addToast('MEMBER ADDED ★', 'success'); sfx('success'); gainXp(15); }
    catch (e) { addToast('USERNAME/EMAIL EXISTS', 'error'); sfx('error'); }
  };
  const deleteUser = async (id) => {
    sfx('delete');
    try { await axios.delete(`${API}/users/${id}`, { auth: getCreds() }); setUsers(p => p.filter(x => x.id !== id)); addToast('MEMBER REMOVED', 'info'); }
    catch (e) {}
  };
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    sfx('click');
    setMessages(p => [...p, {
      id: Date.now(), text: chatInput,
      user: currentUser?.username || 'You', mine: true,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }]);
    setChatInput(''); gainXp(5);
  };

  const filteredProjects = projects.filter(p => {
    const q = search.toLowerCase();
    const m = p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    if (filter === 'active') return m && p.status === 'ACTIVE';
    if (filter === 'hold') return m && p.status === 'ON_HOLD';
    if (filter === 'done') return m && p.status === 'COMPLETED';
    return m;
  });
  const tasksByCol = col => tasks.filter(t => t.status === col && (!search || t.title?.toLowerCase().includes(search.toLowerCase())));

  const taskStatusData = [
    { label: 'TODO', value: tasks.filter(t => t.status === 'TODO').length },
    { label: 'PROG', value: tasks.filter(t => t.status === 'IN_PROGRESS').length },
    { label: 'REV', value: tasks.filter(t => t.status === 'IN_REVIEW').length },
    { label: 'DONE', value: tasks.filter(t => t.status === 'DONE').length },
  ];
  const priorityData = [
    { label: 'LOW', value: tasks.filter(t => t.priority === 'LOW').length },
    { label: 'MED', value: tasks.filter(t => t.priority === 'MEDIUM').length },
    { label: 'HIGH', value: tasks.filter(t => t.priority === 'HIGH').length },
    { label: 'CRIT', value: tasks.filter(t => t.priority === 'CRITICAL').length },
  ];
  const donutData = [
    { value: tasks.filter(t => t.status === 'DONE').length, color: '#10b981' },
    { value: tasks.filter(t => t.status === 'IN_PROGRESS').length, color: '#f472b6' },
    { value: tasks.filter(t => t.status === 'TODO').length, color: '#a855f7' },
    { value: tasks.filter(t => t.status === 'IN_REVIEW').length, color: '#06b6d4' },
  ];

  /* SPLASH */
  if (splash) return (
      <>
        <style>{css}</style>
        <div className={`theme-${dark ? 'dark' : 'light'}`} style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }}>
          <StarField dark={dark} />
          <NeonGrid dark={dark} />
          <Scanlines />
          <div className="splash">
            <div className="splash-cassette">
              <div className="cassette-reels">
                <div className="cassette-reel" />
                <div className="cassette-reel" style={{ animationDirection: 'reverse' }} />
              </div>
            </div>
            <div className="splash-title">TASK<br />FLOW</div>
            <div className="splash-sub">◀ 80S ENTERPRISE EDITION ▶</div>
            <div className="splash-bar">
              <div className="splash-track"><div className="splash-fill" /></div>
            </div>
            <div className="splash-status">LOADING SYNTHWAVE...</div>
          </div>
        </div>
      </>
  );

  /* AUTH */
  if (!loggedIn) return (
      <>
        <style>{css}</style>
        <div className={`theme-${dark ? 'dark' : 'light'}`} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          <StarField dark={dark} />
          <NeonGrid dark={dark} />
          <Scanlines />
          <button className={`theme-toggle ${dark ? '' : 'light'}`} onClick={() => { setDark(d => !d); sfx('nav'); }}>
            <div className="toggle-knob">{dark ? '🌙' : '☀️'}</div>
          </button>
          <button style={{ position: 'fixed', top: '16px', right: '72px', zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', transition: 'all .3s', color: soundOn ? 'var(--pink)' : 'var(--text3)' }}
                  onClick={() => { setSoundOn(s => !s); sfx('click'); }} title={soundOn ? 'Sound ON' : 'Sound OFF'}>
            {soundOn ? '🔊' : '🔇'}
          </button>
          <div className="auth-wrap">
            <div className="auth-card">
              <div className="auth-card-scan" />
              <div className="auth-logo">
                <div className="auth-logo-icon">🎵</div>
                <div className="auth-logo-name">TASKFLOW</div>
              </div>
              <div className="auth-heading">{authTab === 'login' ? '♪ WELCOME BACK' : '♫ JOIN THE CREW'}</div>
              <div className="auth-sub">{authTab === 'login' ? '> INSERT CREDENTIALS TO CONTINUE' : '> CREATE YOUR ARCADE ACCOUNT'}</div>

              <div className="auth-tabs">
                <div className="tab-track" style={{ left: authTab === 'login' ? '4px' : '50%', width: 'calc(50% - 8px)' }} />
                <button className={`auth-tab ${authTab === 'login' ? 'active' : ''}`} onClick={() => { setAuthTab('login'); setAuthErr(''); sfx('nav'); }}>SIGN IN</button>
                <button className={`auth-tab ${authTab === 'signup' ? 'active' : ''}`} onClick={() => { setAuthTab('signup'); setAuthErr(''); sfx('nav'); }}>SIGN UP</button>
              </div>

              {authErr && <div className="auth-err">⚠ {authErr}</div>}

              {authTab === 'login' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">// USERNAME</label>
                      <div className="f-wrap">
                        <input className="form-input" placeholder="enter username" value={authUser.username}
                               onChange={e => setAuthUser({ ...authUser, username: e.target.value })}
                               onKeyDown={e => e.key === 'Enter' && !authLoading && handleLogin()} />
                        <div className="f-line" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">// PASSWORD</label>
                      <div className="f-wrap">
                        <input className="form-input" type="password" placeholder="enter password" value={authUser.password}
                               onChange={e => setAuthUser({ ...authUser, password: e.target.value })}
                               onKeyDown={e => e.key === 'Enter' && !authLoading && handleLogin()} />
                        <div className="f-line" />
                      </div>
                    </div>
                    <button className="btn-auth" onClick={handleLogin} disabled={authLoading}>
                      {authLoading ? '◈ AUTHENTICATING...' : '▶ PRESS START'}
                    </button>
                    <div className="auth-hint">default: admin / <strong>admin123</strong></div>
                  </>
              ) : (
                  <>
                    {[
                      { label: '// USERNAME', key: 'username', type: 'text', placeholder: 'your handle' },
                      { label: '// EMAIL', key: 'email', type: 'email', placeholder: 'your@email.com' },
                      { label: '// PASSWORD', key: 'password', type: 'password', placeholder: 'create password (min 4)' },
                    ].map(f => (
                        <div key={f.key} className="form-group">
                          <label className="form-label">{f.label}</label>
                          <div className="f-wrap">
                            <input className="form-input" type={f.type} placeholder={f.placeholder}
                                   value={signUp[f.key]} onChange={e => setSignUp({ ...signUp, [f.key]: e.target.value })} />
                            <div className="f-line" />
                          </div>
                        </div>
                    ))}
                    <div className="form-group">
                      <label className="form-label">// ROLE</label>
                      <select className="form-input" value={signUp.role} onChange={e => setSignUp({ ...signUp, role: e.target.value })}>
                        <option>DEVELOPER</option><option>MANAGER</option><option>ADMIN</option>
                      </select>
                    </div>
                    <button className="btn-auth" onClick={handleSignUp} disabled={authLoading}>
                      {authLoading ? '◈ CREATING...' : '★ CREATE ACCOUNT'}
                    </button>
                  </>
              )}
            </div>
          </div>
          <div className="toast-wrap">{toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : '►'} {t.text}</div>)}</div>
        </div>
      </>
  );

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;

  return (
      <>
        <style>{css}</style>
        <div className={`theme-${dark ? 'dark' : 'light'}`} style={{ background: 'var(--bg)', minHeight: '100vh' }}>
          <StarField dark={dark} />
          <NeonGrid dark={dark} />
          <Scanlines />

          {/* Achievement popup */}
          {currentAch && <AchievementToast ach={currentAch} onDone={() => setCurrentAch(null)} />}

          {/* Controls */}
          <button className={`theme-toggle ${dark ? '' : 'light'}`} style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9997 }} onClick={() => { setDark(d => !d); sfx('nav'); }}>
            <div className="toggle-knob">{dark ? '🌙' : '☀️'}</div>
          </button>
          <button style={{ position: 'fixed', top: '16px', right: '72px', zIndex: 9997, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', color: soundOn ? 'var(--pink)' : 'var(--text3)', transition: 'all .3s' }}
                  onClick={() => { setSoundOn(s => !s); sfx('click'); }}>
            {soundOn ? '🔊' : '🔇'}
          </button>

          <div className="layout">
            {/* SIDEBAR */}
            <aside className="sidebar">
              <div className="brand">
                <div className="brand-ico">🎵</div>
                <div className="brand-name">TASK<br />FLOW</div>
              </div>

              <div className="xp-section">
                <XPBar xp={xp} level={level} dark={dark} />
              </div>

              <div className="nav-sec">// NAVIGATION</div>
              {PAGES.map((p, i) => (
                  <div key={p} className={`nav-item ${page === p ? 'active' : ''}`}
                       style={{ animationDelay: `${i * .08}s` }}
                       onClick={() => { setPage(p); sfx('nav'); }}>
                    <div className="nav-bar" />
                    <span className="nav-icon">{PAGE_ICONS[p]}</span>
                    {PAGE_LABELS[p]}
                    {p === 'chat' && messages.length > 0 && <span className="nav-badge">{messages.length}</span>}
                    {p === 'tasks' && inProgress > 0 && <span className="nav-badge">{inProgress}</span>}
                    {p === 'achievements' && unlockedAchs.length > 0 && <span className="nav-badge">{unlockedAchs.length}</span>}
                  </div>
              ))}

              <div className="nav-sec">// ACCOUNT</div>
              <div className="sidebar-user">
                <div className="user-ava">{(currentUser?.username || 'A')[0].toUpperCase()}</div>
                <div>
                  <div className="user-name">{currentUser?.username || 'Admin'}</div>
                  <div className="user-role">LV{level} PLAYER</div>
                </div>
                <button className="btn-exit" onClick={() => { setLoggedIn(false); setCurrentUser(null); currentUserRef.current = null; sfx('delete'); }}>EXIT</button>
              </div>
            </aside>

            {/* MAIN */}
            <main className="main">
              <div className="topbar">
                <div>
                  <div className="page-title">{PAGE_LABELS[page]}</div>
                  <div className="page-sub">♪ player: {currentUser?.username || 'admin'} · lv{level} · {xp} xp</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="live-badge"><div className="live-dot" />LIVE WS</div>
                  {notifications.length > 0 && <div style={{ fontFamily: 'Share Tech Mono', fontSize: '10px', color: 'var(--pink)', letterSpacing: '1px' }}>♦ {notifications.length} NEW</div>}
                </div>
              </div>

              <div className="content">
                {notifications.length > 0 && (
                    <div className="notif-bar">
                      {notifications.map((n, i) => <div key={i} className="notif-item">♦ {n}</div>)}
                    </div>
                )}

                {/* ── DASHBOARD ── */}
                {page === 'dashboard' && (
                    <>
                      <div className="stats-grid">
                        <StatCard icon="⬡" target={projects.length} label="PROJECTS" badge="ACTIVE" tagType="tag-pink" delay=".1s" started={statsOn} dark={dark} />
                        <StatCard icon="◉" target={totalTasks} label="TASKS" badge="ALL" tagType="tag-purple" delay=".2s" started={statsOn} dark={dark} />
                        <StatCard icon="⚡" target={inProgress} label="IN PROG" badge="LIVE" tagType="tag-yellow" delay=".3s" started={statsOn} dark={dark} />
                        <StatCard icon="✓" target={doneTasks} label="DONE" badge="CLEAR" tagType="tag-green" delay=".4s" started={statsOn} dark={dark} />
                      </div>

                      <div className="dash-grid">
                        <div className="panel" style={{ animationDelay: '.3s' }}>
                          <div className="panel-title">♫ RECENT PROJECTS</div>
                          {projects.slice(0, 5).map(p => (
                              <div key={p.id} className="panel-row">
                                <span className="panel-row-name">{p.name}</span>
                                <span className={`badge ${p.status === 'ACTIVE' ? 'b-active' : p.status === 'ON_HOLD' ? 'b-hold' : 'b-done'}`}>{p.status}</span>
                              </div>
                          ))}
                          {projects.length === 0 && <div style={{ color: 'var(--text3)', fontFamily: 'Share Tech Mono', fontSize: '10px', textAlign: 'center', padding: '20px 0', letterSpacing: '2px' }}>NO DATA</div>}
                        </div>
                        <div className="panel" style={{ animationDelay: '.4s' }}>
                          <div className="panel-title">◉ RECENT TASKS</div>
                          {tasks.slice(0, 5).map(t => (
                              <div key={t.id} className="panel-row">
                                <span className="panel-row-name">{t.title}</span>
                                <span className={`badge ${t.priority === 'HIGH' || t.priority === 'CRITICAL' ? 'b-high' : 'b-med'}`}>{t.priority}</span>
                              </div>
                          ))}
                          {tasks.length === 0 && <div style={{ color: 'var(--text3)', fontFamily: 'Share Tech Mono', fontSize: '10px', textAlign: 'center', padding: '20px 0', letterSpacing: '2px' }}>NO DATA</div>}
                        </div>
                      </div>

                      <div className="dash-grid2">
                        <div className="panel" style={{ animationDelay: '.5s' }}>
                          <div className="panel-title">▶ TASK STATUS</div>
                          <MiniBarChart data={taskStatusData} color="#f472b6" dark={dark} />
                        </div>
                        <div className="panel" style={{ animationDelay: '.6s' }}>
                          <div className="panel-title">★ PRIORITY</div>
                          <MiniBarChart data={priorityData} color="#a855f7" dark={dark} />
                        </div>
                        <div className="panel" style={{ animationDelay: '.7s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div className="panel-title">◎ OVERVIEW</div>
                          <DonutChart segments={donutData} size={100} dark={dark} />
                          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[['DONE', '#10b981'], ['PROG', '#f472b6'], ['TODO', '#a855f7'], ['REV', '#06b6d4']].map(([l, c]) => (
                                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Share Tech Mono', fontSize: '9px', color: 'var(--text2)' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />{l}
                                </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                )}

                {/* ── PROJECTS ── */}
                {page === 'projects' && (
                    <>
                      <div className="sec-hdr">
                        <div className="sec-title">ALL PROJECTS ({filteredProjects.length})</div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div className="search-wrap">
                            <span className="search-ico">♦</span>
                            <input className="search-input" placeholder="search..." value={search} onChange={e => setSearch(e.target.value)} />
                          </div>
                          <button className="btn-primary" onClick={() => { setModal('project'); setModalData({ ...EMPTY_PROJECT }); sfx('click'); }}>+ NEW</button>
                        </div>
                      </div>
                      <div className="filter-row">
                        {['all', 'active', 'hold', 'done'].map(f => (
                            <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => { setFilter(f); sfx('nav'); }}>
                              {f === 'all' ? '◈ ALL' : f === 'active' ? '● ACTIVE' : f === 'hold' ? '⏸ HOLD' : '✓ DONE'}
                            </button>
                        ))}
                      </div>
                      {filteredProjects.length === 0 ? (
                          <div className="empty"><span className="empty-ico">⬡</span><div className="empty-title">NO PROJECTS</div><div className="empty-sub">// create your first project</div></div>
                      ) : (
                          <div className="cards-grid">
                            {filteredProjects.map((p, i) => (
                                <div key={p.id} className="proj-card" style={{ animationDelay: `${i * .07}s` }}>
                                  <div className="card-hdr">
                                    <div className="card-title">{p.name}</div>
                                    <button className="btn-ico del" onClick={() => deleteProject(p.id)}>✕</button>
                                  </div>
                                  {p.description && <div className="card-desc">{p.description}</div>}
                                  <div className="card-meta">
                                    <span className={`badge ${p.status === 'ACTIVE' ? 'b-active' : p.status === 'ON_HOLD' ? 'b-hold' : 'b-done'}`}>{p.status}</span>
                                    {p.deadline && <span className="meta-item">◈ {new Date(p.deadline).toLocaleDateString('en-IN')}</span>}
                                    <span className="meta-item">✓ {tasks.filter(t => t.project?.id === p.id).length}</span>
                                  </div>
                                </div>
                            ))}
                          </div>
                      )}
                    </>
                )}

                {/* ── TASKS ── */}
                {page === 'tasks' && (
                    <>
                      <div className="sec-hdr">
                        <div className="sec-title">KANBAN BOARD</div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <div className="search-wrap">
                            <span className="search-ico">♦</span>
                            <input className="search-input" placeholder="search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
                          </div>
                          <button className="btn-primary" onClick={() => { setModal('task'); setModalData({ ...EMPTY_TASK }); sfx('click'); }}>+ NEW</button>
                        </div>
                      </div>
                      <div className="kanban">
                        {TASK_COLS.map((col, ci) => {
                          const ct = tasksByCol(col);
                          return (
                              <div key={col} className="kb-col" style={{ animationDelay: `${ci * .1}s` }}>
                                <div className="kb-head">
                                  <div className="kb-title">{COL_LABELS[col]}</div>
                                  <span className="kb-count">{ct.length}</span>
                                </div>
                                {ct.length === 0 && <div style={{ textAlign: 'center', padding: '26px 0', fontFamily: 'Share Tech Mono', fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px' }}>EMPTY</div>}
                                {ct.map((t, ti) => (
                                    <div key={t.id} className="task-card" style={{ animationDelay: `${ti * .06}s` }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span className={`badge ${t.priority === 'LOW' ? 'b-low' : t.priority === 'MEDIUM' ? 'b-med' : t.priority === 'HIGH' ? 'b-high' : 'b-crit'}`}>{t.priority}</span>
                                        <button className="btn-ico del" style={{ width: '24px', height: '24px', fontSize: '11px' }} onClick={() => deleteTask(t.id)}>✕</button>
                                      </div>
                                      <div className="task-title">{t.title}</div>
                                      {t.description && <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '5px', lineHeight: '1.5' }}>{t.description}</div>}
                                      <div className="task-meta-row">
                                        <span className="task-who">★ {t.assignee?.username || 'Unassigned'}</span>
                                        {t.deadline && <span style={{ fontFamily: 'Share Tech Mono', fontSize: '9px', color: 'var(--text3)' }}>{new Date(t.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>}
                                      </div>
                                      {col !== 'DONE' && (
                                          <div style={{ marginTop: '9px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                            {TASK_COLS.filter(c => c !== col).map(c => (
                                                <button key={c} className="btn-ghost" style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '6px', fontFamily: 'Share Tech Mono', letterSpacing: '1px' }}
                                                        onClick={() => updateTaskStatus(t.id, c)}>→ {c.replace('_', ' ')}</button>
                                            ))}
                                          </div>
                                      )}
                                    </div>
                                ))}
                              </div>
                          );
                        })}
                      </div>
                    </>
                )}

                {/* ── USERS ── */}
                {page === 'users' && (
                    <>
                      <div className="sec-hdr">
                        <div className="sec-title">TEAM ({users.length})</div>
                        <button className="btn-primary" onClick={() => { setModal('user'); setModalData({ ...EMPTY_USER }); sfx('click'); }}>+ ADD</button>
                      </div>
                      {users.length === 0 ? (
                          <div className="empty"><span className="empty-ico">★</span><div className="empty-title">NO MEMBERS</div><div className="empty-sub">// add your crew</div></div>
                      ) : (
                          <div className="tbl-wrap">
                            <table>
                              <thead><tr><th>#</th><th>PLAYER</th><th>EMAIL</th><th>CLASS</th><th>JOINED</th><th>—</th></tr></thead>
                              <tbody>
                              {users.map((u, i) => (
                                  <tr key={u.id} style={{ animation: `cardIn .4s ease ${i * .06}s both` }}>
                                    <td style={{ fontFamily: 'Share Tech Mono', fontSize: '10px', color: 'var(--text3)' }}>{String(i + 1).padStart(2, '0')}</td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,var(--pink),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Press Start 2P', fontWeight: '700', fontSize: '12px', color: '#fff', boxShadow: 'var(--glow-pink)' }}>
                                          {u.username[0].toUpperCase()}
                                        </div>
                                        <span style={{ fontWeight: '700' }}>{u.username}</span>
                                      </div>
                                    </td>
                                    <td style={{ color: 'var(--text2)', fontFamily: 'Share Tech Mono', fontSize: '11px' }}>{u.email}</td>
                                    <td><span className={`badge ${u.role === 'ADMIN' ? 'b-crit' : u.role === 'MANAGER' ? 'b-active' : 'b-todo'}`}>{u.role}</span></td>
                                    <td style={{ color: 'var(--text3)', fontFamily: 'Share Tech Mono', fontSize: '10px' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                                    <td><button className="btn-ico del" onClick={() => deleteUser(u.id)}>✕</button></td>
                                  </tr>
                              ))}
                              </tbody>
                            </table>
                          </div>
                      )}
                    </>
                )}

                {/* ── CHAT ── */}
                {page === 'chat' && (
                    <div className="chat-wrap">
                      <div className="chat-side">
                        <div className="chat-side-title">♫ CHANNELS</div>
                        {['general', 'engineering', 'design', 'random'].map(ch => (
                            <div key={ch} className={`channel ${activeChannel === ch ? 'on' : ''}`} onClick={() => { setActiveChannel(ch); sfx('nav'); }}>
                              <span>{ch === 'general' ? '◌' : ch === 'engineering' ? '⚙' : ch === 'design' ? '◈' : '♦'}</span>
                              #{ch}
                              {ch === 'general' && messages.filter(m => !m.mine).length > 0 && <span className="ch-unread">{messages.filter(m => !m.mine).length}</span>}
                            </div>
                        ))}
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontFamily: 'Share Tech Mono', fontSize: '9px', color: 'var(--text3)', letterSpacing: '2px', marginBottom: '8px' }}>// ONLINE</div>
                          {users.slice(0, 4).map(u => (
                              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '13px', fontWeight: '600' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                                {u.username}
                              </div>
                          ))}
                        </div>
                      </div>
                      <div className="chat-main">
                        <div className="chat-hdr">
                          <div>
                            <div className="chat-hdr-title">♫ #{activeChannel.toUpperCase()}</div>
                            <div className="chat-hdr-sub">> {users.length} members · live</div>
                          </div>
                          <div style={{ marginLeft: 'auto' }}><div className="live-badge"><div className="live-dot" />LIVE</div></div>
                        </div>
                        <div className="msgs">
                          {messages.filter(m => !m.channel || m.channel === activeChannel).map(m => (
                              <div key={m.id} className={`msg ${m.mine ? 'me' : ''}`}>
                                <div className="msg-ava">{m.user[0].toUpperCase()}</div>
                                <div className="msg-body">
                                  <div className="msg-info">{m.mine ? 'YOU' : m.user.toUpperCase()} · {m.time || 'now'}</div>
                                  <div className="msg-bub">{m.text}</div>
                                </div>
                              </div>
                          ))}
                        </div>
                        <div className="chat-inp-row">
                          <input className="chat-inp" placeholder={`♪ message #${activeChannel}...`}
                                 value={chatInput} onChange={e => setChatInput(e.target.value)}
                                 onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                          <button className="btn-send" onClick={sendMessage}>SEND ▶</button>
                        </div>
                      </div>
                    </div>
                )}

                {/* ── ACHIEVEMENTS ── */}
                {page === 'achievements' && (
                    <>
                      <div className="sec-hdr">
                        <div className="sec-title">ACHIEVEMENTS ({unlockedAchs.length}/{ACHIEVEMENTS.length})</div>
                      </div>
                      <div style={{ marginBottom: '20px' }}>
                        <XPBar xp={xp} level={level} dark={dark} />
                      </div>
                      <div className="ach-grid">
                        {ACHIEVEMENTS.map((ach, i) => {
                          const unlocked = unlockedAchs.includes(ach.id);
                          return (
                              <div key={ach.id} className={`ach-card ${unlocked ? 'unlocked' : 'locked'}`} style={{ animationDelay: `${i * .08}s` }}>
                                <div className="ach-ico">{unlocked ? ach.icon : '🔒'}</div>
                                <div>
                                  <div className="ach-name">{unlocked ? ach.name : '???'}</div>
                                  <div className="ach-desc">{unlocked ? ach.desc : 'Keep playing...'}</div>
                                  <div className="ach-xp">+{ach.xp} XP {unlocked ? '✓ UNLOCKED' : ''}</div>
                                </div>
                              </div>
                          );
                        })}
                      </div>
                    </>
                )}
              </div>
            </main>
          </div>

          {/* MODALS */}
          {modal === 'project' && (
              <div className="modal-overlay" onClick={() => setModal(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-scan" />
                  <div className="modal-title">⬡ NEW PROJECT</div>
                  {[{ label: '// PROJECT NAME', key: 'name', placeholder: 'e.g. Neon Dashboard' }, { label: '// DESCRIPTION', key: 'description', placeholder: 'What are you building?' }].map(f => (
                      <div key={f.key} className="form-group">
                        <label className="form-label">{f.label}</label>
                        <div className="f-wrap">
                          <input className="form-input" placeholder={f.placeholder} value={modalData[f.key] || ''} onChange={e => setModalData({ ...modalData, [f.key]: e.target.value })} />
                          <div className="f-line" />
                        </div>
                      </div>
                  ))}
                  <div className="form-group">
                    <label className="form-label">// STATUS</label>
                    <select className="form-input" value={modalData.status || 'ACTIVE'} onChange={e => setModalData({ ...modalData, status: e.target.value })}>
                      <option>ACTIVE</option><option>ON_HOLD</option><option>COMPLETED</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">// DEADLINE</label>
                    <input className="form-input" type="datetime-local" value={modalData.deadline || ''} onChange={e => setModalData({ ...modalData, deadline: e.target.value })} />
                  </div>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setModal(null)}>CANCEL</button>
                    <button className="btn-save" onClick={createProject}>CREATE ▶</button>
                  </div>
                </div>
              </div>
          )}

          {modal === 'task' && (
              <div className="modal-overlay" onClick={() => setModal(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-scan" />
                  <div className="modal-title">◉ NEW TASK</div>
                  {[{ label: '// TASK TITLE', key: 'title', placeholder: 'What needs to be done?' }, { label: '// DESCRIPTION', key: 'description', placeholder: 'Task details...' }].map(f => (
                      <div key={f.key} className="form-group">
                        <label className="form-label">{f.label}</label>
                        <div className="f-wrap">
                          <input className="form-input" placeholder={f.placeholder} value={modalData[f.key] || ''} onChange={e => setModalData({ ...modalData, [f.key]: e.target.value })} />
                          <div className="f-line" />
                        </div>
                      </div>
                  ))}
                  <div className="form-group">
                    <label className="form-label">// PRIORITY</label>
                    <select className="form-input" value={modalData.priority || 'MEDIUM'} onChange={e => setModalData({ ...modalData, priority: e.target.value })}>
                      <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">// STATUS</label>
                    <select className="form-input" value={modalData.status || 'TODO'} onChange={e => setModalData({ ...modalData, status: e.target.value })}>
                      {TASK_COLS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">// DEADLINE</label>
                    <input className="form-input" type="datetime-local" value={modalData.deadline || ''} onChange={e => setModalData({ ...modalData, deadline: e.target.value })} />
                  </div>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setModal(null)}>CANCEL</button>
                    <button className="btn-save" onClick={createTask}>CREATE ▶</button>
                  </div>
                </div>
              </div>
          )}

          {modal === 'user' && (
              <div className="modal-overlay" onClick={() => setModal(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-scan" />
                  <div className="modal-title">★ ADD PLAYER</div>
                  {[{ label: '// USERNAME', key: 'username', type: 'text', placeholder: 'player handle' }, { label: '// EMAIL', key: 'email', type: 'email', placeholder: 'player@email.com' }, { label: '// PASSWORD', key: 'password', type: 'password', placeholder: 'create password' }].map(f => (
                      <div key={f.key} className="form-group">
                        <label className="form-label">{f.label}</label>
                        <div className="f-wrap">
                          <input className="form-input" type={f.type} placeholder={f.placeholder} value={modalData[f.key] || ''} onChange={e => setModalData({ ...modalData, [f.key]: e.target.value })} />
                          <div className="f-line" />
                        </div>
                      </div>
                  ))}
                  <div className="form-group">
                    <label className="form-label">// CLASS</label>
                    <select className="form-input" value={modalData.role || 'DEVELOPER'} onChange={e => setModalData({ ...modalData, role: e.target.value })}>
                      <option>DEVELOPER</option><option>MANAGER</option><option>ADMIN</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setModal(null)}>CANCEL</button>
                    <button className="btn-save" onClick={createUser}>ADD ▶</button>
                  </div>
                </div>
              </div>
          )}

          {/* TOASTS */}
          <div className="toast-wrap">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type}`}>
                  {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : '►'} {t.text}
                </div>
            ))}
          </div>
        </div>
      </>
  );
}
"use client";

/**
 * SigmaSec — marketing landing page.
 *
 * FONTS: this file ships a hoisted <link rel="stylesheet" precedence="default">,
 * which React 19 / Next 15 lifts into <head> automatically. If you'd rather
 * self-host (no FOUC, no third-party request), move to next/font in app/layout.tsx:
 *
 *   import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
 *   const archivo = Archivo({ subsets:["latin"], weight:["500","600","700"], variable:"--lp-display" });
 *   ...then delete the <link> below and drop the font-family fallbacks.
 *
 * TOASTS: requires <Toaster /> mounted in app/layout.tsx (sonner). Without it,
 * form feedback silently does nothing.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-rotating H1. Recommended: false.
 * A rotating headline means the page has no single claim, splits SEO weight
 * across four strings, and forces the reader to wait to finish reading.
 * Left as a flag so you can A/B it rather than take my word for it.
 */
const HERO_ROTATE = false;
const HERO_INTERVAL_MS = 5200;

const EARLY_ACCESS_ENDPOINT = "/api/early-access";

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE — single source of truth, shared by CSS and canvas painting.
// Rule: colour is reserved for FINDING STATE. Chrome is ink and grey, always.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  paper: "#FBFBFC",
  paper2: "#FFFFFF",
  paper3: "#F2F3F5",
  ink: "#0B0D0F",
  ink2: "#4A5158",
  ink3: "#838A91",
  rule: "#E2E4E7",
  rule2: "#EDEEF0",
  dark: "#0B0D0F",
  dark2: "#14171A",
  darkRule: "#23272C",
  darkTx: "#E4E6E9",
  darkTx2: "#8C939A",
  // signal — three states on one axis
  ochre: "#916008", // reachable — needs a human decision
  clay: "#A32B1C", // exploitable — confirmed
  emerald: "#0B6647", // resolved — patch open
  // unranked mass
  tick1: "#C6CACE",
  tick2: "#8E959C",
} as const;

const FINDING_NAMES = [
  "Weak key exchange on SSH service · api-internal-22",
  "AWS access key live in public commit · infra-scripts",
  "Authentication bypass in gnutls · reachable from login handler",
  "Use-after-free in libxslt · reachable from XML parser",
  "Exposed admin panel · no authentication · admin.staging",
  "Prototype pollution in lodash · reachable from request body parser",
  "Stripe restricted key in build log · ci-runner",
  "Path traversal in file upload handler · media-service",
  "Deserialisation flaw in jackson-databind · reachable from webhook",
  "SSRF in image proxy · fetches arbitrary internal hosts",
  "Postgres superuser credential in Helm values · prod cluster",
  "Regex denial of service in email validator · signup path",
  "Outdated OpenSSL in base image · CVE listed in KEV",
  "Session fixation on password reset · accounts-service",
];

const HERO_LINES = [
  { pre: "Your scanners found 1,204 problems last week.", benefit: " Fourteen were real." },
  { pre: "Stop triaging noise.", benefit: " Start fixing what is exploitable." },
  { pre: "Exploitability confirmed", benefit: " before an engineer sees it." },
  { pre: "From 1,204 findings to", benefit: " 7 pull requests." },
];

const PANEL_TABS = ["Review patch diff", "Open pull request", "Create Jira ticket", "Ask the agent"] as const;
type PanelTab = (typeof PANEL_TABS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// CYBER NETWORK BACKGROUND ANIMATION
// High-performance canvas particle & neural mesh network inspired by modern
// cyber security platforms (dynamic nodes, distance-based connection vectors,
// interactive cursor magnetic proximity, and live security data packet pulses).
// ─────────────────────────────────────────────────────────────────────────────

interface CyberNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulseSpeed: number;
  pulsePhase: number;
  isAccent: boolean;
  accentType: "teal" | "clay" | "default";
}

interface DataPacket {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
}

function CyberNetworkBg() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouseRef = React.useRef<{ x: number | null; y: number | null }>({ x: null, y: null });

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let nodes: CyberNode[] = [];
    let packets: DataPacket[] = [];

    const initNodes = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density based on viewport area
      const count = Math.min(Math.max(35, Math.floor((width * height) / 14000)), 85);
      nodes = [];

      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: Math.random() * 1.8 + 1.2,
          baseAlpha: Math.random() * 0.35 + 0.3,
          pulseSpeed: Math.random() * 0.03 + 0.015,
          pulsePhase: Math.random() * Math.PI * 2,
          isAccent: rand < 0.25,
          accentType: rand < 0.12 ? "teal" : rand < 0.22 ? "clay" : "default",
        });
      }

      packets = [];
    };

    initNodes();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave);

    const maxDist = 135;
    const mouseRadius = 160;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle background cyber grid dots
      const gridSpacing = 48;
      ctx.fillStyle = "rgba(131, 138, 145, 0.06)";
      for (let gx = 0; gx < width; gx += gridSpacing) {
        for (let gy = 0; gy < height; gy += gridSpacing) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      // Update and draw node positions
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.x += node.vx;
        node.y += node.vy;
        node.pulsePhase += node.pulseSpeed;

        // Bounce on edges
        if (node.x < 0) {
          node.x = 0;
          node.vx *= -1;
        } else if (node.x > width) {
          node.x = width;
          node.vx *= -1;
        }

        if (node.y < 0) {
          node.y = 0;
          node.vy *= -1;
        } else if (node.y > height) {
          node.y = height;
          node.vy *= -1;
        }

        // Mouse interactive influence
        if (mouseRef.current.x !== null && mouseRef.current.y !== null) {
          const dx = mouseRef.current.x - node.x;
          const dy = mouseRef.current.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseRadius && dist > 0) {
            const force = (1 - dist / mouseRadius) * 0.08;
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        }

        // Damping to keep speed controlled
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > 0.9) {
          node.vx = (node.vx / speed) * 0.9;
          node.vy = (node.vy / speed) * 0.9;
        }
      }

      // Connect nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.18;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = n1.isAccent || n2.isAccent ? `rgba(10, 106, 98, ${alpha * 1.5})` : `rgba(131, 138, 145, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Spawn data packet along connection occasionally
            if (Math.random() < 0.0015 && packets.length < 16) {
              packets.push({
                fromNode: i,
                toNode: j,
                progress: 0,
                speed: 0.012 + Math.random() * 0.015,
              });
            }
          }
        }

        // Connection to cursor
        if (mouseRef.current.x !== null && mouseRef.current.y !== null) {
          const mdx = mouseRef.current.x - n1.x;
          const mdy = mouseRef.current.y - n1.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < mouseRadius) {
            const alpha = (1 - mdist / mouseRadius) * 0.35;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(10, 106, 98, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      // Render & update data packets (packets traveling through network)
      for (let p = packets.length - 1; p >= 0; p--) {
        const pkt = packets[p];
        const n1 = nodes[pkt.fromNode];
        const n2 = nodes[pkt.toNode];
        if (!n1 || !n2) {
          packets.splice(p, 1);
          continue;
        }

        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          packets.splice(p, 1);
          continue;
        }

        const px = n1.x + (n2.x - n1.x) * pkt.progress;
        const py = n1.y + (n2.y - n1.y) * pkt.progress;

        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 106, 98, 0.75)";
        ctx.shadowColor = "rgba(10, 106, 98, 0.6)";
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      // Render nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pulse = Math.sin(node.pulsePhase) * 0.2 + 0.8;
        const radius = node.radius * pulse;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

        if (node.accentType === "teal") {
          ctx.fillStyle = `rgba(10, 106, 98, ${node.baseAlpha * 1.3})`;
        } else if (node.accentType === "clay") {
          ctx.fillStyle = `rgba(163, 43, 28, ${node.baseAlpha * 1.2})`;
        } else {
          ctx.fillStyle = `rgba(69, 79, 89, ${node.baseAlpha})`;
        }
        ctx.fill();

        // Subtle outer pulse aura on accent security nodes
        if (node.isAccent) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = node.accentType === "clay" ? "rgba(163, 43, 28, 0.2)" : "rgba(10, 106, 98, 0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const ro = new ResizeObserver(() => {
      initNodes();
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="hero-canvas-bg"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK CANVAS
// The unranked gates hold 1,204 + 399 + 86 marks. As DOM spans that is ~1,700
// nodes shipped in the HTML payload and reconciled by React on every render.
// Canvas keeps "one mark = one finding" literally true at zero DOM cost.
// ─────────────────────────────────────────────────────────────────────────────

const TICK_W = 5;
const TICK_H = 3;
const TICK_GAP = 1;

function TickCanvas({ count, color }: { count: number; color: string }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const draw = () => {
      const w = wrap.clientWidth;
      if (!w) return;
      const pitchX = TICK_W + TICK_GAP;
      const pitchY = TICK_H + TICK_GAP;
      const perRow = Math.max(1, Math.floor((w + TICK_GAP) / pitchX));
      const rows = Math.ceil(count / perRow);
      const h = Math.max(pitchY, rows * pitchY - TICK_GAP);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        ctx.fillRect((i % perRow) * pitchX, Math.floor(i / perRow) * pitchY, TICK_W, TICK_H);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [count, color]);

  return (
    <div ref={wrapRef} className="ticks" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

// The confirmed / resolved gates stay as real elements — they are small,
// and the 14 confirmed findings must be focusable and clickable.
function TickButtons({
  count,
  variant,
  selected,
  onPick,
}: {
  count: number;
  variant: "confirmed" | "resolved";
  selected?: number | null;
  onPick?: (index: number) => void;
}) {
  const interactive = variant === "confirmed" && !!onPick;
  return (
    <div className={`ticks ticks--lg ticks--${variant}`} role={interactive ? "list" : undefined}>
      {Array.from({ length: count }, (_, i) =>
        interactive ? (
          <button
            key={i}
            type="button"
            role="listitem"
            className={`tick tick--btn${selected === i ? " is-selected" : ""}`}
            aria-label={FINDING_NAMES[i] ?? `Confirmed finding ${i + 1}`}
            aria-pressed={selected === i}
            onMouseEnter={() => onPick?.(i)}
            onFocus={() => onPick?.(i)}
            onClick={() => onPick?.(i)}
          />
        ) : (
          <span key={i} className="tick" aria-hidden="true" />
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL REVEAL
// ─────────────────────────────────────────────────────────────────────────────

function Rise({
  children,
  delay = 0,
  className = "",
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(14px)",
        transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — scoped under .lp so nothing leaks into the app shell.
// ─────────────────────────────────────────────────────────────────────────────

const LP_CSS = `
.lp{
  --paper:${C.paper}; --paper-2:${C.paper2}; --paper-3:${C.paper3};
  --ink:${C.ink}; --ink-2:${C.ink2}; --ink-3:${C.ink3};
  --rule:${C.rule}; --rule-2:${C.rule2};
  --dark:${C.dark}; --dark-2:${C.dark2}; --dark-rule:${C.darkRule};
  --dark-tx:${C.darkTx}; --dark-tx-2:${C.darkTx2};
  --ochre:${C.ochre}; --clay:${C.clay}; --emerald:${C.emerald};
  --pad:clamp(20px,5vw,64px);
  --nav-h:62px;
  --display:"Archivo",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --body:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;

  background:var(--paper); color:var(--ink);
  font-family:var(--body); font-size:16px; line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
.lp *{box-sizing:border-box}
.lp h1,.lp h2,.lp h3,.lp h4,.lp p,.lp ul,.lp figure{margin:0;padding:0}
.lp ul{list-style:none}
.lp a{color:inherit}
.lp :focus-visible{outline:2px solid currentColor;outline-offset:3px}
.lp [id]{scroll-margin-top:calc(var(--nav-h) + 16px)}

.lp .wrap{max-width:1180px;margin:0 auto;padding-left:var(--pad);padding-right:var(--pad)}

.lp .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ink-3);display:flex;align-items:center;gap:9px;margin-bottom:20px}
.lp .eyebrow::before{content:"";width:22px;height:1px;background:currentColor;flex:none}
.lp .eyebrow.on-dark{color:var(--dark-tx-2)}

.lp h1,.lp h2,.lp h3{font-family:var(--display);font-weight:700;letter-spacing:-.024em;line-height:1.06}
.lp h1{font-size:clamp(36px,5.2vw,64px)}
.lp h2{font-size:clamp(28px,3.6vw,44px)}
.lp h3{font-size:19px;letter-spacing:-.015em;line-height:1.25}
.lp .lede{font-size:clamp(16px,1.35vw,18.5px);color:var(--ink-2);max-width:60ch}
.lp .band--dark .lede{color:var(--dark-tx-2)}

/* nav */
.lp-nav{position:sticky;top:0;z-index:50;background:color-mix(in srgb, ${C.paper} 88%, transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--rule)}
@supports not (background: color-mix(in srgb, red 50%, transparent)){
  .lp-nav{background:rgba(251,251,252,.92)}
}
.lp-nav .wrap{display:flex;align-items:center;gap:30px;height:var(--nav-h)}
.lp .mark{font-family:var(--display);font-weight:700;font-size:17px;letter-spacing:-.03em;
  display:flex;align-items:baseline;gap:7px;text-decoration:none;color:var(--ink)}
.lp .mark s{text-decoration:none;font-family:var(--mono);font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-3);font-weight:400}
.lp .navlinks{display:flex;gap:24px;margin-left:auto}
.lp .navlinks a{font-size:14px;color:var(--ink-2);text-decoration:none}
.lp .navlinks a:hover{color:var(--ink)}
.lp .nav-end{display:flex;gap:12px;align-items:center;margin-left:auto}
.lp .navlinks + .nav-end{margin-left:24px}
.lp .nav-login{font-size:13.5px;color:var(--ink-2);text-decoration:none}
.lp .nav-login:hover{color:var(--ink)}
@media(max-width:900px){.lp .navlinks{display:none}}

/* buttons */
.lp .btn-lp{display:inline-flex;align-items:center;justify-content:center;gap:9px;
  font-family:var(--body);font-size:15px;font-weight:500;padding:11px 20px;
  border:1px solid var(--ink);background:var(--ink);color:var(--paper-2);
  text-decoration:none;cursor:pointer;transition:background .16s,transform .16s,opacity .16s}
.lp .btn-lp:hover{background:#000;transform:translateY(-1px)}
.lp .btn-lp:disabled{opacity:.55;cursor:not-allowed;transform:none}
.lp .btn-lp.ghost{background:transparent;color:var(--ink);border-color:var(--rule)}
.lp .btn-lp.ghost:hover{background:transparent;border-color:var(--ink)}
.lp .btn-lp.pale{background:var(--paper-2);color:var(--ink);border-color:var(--paper-2)}
.lp .btn-lp.pale:hover{background:#fff}
.lp .btn-lp.sm{font-size:13.5px;padding:8px 15px}

/* bands */
.lp .band{padding:clamp(64px,8vw,110px) 0}
.lp .band--tight{padding:clamp(46px,5vw,68px) 0}
.lp .band--dark{background:var(--dark);color:var(--dark-tx)}
.lp .band--dark h2,.lp .band--dark h3{color:#fff}
.lp .band--rule{border-top:1px solid var(--rule)}

/* hero */
.lp .hero-lp{position:relative;padding:clamp(58px,7vw,92px) 0 clamp(30px,4vw,46px);overflow:hidden}
.lp .hero-lp .wrap{position:relative;z-index:2}
.lp .hero-canvas-bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:hidden}
.lp .hero-canvas-bg canvas{display:block;width:100%;height:100%}
.lp .hero-lp h1{max-width:17ch}
.lp .hero-benefit{color:var(--ink-2);font-weight:600}
.lp .hero-slot{position:relative}
.lp .hero-word{display:block}
.lp .hero-word.anim{animation:lpHeroIn .42s cubic-bezier(.22,1,.36,1) both}
@keyframes lpHeroIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.lp .hero-counter{display:flex;align-items:center;gap:14px;margin-top:20px;
  font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.08em}
.lp .hero-dots{display:flex;gap:6px}
.lp .hero-dot{width:20px;height:8px;padding:3px 0;background:none;border:0;cursor:pointer;
  display:block;position:relative}
.lp .hero-dot::after{content:"";display:block;height:2px;background:var(--rule);transition:background .2s}
.lp .hero-dot[aria-current="true"]::after{background:var(--ink)}
.lp .hero-dot:hover::after{background:var(--ink-2)}
.lp .hero-pause{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  background:none;border:0;color:var(--ink-3);cursor:pointer;padding:2px 0}
.lp .hero-pause:hover{color:var(--ink)}
.lp .hero-lp .lede{margin-top:24px}
.lp .cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}
.lp .assur{display:flex;gap:22px;flex-wrap:wrap;margin-top:22px;
  font-family:var(--mono);font-size:11.5px;color:var(--ink-3);letter-spacing:.02em}
.lp .assur li{display:flex;align-items:center;gap:7px}
.lp .assur li::before{content:"";width:5px;height:5px;background:var(--ink);flex:none}

/* sieve */
.lp .sieve-band{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);
  background:var(--paper-3);padding:clamp(38px,4.5vw,56px) 0 clamp(30px,3.5vw,44px)}
.lp .sieve{display:flex;gap:clamp(14px,2.4vw,34px);align-items:flex-start}
.lp .gate{flex:1;min-width:0;border-top:2px solid var(--ink);padding-top:14px}
.lp .gate h3{font-size:15px;font-weight:600;letter-spacing:-.01em;margin-bottom:3px}
.lp .gate-n{font-family:var(--mono);font-size:clamp(19px,2.1vw,26px);font-weight:500;
  letter-spacing:-.03em;display:block;line-height:1.1;margin-bottom:2px}
.lp .gate-cap{font-size:12.5px;color:var(--ink-2);line-height:1.4;min-height:2.8em}
.lp .ticks{display:flex;flex-wrap:wrap;gap:1px;margin-top:16px;align-content:flex-start}
.lp .ticks canvas{display:block;max-width:100%}
.lp .tick{width:${TICK_W}px;height:${TICK_H}px;flex:none;border:0;padding:0}
.lp .ticks--lg .tick{width:7px;height:5px}
.lp .ticks--confirmed .tick{background:var(--clay)}
.lp .ticks--resolved .tick{background:var(--emerald)}
.lp .tick--btn{cursor:pointer;appearance:none}
.lp .tick--btn:hover,.lp .tick--btn.is-selected{outline:2px solid var(--clay);outline-offset:2px}
.lp .legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:22px;
  font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.lp .legend li{display:flex;align-items:center;gap:7px}
.lp .legend i{width:9px;height:6px;display:block;flex:none}
.lp .sieve-foot{display:flex;gap:18px;align-items:baseline;margin-top:16px;
  padding-top:16px;border-top:1px solid var(--rule-2);flex-wrap:wrap}
.lp .readout{font-family:var(--mono);font-size:12.5px;color:var(--clay);min-height:1.4em;flex:1;min-width:240px}
.lp .readout[data-empty="true"]{color:var(--ink-3)}
.lp .sieve-note{font-size:12.5px;color:var(--ink-3);max-width:46ch}
@media(max-width:820px){
  .lp .sieve{flex-direction:column;gap:0}
  .lp .gate{width:100%;border-top:1px solid var(--rule);padding:16px 0}
  .lp .gate:first-child{border-top:2px solid var(--ink)}
  .lp .gate-cap{min-height:0}
  .lp .ticks{margin-top:10px}
}

/* tables */
.lp .tbl{width:100%;border-collapse:collapse;margin-top:34px}
.lp .tbl th{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--ink-3);font-weight:400;text-align:left;padding:0 16px 10px 0;border-bottom:1px solid var(--ink)}
.lp .tbl td{padding:15px 16px 15px 0;border-bottom:1px solid var(--rule-2);
  font-size:14.5px;color:var(--ink-2);vertical-align:top}
.lp .tbl tbody tr:hover td{background:var(--paper-2)}
.lp .tbl td:first-child{color:var(--ink);font-weight:600;font-family:var(--display);
  letter-spacing:-.01em;position:relative;padding-left:14px}
.lp .tbl td:first-child::before{content:"";position:absolute;left:0;top:17px;width:4px;height:4px;background:var(--ink)}
.lp .chip{display:inline-block;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;
  text-transform:uppercase;padding:3px 7px;border:1px solid var(--rule);color:var(--ink-3);white-space:nowrap}
.lp .chip.now{border-color:var(--ink);color:var(--ink)}
.lp .chip.soon{border-color:var(--ochre);color:var(--ochre)}
.lp .trust-tbl td:first-child{max-width:24ch}
.lp .trust-tbl td:last-child{text-align:right;white-space:nowrap}
@media(max-width:760px){
  .lp .tbl,.lp .tbl tbody,.lp .tbl tr,.lp .tbl td{display:block;width:100%}
  .lp .tbl thead{display:none}
  .lp .tbl tbody tr{border-bottom:1px solid var(--rule);padding:16px 0}
  .lp .tbl td{border:0;padding:2px 0}
  .lp .tbl td:first-child{padding-left:14px;margin-bottom:6px;max-width:none}
  .lp .trust-tbl td:last-child{text-align:left;margin-top:8px}
}

/* output panel */
.lp .split{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);
  gap:clamp(32px,5vw,72px);align-items:start}
@media(max-width:960px){.lp .split{grid-template-columns:1fr}}
.lp .panel{border:1px solid var(--dark-rule);background:var(--dark-2)}
.lp .panel-hd{padding:14px 18px;border-bottom:1px solid var(--dark-rule);
  display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.lp .panel-hd .sev{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;
  text-transform:uppercase;color:#fff;background:var(--clay);padding:3px 8px}
.lp .panel-hd b{font-family:var(--display);font-size:15px;font-weight:600;color:#fff}
.lp .panel-meta{font-family:var(--mono);font-size:11px;color:var(--dark-tx-2);
  padding:11px 18px;border-bottom:1px solid var(--dark-rule);display:flex;gap:14px;flex-wrap:wrap}
.lp .panel-body{padding:18px}
.lp .panel-body p{font-size:14.5px;color:var(--dark-tx);margin-bottom:14px}
.lp .panel-body p:last-child{margin-bottom:0}
.lp code{font-family:var(--mono);font-size:12.5px;background:#06080A;
  border:1px solid var(--dark-rule);padding:1px 5px;color:var(--dark-tx)}
.lp .panel-tabs{display:flex;border-block:1px solid var(--dark-rule);overflow-x:auto;scrollbar-width:none}
.lp .panel-tabs::-webkit-scrollbar{display:none}
.lp .panel-tab{flex:none;font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;
  color:var(--dark-tx-2);background:transparent;border:0;border-bottom:2px solid transparent;
  padding:10px 14px;cursor:pointer;white-space:nowrap;transition:color .15s,border-color .15s}
.lp .panel-tab:hover{color:var(--dark-tx)}
.lp .panel-tab[aria-selected="true"]{color:#fff;border-bottom-color:#fff}
.lp .panel-slides{padding:16px 18px;min-height:172px}
.lp .panel-slide{font-size:13.5px;color:var(--dark-tx)}
.lp .panel-slide.anim{animation:lpSlideIn .32s cubic-bezier(.22,1,.36,1) both}
@keyframes lpSlideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.lp .panel-slide p{margin-bottom:10px;line-height:1.55}
.lp .panel-slide p:last-child{margin-bottom:0}
.lp .panel-slide pre{font-family:var(--mono);font-size:12px;background:#06080A;
  border:1px solid var(--dark-rule);padding:12px 14px;margin:10px 0;overflow-x:auto;line-height:1.6}
.lp .diff-rem{color:#E8897C;display:block}
.lp .diff-add{color:#6FBF9B;display:block}
.lp .field-row{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--dark-rule);flex-wrap:wrap}
.lp .field-row:last-child{border-bottom:0}
.lp .field-label{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--dark-tx-2);min-width:74px;padding-top:2px;flex:none}
.lp .field-val{font-size:13px;color:var(--dark-tx)}
.lp .chip-jira{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.06em;
  padding:2px 6px;border:1px solid var(--dark-rule);color:var(--dark-tx-2);margin-right:6px}
.lp .agent-line{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--dark-rule);align-items:flex-start}
.lp .agent-line:last-child{border-bottom:0}
.lp .agent-q{font-family:var(--mono);font-size:10px;font-weight:500;padding:2px 6px;
  background:var(--dark-rule);color:var(--dark-tx);flex:none;letter-spacing:.08em;margin-top:1px}
.lp .agent-line p{font-size:13px;line-height:1.5;margin:0}

/* work list */
.lp .work{margin-top:20px;border-top:1px solid var(--rule)}
.lp .work-item{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1.15fr);
  gap:clamp(18px,3vw,44px);padding:30px 0;border-bottom:1px solid var(--rule)}
.lp .work-k{font-family:var(--mono);font-size:11px;color:var(--ink-3);letter-spacing:.1em;padding-top:5px}
.lp .work-item h3{position:relative;padding-left:16px}
.lp .work-item h3::before{content:"";position:absolute;left:0;top:7px;width:5px;height:5px;background:var(--ink)}
.lp .work-item p{font-size:14.5px;color:var(--ink-2)}
.lp .work-item ul{margin-top:14px;display:flex;flex-wrap:wrap;gap:7px}
.lp .work-item li{font-family:var(--mono);font-size:11.5px;color:var(--ink-2);
  border:1px solid var(--rule);padding:3px 8px;background:var(--paper-2)}
@media(max-width:860px){.lp .work-item{grid-template-columns:1fr;gap:12px}.lp .work-k{padding:0}}

/* team */
.lp .team-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
  gap:1px;background:var(--rule);border:1px solid var(--rule);margin-top:34px}
.lp .team-grid > div{background:var(--paper-2);padding:22px}
.lp .team-grid h3{font-size:15px;margin-bottom:5px}
.lp .team-role{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-3);display:block;margin-bottom:12px}
.lp .team-grid p{font-size:13.5px;color:var(--ink-2)}

/* final cta + footer */
.lp .final-band{background:var(--ink);color:var(--paper-2);padding:clamp(56px,7vw,92px) 0}
.lp .final-band h2{color:#fff;max-width:16ch}
.lp .lp-sub{color:var(--dark-tx-2);max-width:52ch;margin-top:18px;font-size:15.5px}
.lp .lp-form{display:flex;gap:9px;margin-top:30px;flex-wrap:wrap;max-width:520px}
.lp .lp-form input{flex:1;min-width:220px;background:transparent;border:1px solid #333D46;
  color:#fff;padding:11px 14px;font-family:var(--mono);font-size:13.5px}
.lp .lp-form input::placeholder{color:#5C6874}
.lp .lp-form input:focus-visible{border-color:var(--dark-tx);outline-offset:1px}
.lp .final-note{display:block;margin-top:16px;font-size:12.5px;color:#5C6874}
.lp .foot-lp{background:var(--ink);color:var(--dark-tx-2);border-top:1px solid #1D2126;
  padding:44px 0 30px;font-size:13.5px}
.lp .foot-grid{display:grid;grid-template-columns:1.6fr repeat(3,1fr);gap:32px}
@media(max-width:760px){.lp .foot-grid{grid-template-columns:1fr 1fr}}
.lp .foot-lp h4{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;
  color:#5C6874;font-weight:400;margin-bottom:12px}
.lp .foot-lp a{display:block;color:var(--dark-tx-2);text-decoration:none;padding:3px 0}
.lp .foot-lp a:hover{color:#fff}
.lp .foot-lp .mark{color:#fff;margin-bottom:10px}
.lp .foot-lp .mark s{color:#5C6874}
.lp .foot-btm{margin-top:38px;padding-top:20px;border-top:1px solid #1D2126;
  display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;
  font-family:var(--mono);font-size:11.5px;color:#4D5761}

.lp .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

@media(prefers-reduced-motion:reduce){
  .lp *,.lp *::before,.lp *::after{animation-duration:.001ms!important;transition-duration:.001ms!important}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeLandingPage() {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [readoutIdx, setReadoutIdx] = React.useState<number | null>(null);

  // ── hero rotator ───────────────────────────────────────────────────────────
  const [heroIdx, setHeroIdx] = React.useState(0);
  const [heroSeq, setHeroSeq] = React.useState(0); // bumps to restart the animation
  const [paused, setPaused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const rotating = HERO_ROTATE && !reducedMotion && !paused;

  React.useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO_LINES.length);
      setHeroSeq((k) => k + 1);
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(id);
    // heroIdx in deps resets the timer after a manual pick, so a click never
    // gets clobbered a moment later by a nearly-expired interval.
  }, [rotating, heroIdx]);

  const pickHero = (i: number) => {
    setHeroIdx(i);
    setHeroSeq((k) => k + 1);
  };

  // ── output panel tabs ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<PanelTab>("Review patch diff");
  const [tabSeq, setTabSeq] = React.useState(0);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const switchTab = (tab: PanelTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setTabSeq((k) => k + 1);
  };

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % PANEL_TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + PANEL_TABS.length) % PANEL_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = PANEL_TABS.length - 1;
    else return;
    e.preventDefault();
    switchTab(PANEL_TABS[next]);
    tabRefs.current[next]?.focus();
  };

  // ── early access ───────────────────────────────────────────────────────────
  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      toast.error("That email address doesn't look right", {
        description: "Use a work address we can reply to, like you@company.com.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(EARLY_ACCESS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: "landing" }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      toast.success("Request received", {
        description: "We'll reply within two business days with a scheduling link.",
      });
      setEmail("");
    } catch {
      toast.error("We couldn't submit that", {
        description: "Try again in a moment, or email founders@sigmasec.ai directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hero = HERO_LINES[heroIdx];

  return (
    <div className="lp">
      {/* React 19 hoists this into <head>. Move to next/font when convenient. */}
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: LP_CSS }} />

      {/* ── NAV ── */}
      <nav className="lp-nav" aria-label="Primary">
        <div className="wrap">
          <a className="mark" href="#top">
            SigmaSec <s>Posture Intelligence</s>
          </a>
          <div className="navlinks">
            <a href="#sieve">The sieve</a>
            <a href="#scanners">Scanners</a>
            <a href="#answer">Output</a>
            <a href="#trust">Data handling</a>
          </div>
          <div className="nav-end">
            <Link href="/login" className="nav-login">
              Log in
            </Link>
            <a className="btn-lp sm" href="#pilot">
              Request a pilot
            </a>
          </div>
        </div>
      </nav>

      <main>
        {/* ── HERO ── */}
        <header className="hero-lp" id="top">
          <CyberNetworkBg />
          <div className="wrap">
            <Rise>
              <p className="eyebrow">Pilot deployment · 20 assets · week of 17 Aug 2026</p>

              <h1 className="hero-slot">
                <span key={heroSeq} className={rotating ? "hero-word anim" : "hero-word"}>
                  {hero.pre}
                  <span className="hero-benefit">{hero.benefit}</span>
                </span>
              </h1>

              {HERO_ROTATE && (
                <div className="hero-counter">
                  <span>
                    {String(heroIdx + 1).padStart(2, "0")} / {String(HERO_LINES.length).padStart(2, "0")}
                  </span>
                  <div className="hero-dots">
                    {HERO_LINES.map((line, i) => (
                      <button
                        key={i}
                        type="button"
                        className="hero-dot"
                        aria-current={i === heroIdx}
                        aria-label={`Show headline ${i + 1}: ${line.pre}${line.benefit}`}
                        onClick={() => pickHero(i)}
                      />
                    ))}
                  </div>
                  {!reducedMotion && (
                    <button type="button" className="hero-pause" onClick={() => setPaused((p) => !p)}>
                      {paused ? "Play" : "Pause"}
                    </button>
                  )}
                </div>
              )}

              <p className="lede">
                SigmaSec runs Nuclei, Trivy, Gitleaks and Opengrep against your code and infrastructure,
                then spends the rest of its time taking findings away — matching each one against exploit
                intelligence, checking whether the vulnerable path is reachable, and confirming it before an
                engineer ever sees it.
              </p>

              <div className="cta-row">
                <a className="btn-lp" href="#pilot">
                  Request a pilot scan
                </a>
                <a className="btn-lp ghost" href="#sieve">
                  See how ranking works
                </a>
              </div>

              <ul className="assur">
                <li>Your code stays in your environment</li>
                <li>No training on customer data</li>
                <li>India data residency available</li>
              </ul>
            </Rise>
          </div>
        </header>

        {/* ── THE SIEVE ── */}
        <section className="sieve-band" id="sieve" aria-labelledby="sieve-h">
          <div className="wrap">
            <Rise>
              <p className="eyebrow" id="sieve-h">
                One repository, one week — every mark is one finding
              </p>
            </Rise>

            <div className="sieve">
              <Rise delay={0} className="gate">
                <h3>Discover</h3>
                <span className="gate-n">1,204</span>
                <p className="gate-cap">Four engines run in parallel across code, containers and endpoints.</p>
                <TickCanvas count={1204} color={C.tick1} />
              </Rise>

              <Rise delay={55} className="gate">
                <h3>Enrich</h3>
                <span className="gate-n">399</span>
                <p className="gate-cap">Critical or high once scored against KEV, EPSS and CVSS together.</p>
                <TickCanvas count={399} color={C.tick2} />
              </Rise>

              <Rise delay={110} className="gate">
                <h3>Prioritise</h3>
                <span className="gate-n">86</span>
                <p className="gate-cap">The vulnerable function is actually reachable from your entry points.</p>
                <TickCanvas count={86} color={C.ochre} />
              </Rise>

              <Rise delay={165} className="gate">
                <h3>Confirm</h3>
                <span className="gate-n">14</span>
                <p className="gate-cap">Exploited in a sandbox against your build. Evidence attached.</p>
                <TickButtons count={14} variant="confirmed" selected={readoutIdx} onPick={setReadoutIdx} />
              </Rise>

              <Rise delay={220} className="gate">
                <h3>Act</h3>
                <span className="gate-n">7</span>
                <p className="gate-cap">Already had a pull request open when the engineer arrived.</p>
                <TickButtons count={7} variant="resolved" />
              </Rise>
            </div>

            <ul className="legend">
              <li>
                <i style={{ background: C.tick1 }} />
                Unranked
              </li>
              <li>
                <i style={{ background: C.ochre }} />
                Reachable — needs a decision
              </li>
              <li>
                <i style={{ background: C.clay }} />
                Exploitable — confirmed
              </li>
              <li>
                <i style={{ background: C.emerald }} />
                Patch open
              </li>
            </ul>

            <div className="sieve-foot">
              <p className="readout" aria-live="polite" data-empty={readoutIdx === null}>
                {readoutIdx === null ? "Select a confirmed finding to read it." : FINDING_NAMES[readoutIdx]}
              </p>
              <p className="sieve-note">
                Every other platform shows you the first bar. The product is the last one.
              </p>
            </div>
          </div>
        </section>

        {/* ── SCANNERS ── */}
        <section className="band" id="scanners" aria-labelledby="scanners-h">
          <div className="wrap">
            <Rise>
              <p className="eyebrow">Coverage</p>
              <h2 id="scanners-h">
                What each engine reads,
                <br />
                and what it feeds.
              </h2>
              <p className="lede" style={{ marginTop: 20 }}>
                We consume best-in-class open source rather than rewriting it. The value is in what happens
                after the output lands: one finding model, one deduplication pass, one ranked queue.
              </p>
            </Rise>

            <Rise delay={80}>
              <table className="tbl">
                <caption className="sr-only">Scanning engines, their inputs and outputs</caption>
                <thead>
                  <tr>
                    <th scope="col">Engine</th>
                    <th scope="col">Reads</th>
                    <th scope="col">Feeds</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Trivy</td>
                    <td>Lockfiles, manifests, container image layers</td>
                    <td>Dependency graph and SBOM</td>
                    <td><span className="chip now">Live</span></td>
                  </tr>
                  <tr>
                    <td>Gitleaks</td>
                    <td>Working tree and full commit history</td>
                    <td>Credential validation queue</td>
                    <td><span className="chip now">Live</span></td>
                  </tr>
                  <tr>
                    <td>Nuclei</td>
                    <td>Deployed web and network surface</td>
                    <td>Internet-facing exposure map</td>
                    <td><span className="chip now">Live</span></td>
                  </tr>
                  <tr>
                    <td>Opengrep</td>
                    <td>Your own source, as an AST</td>
                    <td>Reachability from entry points</td>
                    <td><span className="chip soon">Rolling out</span></td>
                  </tr>
                  <tr>
                    <td>Nmap</td>
                    <td>Ports and service banners</td>
                    <td>Asset inventory</td>
                    <td><span className="chip now">Live</span></td>
                  </tr>
                </tbody>
              </table>
            </Rise>
          </div>
        </section>

        {/* ── THE ANSWER ── */}
        <section className="band band--dark" id="answer" aria-labelledby="answer-h">
          <div className="wrap">
            <div className="split">
              <Rise>
                <p className="eyebrow on-dark">The output</p>
                <h2 id="answer-h">A finding is not an answer.</h2>
                <p className="lede" style={{ marginTop: 22 }}>
                  A CVE identifier and a severity label tell an engineer almost nothing about what to do next.
                  Every finding that reaches your queue arrives with the reasoning behind its rank, the specific
                  fix, and the patch already written.
                </p>
                <p className="lede" style={{ marginTop: 16 }}>
                  This is what your team reads at nine in the morning — not a spreadsheet export.
                </p>
              </Rise>

              <Rise delay={80}>
                <div className="panel">
                  <div className="panel-hd">
                    <span className="sev">Exploitable</span>
                    <b>Weak key exchange on SSH service</b>
                  </div>
                  <div className="panel-meta">
                    <span>CVE-2024-31497</span>
                    <span>EPSS 0.82</span>
                    <span>KEV listed</span>
                    <span>api-internal-22</span>
                    <span>Internet-facing</span>
                  </div>
                  <div className="panel-body">
                    <p>
                      This SSH server accepts a key exchange algorithm your client will negotiate down to. An
                      attacker positioned between client and server can bypass session key establishment and
                      intercept the connection. We confirmed it against your staging build on 18 Aug.
                    </p>
                    <p>
                      Remediation: remove <code>diffie-hellman-group1-sha1</code> from{" "}
                      <code>/etc/ssh/sshd_config</code> and restart. No client compatibility impact expected —
                      all observed clients negotiated a stronger algorithm in the last 90 days.
                    </p>
                  </div>

                  <div className="panel-tabs" role="tablist" aria-label="Actions on this finding">
                    {PANEL_TABS.map((label, i) => (
                      <button
                        key={label}
                        ref={(el) => {
                          tabRefs.current[i] = el;
                        }}
                        id={`tab-${i}`}
                        role="tab"
                        type="button"
                        className="panel-tab"
                        aria-selected={activeTab === label}
                        aria-controls="panel-slide"
                        tabIndex={activeTab === label ? 0 : -1}
                        onClick={() => switchTab(label)}
                        onKeyDown={(e) => onTabKeyDown(e, i)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div
                    className="panel-slides"
                    id="panel-slide"
                    role="tabpanel"
                    aria-labelledby={`tab-${PANEL_TABS.indexOf(activeTab)}`}
                    tabIndex={0}
                  >
                    <div key={tabSeq} className="panel-slide anim">
                      {activeTab === "Review patch diff" && (
                        <>
                          <p>
                            Patch generated for <code>diffie-hellman-group1-sha1</code> removal. Changes scoped
                            to sshd_config only — no application code touched.
                          </p>
                          <pre>
                            <span className="diff-rem">- KexAlgorithms +diffie-hellman-group1-sha1</span>
                            <span className="diff-add">
                              + KexAlgorithms curve25519-sha256,ecdh-sha2-nistp256
                            </span>
                          </pre>
                          <p>1 file changed, 1 insertion, 1 deletion. Ready to open as a pull request.</p>
                        </>
                      )}

                      {activeTab === "Open pull request" && (
                        <>
                          <div className="field-row">
                            <span className="field-label">Title</span>
                            <span className="field-val">
                              fix: remove weak SSH key exchange algorithm (CVE-2024-31497)
                            </span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Branch</span>
                            <span className="field-val">sigmasec/fix-cve-2024-31497</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Base</span>
                            <span className="field-val">main</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Files</span>
                            <span className="field-val">infra/sshd_config</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Labels</span>
                            <span className="field-val">
                              <span className="chip-jira">security</span>
                              <span className="chip-jira">sigmasec-auto</span>
                            </span>
                          </div>
                        </>
                      )}

                      {activeTab === "Create Jira ticket" && (
                        <>
                          <div className="field-row">
                            <span className="field-label">Project</span>
                            <span className="field-val">SEC</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Type</span>
                            <span className="field-val">Security bug</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Priority</span>
                            <span className="field-val">Critical</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Summary</span>
                            <span className="field-val">
                              CVE-2024-31497 — weak SSH key exchange on api-internal-22 (KEV listed, EPSS 0.82)
                            </span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Assignee</span>
                            <span className="field-val">Unassigned (infrastructure team)</span>
                          </div>
                          <div className="field-row">
                            <span className="field-label">Labels</span>
                            <span className="field-val">
                              <span className="chip-jira">sigmasec-auto</span>
                              <span className="chip-jira">kev-listed</span>
                            </span>
                          </div>
                        </>
                      )}

                      {activeTab === "Ask the agent" && (
                        <>
                          <div className="agent-line">
                            <span className="agent-q">Q</span>
                            <p>Is this exploitable without an active machine-in-the-middle position?</p>
                          </div>
                          <div className="agent-line">
                            <span className="agent-q">A</span>
                            <p>
                              No — the downgrade requires active interception. The server is internet-facing,
                              though, which makes opportunistic positioning realistic.
                            </p>
                          </div>
                          <div className="agent-line">
                            <span className="agent-q">Q</span>
                            <p>Will removing this algorithm break any existing clients?</p>
                          </div>
                          <div className="agent-line">
                            <span className="agent-q">A</span>
                            <p>
                              Unlikely. SSH session logs show no client negotiated
                              diffie-hellman-group1-sha1 in the past 90 days.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Rise>
            </div>
          </div>
        </section>

        {/* ── WHERE THE WORK GOES ── */}
        <section className="band" aria-labelledby="work-h">
          <div className="wrap">
            <Rise>
              <p className="eyebrow">Where the work actually goes</p>
              <h2 id="work-h">Three things, done properly.</h2>
              <p className="lede" style={{ marginTop: 20 }}>
                Aggregating scanners is easy, and most tools stop there. Deciding which findings deserve an
                engineer is the hard part.
              </p>
            </Rise>

            <div className="work">
              <Rise delay={0} className="work-item">
                <p className="work-k">01 / MEASURE</p>
                <div>
                  <h3>One model across every engine</h3>
                </div>
                <div>
                  <p>
                    Web endpoints, container images, dependencies, committed secrets and application code all
                    resolve to a single finding shape, coordinated in one run. Duplicates across engines
                    collapse into one record instead of stacking up four times in your queue.
                  </p>
                  <ul>
                    <li>Deterministic dedup by fingerprint</li>
                    <li>One severity scale</li>
                    <li>Asset-linked, not scan-linked</li>
                  </ul>
                </div>
              </Rise>

              <Rise delay={55} className="work-item">
                <p className="work-k">02 / DECIDE</p>
                <div>
                  <h3>Intelligence that changes the answer</h3>
                </div>
                <div>
                  <p>
                    Severity tells you a vulnerability could exist. We tell you whether it can be reached and
                    exploited in your code — which is what actually determines whether anyone should care.
                    Findings that survive both tests rise to the top of the queue.
                  </p>
                  <ul>
                    <li>CISA KEV — known exploited</li>
                    <li>FIRST EPSS — probability of exploitation</li>
                    <li>NVD CVSS — baseline severity</li>
                    <li>AST reachability from entry points</li>
                    <li>Sandbox exploit validation</li>
                  </ul>
                </div>
              </Rise>

              <Rise delay={110} className="work-item">
                <p className="work-k">03 / EXPLAIN</p>
                <div>
                  <h3>AI that guides, not guesses</h3>
                </div>
                <div>
                  <p>
                    Not a summary of the CVE description. A plain-English explanation of the risk in your
                    context, the specific remediation, and a pull request you can review and merge. Every
                    generated change carries an audit trail back to the evidence that produced it.
                  </p>
                  <ul>
                    <li>Plain-English explanation</li>
                    <li>Step-by-step remediation</li>
                    <li>Patch scoped to your findings</li>
                    <li>Diff preview before merge</li>
                  </ul>
                </div>
              </Rise>
            </div>
          </div>
        </section>

        {/* ── TRUST ── */}
        <section className="band band--rule" id="trust" aria-labelledby="trust-h">
          <div className="wrap">
            <Rise>
              <p className="eyebrow">Data handling</p>
              <h2 id="trust-h">
                Your source code is the most
                <br />
                sensitive thing you own.
              </h2>
              <p className="lede" style={{ marginTop: 20 }}>
                Every security team asks the same first question about an AI product: where does my code go?
                Here is the complete answer, in the order it usually gets asked.
              </p>
            </Rise>

            <Rise delay={80}>
              <table className="tbl trust-tbl">
                <caption className="sr-only">Data handling questions and answers</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Answer</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Where does scanning run?</td>
                    <td>
                      Scanning and reachability analysis run inside your own infrastructure. We receive finding
                      metadata, not your repository.
                    </td>
                    <td><span className="chip now">Available today</span></td>
                  </tr>
                  <tr>
                    <td>Do you train on our data?</td>
                    <td>
                      No. Customer data is never used to train models. Inference runs under zero-retention terms
                      with our model providers.
                    </td>
                    <td><span className="chip now">Contractual</span></td>
                  </tr>
                  <tr>
                    <td>Where is metadata stored?</td>
                    <td>
                      You choose. India-region hosting for DPDP Act 2023 obligations, or a region of your choice.
                    </td>
                    <td><span className="chip now">Available today</span></td>
                  </tr>
                  <tr>
                    <td>Are you SOC 2 audited?</td>
                    <td>
                      Cryptographic audit logging and access controls are in place. The Type II audit is
                      scheduled — we will not claim certification before we hold it.
                    </td>
                    <td><span className="chip soon">In progress</span></td>
                  </tr>
                </tbody>
              </table>

              <p style={{ marginTop: 22, fontSize: 14 }}>
                <Link href="/help" style={{ borderBottom: `1px solid ${C.ink}`, textDecoration: "none" }}>
                  Read the full trust documentation
                </Link>{" "}
                <span style={{ color: C.ink3 }}>
                  — architecture diagram, subprocessor list, retention policy, incident response.
                </span>
              </p>
            </Rise>
          </div>
        </section>

        {/* ── TEAM ── */}
        <section className="band band--tight band--rule" aria-labelledby="team-h">
          <div className="wrap">
            <Rise>
              <p className="eyebrow">Who is building this</p>
              <h2 id="team-h">Small team, specific experience.</h2>
              <p className="lede" style={{ marginTop: 18 }}>
                We are pre-launch and building in the open. If you are evaluating us, talk to us directly.
              </p>
            </Rise>

            <Rise delay={80}>
              <div className="team-grid">
                <div>
                  <h3>Platform architecture</h3>
                  <span className="team-role">Co-founders</span>
                  <p>
                    Ex-AppSec leads and systems engineers who built autonomous triage and reachability analysis
                    for internal use before it was a product.
                  </p>
                </div>
                <div>
                  <h3>Engineering</h3>
                  <span className="team-role">Co-founders</span>
                  <p>
                    Program analysis, AST graph generation and agentic tool execution, with a background in
                    sandboxed build infrastructure.
                  </p>
                </div>
                <div>
                  <h3>Design partners</h3>
                  <span className="team-role">Currently onboarding</span>
                  <p>
                    A small number of security teams are shaping the roadmap with us. Named logos appear here
                    only once partners agree to be named.
                  </p>
                </div>
              </div>
            </Rise>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="final-band" id="pilot" aria-labelledby="pilot-h">
          <div className="wrap">
            <Rise>
              <p className="eyebrow on-dark">Private beta</p>
              <h2 id="pilot-h">Run it against one of your own repositories.</h2>
              <p className="lp-sub">
                You get a scoped scan of one repository, the prioritised queue it produces, and a walkthrough of
                how every finding in it was ranked. No credit card, no automated drip sequence.
              </p>

              <form className="lp-form" onSubmit={handleRequestAccess} noValidate>
                <label className="sr-only" htmlFor="lp-email">
                  Work email
                </label>
                <input
                  id="lp-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
                <button className="btn-lp pale" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending…" : "Request access"}
                </button>
              </form>

              <small className="final-note">We reply within two business days with a scheduling link.</small>
            </Rise>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="foot-lp">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <a className="mark" href="#top">
                SigmaSec <s>Posture Intelligence</s>
              </a>
              <p style={{ maxWidth: "34ch" }}>
                Unified scanning, real exploitability intelligence, and AI-authored remediation for teams tired
                of triaging noise.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#sieve">How it works</a>
              <a href="#scanners">Scanners</a>
              <a href="#answer">Remediation</a>
            </div>
            <div>
              <h4>Trust</h4>
              <a href="#trust">Data handling</a>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms of service</Link>
              <Link href="/security">Responsible disclosure</Link>
            </div>
            <div>
              <h4>Company</h4>
              <Link href="/help">Documentation</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
          <div className="foot-btm">
            <span>© {new Date().getFullYear()} SigmaSec</span>
            <span>Data isolated. Encrypted. Never shared.</span>
            <span>sigmasec.ai</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

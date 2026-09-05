import React, { useEffect, useRef, useState, useMemo } from 'react';
import { RITUAL_CONFIG } from './ritualConfig';

// Math & Easing Helpers
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

function easeInCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * c;
}

function easeOutBack(t: number): number {
  const c = clamp(t, 0, 1) - 1;
  const s = 1.70158;
  return 1 + c * c * ((s + 1) * c + s);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Two-Node Rig Component
 * - Outer node: Translation only `translate3d(x, y, 0)`.
 * - Inner node: Rotation & Scale with transform-origin fixed at sprite anchor.
 * Rotating the tool NEVER displaces its anchor/tip from (x, y).
 */
interface ToolRigProps {
  x: number;
  y: number;
  angle: number;
  scale?: number;
  opacity: number;
  elevation?: number; // 0 (contact) to 1 (high above stage)
  anchorLogical: { x: number; y: number };
  width: number;
  height: number;
  debug?: boolean;
  debugColor?: string;
  children: React.ReactNode;
}

const ToolRig: React.FC<ToolRigProps> = ({
  x,
  y,
  angle,
  scale = 1,
  opacity,
  elevation = 0.5,
  anchorLogical,
  width,
  height,
  debug = false,
  debugColor = '#00f0ff',
  children,
}) => {
  if (opacity <= 0.001) return null;

  // Elevation-dependent drop shadow
  const shadowDist = lerp(4, 24, elevation);
  const shadowBlur = lerp(6, 30, elevation);
  const shadowAlpha = lerp(0.55, 0.25, elevation);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        opacity,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `-${anchorLogical.x}px`,
          top: `-${anchorLogical.y}px`,
          width: `${width}px`,
          height: `${height}px`,
          transformOrigin: `${anchorLogical.x}px ${anchorLogical.y}px`,
          transform: `rotate(${angle}deg) scale(${scale})`,
          filter: `drop-shadow(${Math.sin((angle * Math.PI) / 180) * shadowDist + 2}px ${shadowDist}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha}))`,
        }}
      >
        {children}
        {debug && (
          <div
            style={{
              position: 'absolute',
              left: `${anchorLogical.x - 5}px`,
              top: `${anchorLogical.y - 5}px`,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: debugColor,
              border: '2px solid #ffffff',
              boxShadow: '0 0 6px #000',
              zIndex: 99,
            }}
          />
        )}
      </div>
    </div>
  );
};

export function PiercingRitualAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [time, setTime] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Preload and decode images on mount
  useEffect(() => {
    const urls = [
      RITUAL_CONFIG.logo.src,
      RITUAL_CONFIG.tools.cottonbuds.src,
      RITUAL_CONFIG.tools.marker.src,
      RITUAL_CONFIG.tools.mirror.src,
      ...RITUAL_CONFIG.tools.clamp.frames,
      RITUAL_CONFIG.tools.needle.src,
      RITUAL_CONFIG.tools.forecepwithjew.src,
    ];

    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    });

    // Media query check for reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ResizeObserver for 1:1 scale container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setScaleFactor(width / RITUAL_CONFIG.stageSize);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 60fps Deterministic RAF Loop (with optional ?t= URL param for freeze-frame inspection)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tParam = params.get('t');
    if (tParam !== null) {
      const parsed = parseFloat(tParam);
      if (!isNaN(parsed)) {
        setTime(parsed % RITUAL_CONFIG.durations.total);
        return;
      }
    }

    if (prefersReducedMotion) return;

    let animId: number;
    const startTime = performance.now();
    const totalMs = RITUAL_CONFIG.durations.total * 1000;

    const tick = (now: number) => {
      const elapsed = (now - startTime) % totalMs;
      setTime(elapsed / 1000);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [prefersReducedMotion]);

  // Derived logical dimensions & anchors for each tool
  const toolSpecs = useMemo(() => {
    const { tools } = RITUAL_CONFIG;

    const calcSpec = (t: {
      naturalWidth: number;
      naturalHeight: number;
      displayHeight: number;
      anchor: { x: number; y: number };
    }) => {
      const s = t.displayHeight / t.naturalHeight;
      return {
        width: t.naturalWidth * s,
        height: t.displayHeight,
        anchorLogical: { x: t.anchor.x * s, y: t.anchor.y * s },
      };
    };

    return {
      cottonbuds: calcSpec(tools.cottonbuds),
      marker: calcSpec(tools.marker),
      mirror: calcSpec(tools.mirror),
      clamp: calcSpec(tools.clamp),
      needle: calcSpec(tools.needle),
      forecepwithjew: calcSpec(tools.forecepwithjew),
    };
  }, []);

  // Deterministic state evaluation at time t
  const stageState = useMemo(() => {
    const t = time;
    const P = RITUAL_CONFIG.piercePoint;

    // Phase identification
    let phaseName = 'IDLE';
    if (t >= 1.5 && t < 3.5) phaseName = 'CLEAN';
    else if (t >= 3.5 && t < 5.5) phaseName = 'MARK';
    else if (t >= 5.5 && t < 7.5) phaseName = 'CHECK';
    else if (t >= 7.5 && t < 9.5) phaseName = 'CLAMP';
    else if (t >= 9.5 && t < 11.0) phaseName = 'PIERCE';
    else if (t >= 11.0 && t < 13.0) phaseName = 'JEWEL';
    else if (t >= 13.0) phaseName = 'REVEAL';

    // 1. Logo state (idle float + reactions)
    let logoY = Math.sin((t / 1.5) * Math.PI * 2) * 3;
    let logoScaleX = 1;
    let logoScaleY = 1;
    let logoRot = 0;
    let shadowScale = 1 + Math.sin((t / 1.5) * Math.PI * 2) * 0.04;
    let shadowOpacity = 0.35 - Math.sin((t / 1.5) * Math.PI * 2) * 0.05;

    // Mark contact squish (t ~ 4.25s)
    if (t >= 4.2 && t <= 4.5) {
      const p = (t - 4.2) / 0.3;
      const s = Math.sin(p * Math.PI);
      logoScaleX = 1 + s * 0.035;
      logoScaleY = 1 - s * 0.035;
    }

    // Mirror shy wiggle (t ~ 6.3s - 6.8s)
    if (t >= 6.3 && t <= 6.8) {
      const p = (t - 6.3) / 0.5;
      logoRot = Math.sin(p * Math.PI * 2) * 1.8;
    }

    // Needle micro-tremble (t ~ 9.9s - 10.2s)
    if (t >= 9.9 && t <= 10.2) {
      const p = (t - 9.9) / 0.3;
      logoY += Math.sin(p * Math.PI * 6) * 1.5;
    }

    // Jewel happy bounce (t ~ 11.5s - 12.1s)
    if (t >= 11.5 && t <= 12.1) {
      const p = (t - 11.5) / 0.6;
      logoY -= Math.sin(p * Math.PI) * 4.5;
      logoScaleX = 1 + Math.sin(p * Math.PI) * 0.02;
      logoScaleY = 1 + Math.sin(p * Math.PI) * 0.02;
    }

    // 2. Cotton Swab (1.5s -> 3.5s)
    let swab = { x: 420, y: 70, angle: -38, opacity: 0, elevation: 0.8 };
    if (t >= 1.5 && t < 3.5) {
      if (t < 2.0) {
        // Enter
        const p = easeOutCubic((t - 1.5) / 0.5);
        swab = {
          x: lerp(420, P.x, p),
          y: lerp(70, P.y, p),
          angle: lerp(-38, RITUAL_CONFIG.tools.cottonbuds.contactAngle, p),
          opacity: easeOutCubic((t - 1.5) / 0.25),
          elevation: lerp(0.8, 0, p),
        };
      } else if (t < 2.8) {
        // Swiping back and forth over PIERCE_POINT
        const p = (t - 2.0) / 0.8;
        const swipe = Math.sin(p * Math.PI * 4); // 2 full swipes
        swab = {
          x: P.x + swipe * 12,
          y: P.y + Math.abs(swipe) * 4,
          angle: RITUAL_CONFIG.tools.cottonbuds.contactAngle + swipe * 4,
          opacity: 1,
          elevation: 0,
        };
      } else {
        // Exit left
        const p = easeInCubic((t - 2.8) / 0.7);
        swab = {
          x: lerp(P.x, -80, p),
          y: lerp(P.y, 290, p),
          angle: lerp(RITUAL_CONFIG.tools.cottonbuds.contactAngle, -10, p),
          opacity: 1 - easeInCubic((t - 3.1) / 0.4),
          elevation: lerp(0, 0.7, p),
        };
      }
    }

    // 3. Purple Mark Dot
    // Appears at marker contact (4.25s) and stays through needle/jewel
    const hasPurpleDot = t >= 4.25 && t < 11.5;

    // 4. Marker (3.5s -> 5.5s)
    let marker = { x: 420, y: 40, angle: -42, opacity: 0, elevation: 0.8, scale: 1 };
    if (t >= 3.5 && t < 5.5) {
      if (t < 4.15) {
        // Enter
        const p = easeOutBack((t - 3.5) / 0.65);
        marker = {
          x: lerp(420, P.x, p),
          y: lerp(40, P.y, p),
          angle: lerp(-42, RITUAL_CONFIG.tools.marker.contactAngle, p),
          opacity: easeOutCubic((t - 3.5) / 0.25),
          elevation: lerp(0.8, 0.05, p),
          scale: 1,
        };
      } else if (t < 4.55) {
        // Tap down onto PIERCE_POINT
        const tapP = Math.sin(((t - 4.15) / 0.4) * Math.PI);
        marker = {
          x: P.x,
          y: P.y,
          angle: RITUAL_CONFIG.tools.marker.contactAngle,
          opacity: 1,
          elevation: (1 - tapP) * 0.05,
          scale: 1 - tapP * 0.02,
        };
      } else {
        // Retract & exit
        const p = easeInCubic((t - 4.55) / 0.95);
        marker = {
          x: lerp(P.x, 420, p),
          y: lerp(P.y, 30, p),
          angle: lerp(RITUAL_CONFIG.tools.marker.contactAngle, -45, p),
          opacity: 1 - easeInCubic((t - 5.1) / 0.4),
          elevation: lerp(0.05, 0.8, p),
          scale: 1,
        };
      }
    }

    // 5. Mirror (5.5s -> 7.5s)
    let mirror = { x: 400, y: 360, angle: 5, opacity: 0, elevation: 0.7, sheenP: 0 };
    if (t >= 5.5 && t < 7.5) {
      const inspectPos = { x: P.x + 36, y: P.y + 12 };
      if (t < 6.1) {
        // Rise in
        const p = easeOutBack((t - 5.5) / 0.6);
        mirror = {
          x: lerp(400, inspectPos.x, p),
          y: lerp(360, inspectPos.y, p),
          angle: lerp(5, RITUAL_CONFIG.tools.mirror.inspectAngle, p),
          opacity: easeOutCubic((t - 5.5) / 0.25),
          elevation: lerp(0.7, 0.15, p),
          sheenP: 0,
        };
      } else if (t < 6.85) {
        // Inspect & sheen sweep
        const sheen = clamp((t - 6.2) / 0.45, 0, 1);
        mirror = {
          x: inspectPos.x,
          y: inspectPos.y,
          angle: RITUAL_CONFIG.tools.mirror.inspectAngle,
          opacity: 1,
          elevation: 0.15,
          sheenP: sheen,
        };
      } else {
        // Lower & exit
        const p = easeInCubic((t - 6.85) / 0.65);
        mirror = {
          x: lerp(inspectPos.x, 410, p),
          y: lerp(inspectPos.y, 380, p),
          angle: lerp(RITUAL_CONFIG.tools.mirror.inspectAngle, 10, p),
          opacity: 1 - easeInCubic((t - 7.1) / 0.4),
          elevation: lerp(0.15, 0.8, p),
          sheenP: 1,
        };
      }
    }

    // 6. Forceps / Clamp (7.5s -> 9.5s, stays during Pierce 9.5s -> 11.0s)
    let clampState = {
      x: 390,
      y: 360,
      angle: 28,
      opacity: 0,
      frameIdx: 0,
      scale: 1,
      elevation: 0.7,
    };

    if (t >= 7.5 && t < 11.0) {
      if (t < 8.1) {
        // Enter open
        const p = easeOutBack((t - 7.5) / 0.6);
        clampState = {
          x: lerp(390, P.x, p),
          y: lerp(360, P.y, p),
          angle: lerp(28, RITUAL_CONFIG.tools.clamp.contactAngle, p),
          opacity: easeOutCubic((t - 7.5) / 0.25),
          frameIdx: 0,
          scale: 1,
          elevation: lerp(0.7, 0, p),
        };
      } else if (t < 9.5) {
        // Crisp swaps 1 -> 2 -> 3 -> 4 with slight grip pulse
        const clampTime = t - 8.1;
        let frame = 0;
        let pulse = 1;
        if (clampTime < 0.25) {
          frame = 0;
        } else if (clampTime < 0.5) {
          frame = 1;
          pulse = 1 + Math.sin(((clampTime - 0.25) / 0.25) * Math.PI) * 0.018;
        } else if (clampTime < 0.75) {
          frame = 2;
          pulse = 1 + Math.sin(((clampTime - 0.5) / 0.25) * Math.PI) * 0.018;
        } else {
          frame = 3; // Fully closed
          pulse = 1 + Math.sin(((clampTime - 0.75) / 0.25) * Math.PI) * 0.018;
        }

        clampState = {
          x: P.x,
          y: P.y,
          angle: RITUAL_CONFIG.tools.clamp.contactAngle,
          opacity: 1,
          frameIdx: frame,
          scale: pulse,
          elevation: 0,
        };
      } else {
        // Holding during piercing (9.5s -> 11.0s)
        clampState = {
          x: P.x,
          y: P.y,
          angle: RITUAL_CONFIG.tools.clamp.contactAngle,
          opacity: t < 10.8 ? 1 : 1 - (t - 10.8) / 0.2,
          frameIdx: 3,
          scale: 1,
          elevation: 0,
        };
      }
    }

    // 7. Needle (9.5s -> 11.0s)
    let needle = { x: 410, y: 30, angle: -36, opacity: 0, elevation: 0.8 };
    if (t >= 9.5 && t < 11.0) {
      if (t < 9.9) {
        // Fast enter
        const p = easeInCubic((t - 9.5) / 0.4);
        needle = {
          x: lerp(410, P.x, p),
          y: lerp(30, P.y, p),
          angle: lerp(-36, RITUAL_CONFIG.tools.needle.contactAngle, p),
          opacity: easeOutCubic((t - 9.5) / 0.2),
          elevation: lerp(0.8, 0, p),
        };
      } else if (t < 10.25) {
        // Pierce hold / through
        const p = (t - 9.9) / 0.35;
        const dip = Math.sin(p * Math.PI) * 2;
        needle = {
          x: P.x + dip * 0.8,
          y: P.y + dip * 0.6,
          angle: RITUAL_CONFIG.tools.needle.contactAngle,
          opacity: 1,
          elevation: 0,
        };
      } else {
        // Fast exit
        const p = easeOutCubic((t - 10.25) / 0.65);
        needle = {
          x: lerp(P.x, 420, p),
          y: lerp(P.y, 40, p),
          angle: lerp(RITUAL_CONFIG.tools.needle.contactAngle, -38, p),
          opacity: 1 - easeInCubic((t - 10.6) / 0.35),
          elevation: lerp(0, 0.8, p),
        };
      }
    }

    // 8. Jeweled Forceps & Release (11.0s -> 13.0s)
    let jewelClamp = {
      x: 390,
      y: 360,
      angle: 26,
      opacity: 0,
      elevation: 0.7,
      scale: 1,
      reverseFrame: -1, // -1 means forecepwithjew image, 0..3 means clamp frames 4..1 opening
    };

    if (t >= 11.0 && t < 13.0) {
      if (t < 11.5) {
        // Enter with gold stud
        const p = easeOutCubic((t - 11.0) / 0.5);
        jewelClamp = {
          x: lerp(390, P.x, p),
          y: lerp(360, P.y, p),
          angle: lerp(26, RITUAL_CONFIG.tools.forecepwithjew.contactAngle, p),
          opacity: easeOutCubic((t - 11.0) / 0.25),
          elevation: lerp(0.7, 0, p),
          scale: 1,
          reverseFrame: -1,
        };
      } else if (t < 11.8) {
        // Placed on PIERCE_POINT, contact moment
        jewelClamp = {
          x: P.x,
          y: P.y,
          angle: RITUAL_CONFIG.tools.forecepwithjew.contactAngle,
          opacity: 1,
          elevation: 0,
          scale: 1,
          reverseFrame: -1,
        };
      } else if (t < 12.4) {
        // Reverse frame swaps 4 -> 3 -> 2 -> 1 (clamp opens, releasing stud)
        const openTime = t - 11.8;
        let rFrame = 3;
        if (openTime > 0.45) rFrame = 0;
        else if (openTime > 0.3) rFrame = 1;
        else if (openTime > 0.15) rFrame = 2;

        jewelClamp = {
          x: P.x,
          y: P.y,
          angle: RITUAL_CONFIG.tools.forecepwithjew.contactAngle,
          opacity: 1,
          elevation: 0.05,
          scale: 1,
          reverseFrame: rFrame,
        };
      } else {
        // Retract open forceps and exit
        const p = easeInCubic((t - 12.4) / 0.6);
        jewelClamp = {
          x: lerp(P.x, 400, p),
          y: lerp(P.y, 380, p),
          angle: lerp(RITUAL_CONFIG.tools.forecepwithjew.contactAngle, 28, p),
          opacity: 1 - easeInCubic((t - 12.7) / 0.3),
          elevation: lerp(0.05, 0.8, p),
          scale: 1,
          reverseFrame: 0,
        };
      }
    }

    // 9. Permanent/Revealed Gold Stud (from 11.5s until fade-out at 13.7s -> 14.0s)
    let stud = { opacity: 0, scale: 1, glint: 0 };
    if (t >= 11.5) {
      if (t < 13.0) {
        stud = { opacity: 1, scale: 1, glint: 0 };
      } else if (t < 13.7) {
        // Glint shine sweep across stud (13.1s - 13.5s)
        const glintP = clamp((t - 13.1) / 0.4, 0, 1);
        stud = { opacity: 1, scale: 1, glint: Math.sin(glintP * Math.PI) };
      } else {
        // Soft fade out into idle (13.7s - 14.0s) for seamless restart
        const fade = (14.0 - t) / 0.3;
        stud = { opacity: clamp(fade, 0, 1), scale: 1, glint: 0 };
      }
    }

    // 10. Particles System (<= 8 concurrent DOM nodes)
    const particles: Array<{
      id: string;
      x: number;
      y: number;
      size: number;
      color: string;
      opacity: number;
      rot: number;
    }> = [];

    // Teal sparkles during cotton swab cleaning (2.1s - 2.8s)
    if (t >= 2.1 && t <= 2.8) {
      const p = (t - 2.1) / 0.7;
      [
        { ox: -12, oy: -10, delay: 0.1, sz: 12 },
        { ox: 14, oy: -6, delay: 0.3, sz: 10 },
        { ox: 0, oy: 12, delay: 0.5, sz: 14 },
      ].forEach((spec, i) => {
        const localT = (p - spec.delay) / 0.3;
        if (localT > 0 && localT < 1) {
          const sparkP = Math.sin(localT * Math.PI);
          particles.push({
            id: `clean-${i}`,
            x: P.x + spec.ox + localT * 4,
            y: P.y + spec.oy - localT * 6,
            size: spec.sz * sparkP,
            color: '#2dd4bf', // Teal accent
            opacity: sparkP,
            rot: localT * 120,
          });
        }
      });
    }

    // Jewel sparkle burst on contact (11.5s - 12.3s)
    if (t >= 11.5 && t <= 12.3) {
      const p = (t - 11.5) / 0.8;
      const burstAngles = [0, 60, 120, 180, 240, 300];
      burstAngles.forEach((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const dist = easeOutCubic(p) * 32;
        const alpha = 1 - easeInCubic(p);
        particles.push({
          id: `jewel-${i}`,
          x: P.x + Math.cos(rad) * dist,
          y: P.y + Math.sin(rad) * dist,
          size: lerp(12, 4, p),
          color: i % 2 === 0 ? '#fbbf24' : '#2dd4bf', // Gold and Teal stars
          opacity: alpha,
          rot: deg + p * 180,
        });
      });
    }

    return {
      phaseName,
      logo: { y: logoY, scaleX: logoScaleX, scaleY: logoScaleY, rot: logoRot, shadowScale, shadowOpacity },
      swab,
      marker,
      hasPurpleDot,
      mirror,
      clamp: clampState,
      needle,
      jewelClamp,
      stud,
      particles,
    };
  }, [time]);

  const { logo, tools, piercePoint } = RITUAL_CONFIG;
  const logoLeft = logo.center.x - logo.displayWidth / 2;
  const logoTop = logo.center.y - logo.displayHeight / 2;

  return (
    <div className="w-full max-w-[420px] mx-auto select-none" style={{ pointerEvents: 'none' }}>
      {/* ── Outer Stage Card Container with Fixed 1:1 Aspect Ratio ── */}
      <div
        ref={containerRef}
        className="relative w-full rounded-3xl overflow-hidden"
        style={{
          aspectRatio: '1 / 1',
          background:
            'radial-gradient(circle at 50% 45%, rgba(139, 92, 246, 0.16) 0%, rgba(12, 14, 19, 0.95) 75%), #0c0e13',
          border: '1px solid rgba(251, 191, 36, 0.32)',
          boxShadow:
            '0 0 24px -4px rgba(139, 92, 246, 0.25), 0 0 0 1px rgba(251, 191, 36, 0.12), inset 0 0 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Fixed 400x400 Logical Stage Scaled as One Unit ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${RITUAL_CONFIG.stageSize}px`,
            height: `${RITUAL_CONFIG.stageSize}px`,
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Header Pill */}
          <div
            className="absolute top-3 left-4 right-4 flex items-center justify-between z-30 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(17, 21, 32, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span
                className="text-[10px] font-black tracking-[0.22em] uppercase text-amber-300/90"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
              >
                NOW PIERCING
              </span>
            </div>
            <span
              className="text-[9px] tracking-widest text-purple-300/70 uppercase font-semibold"
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
              {stageState.phaseName} · LIVE
            </span>
          </div>

          {/* Ambient Glow behind Logo */}
          <div
            style={{
              position: 'absolute',
              left: 100,
              top: 105,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, transparent 70%)',
              filter: 'blur(20px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Logo Drop Shadow */}
          <div
            style={{
              position: 'absolute',
              left: 110,
              top: 320,
              width: 180,
              height: 26,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, transparent 75%)',
              transform: `scale(${stageState.logo.shadowScale})`,
              opacity: stageState.logo.shadowOpacity,
              filter: 'blur(4px)',
              zIndex: 2,
            }}
          />

          {/* Centered Brand Logo */}
          <div
            style={{
              position: 'absolute',
              left: `${logoLeft}px`,
              top: `${logoTop}px`,
              width: `${logo.displayWidth}px`,
              height: `${logo.displayHeight}px`,
              transformOrigin: '50% 65%',
              transform: prefersReducedMotion
                ? 'none'
                : `translate3d(0, ${stageState.logo.y}px, 0) rotate(${stageState.logo.rot}deg) scale(${stageState.logo.scaleX}, ${stageState.logo.scaleY})`,
              zIndex: 3,
              willChange: 'transform',
            }}
          >
            <img
              src={logo.src}
              alt="Brand Logo"
              width={logo.displayWidth}
              height={logo.displayHeight}
              className="w-full h-full object-contain pointer-events-none select-none"
              loading="eager"
            />
          </div>

          {/* Purple Marker Dot on Ear */}
          {(stageState.hasPurpleDot || prefersReducedMotion) && (
            <div
              style={{
                position: 'absolute',
                left: `${piercePoint.x - 2.5}px`,
                top: `${piercePoint.y - 2.5 + (prefersReducedMotion ? 0 : stageState.logo.y)}px`,
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: '#9333ea',
                boxShadow: '0 0 3px rgba(147, 51, 234, 0.8)',
                zIndex: 4,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Gold Stud at Contact Point */}
          {(stageState.stud.opacity > 0.01 || prefersReducedMotion) && (
            <div
              style={{
                position: 'absolute',
                left: `${piercePoint.x - 5}px`,
                top: `${piercePoint.y - 5 + (prefersReducedMotion ? 0 : stageState.logo.y)}px`,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 35% 35%, #fffbeb 0%, #fbbf24 55%, #b45309 100%)',
                boxShadow: '0 0 8px rgba(251, 191, 36, 0.9), 0 2px 4px rgba(0,0,0,0.6)',
                opacity: prefersReducedMotion ? 1 : stageState.stud.opacity,
                transform: `scale(${stageState.stud.scale})`,
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              {/* Stud Glint Star */}
              {stageState.stud.glint > 0.05 && (
                <div
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: -6,
                    width: 22,
                    height: 22,
                    opacity: stageState.stud.glint,
                    transform: `rotate(${stageState.stud.glint * 45}deg) scale(${stageState.stud.glint * 1.2})`,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="#ffffff" className="w-full h-full drop-shadow-md">
                    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Animated Tool Rigs (Hidden in reduced motion) */}
          {!prefersReducedMotion && (
            <>
              {/* 1. Cotton Swab */}
              <ToolRig
                x={stageState.swab.x}
                y={stageState.swab.y}
                angle={stageState.swab.angle}
                opacity={stageState.swab.opacity}
                elevation={stageState.swab.elevation}
                anchorLogical={toolSpecs.cottonbuds.anchorLogical}
                width={toolSpecs.cottonbuds.width}
                height={toolSpecs.cottonbuds.height}
                debug={RITUAL_CONFIG.debug}
                debugColor="#00f5d4"
              >
                <img
                  src={tools.cottonbuds.src}
                  alt="Cotton Swab"
                  className="w-full h-full object-contain pointer-events-none"
                  loading="eager"
                />
              </ToolRig>

              {/* 2. Marker */}
              <ToolRig
                x={stageState.marker.x}
                y={stageState.marker.y}
                angle={stageState.marker.angle}
                opacity={stageState.marker.opacity}
                elevation={stageState.marker.elevation}
                scale={stageState.marker.scale}
                anchorLogical={toolSpecs.marker.anchorLogical}
                width={toolSpecs.marker.width}
                height={toolSpecs.marker.height}
                debug={RITUAL_CONFIG.debug}
                debugColor="#d946ef"
              >
                <img
                  src={tools.marker.src}
                  alt="Marker Pen"
                  className="w-full h-full object-contain pointer-events-none"
                  loading="eager"
                />
              </ToolRig>

              {/* 3. Mirror */}
              <ToolRig
                x={stageState.mirror.x}
                y={stageState.mirror.y}
                angle={stageState.mirror.angle}
                opacity={stageState.mirror.opacity}
                elevation={stageState.mirror.elevation}
                anchorLogical={toolSpecs.mirror.anchorLogical}
                width={toolSpecs.mirror.width}
                height={toolSpecs.mirror.height}
                debug={RITUAL_CONFIG.debug}
                debugColor="#38bdf8"
              >
                <div className="relative w-full h-full">
                  <img
                    src={tools.mirror.src}
                    alt="Hand Mirror"
                    className="w-full h-full object-contain pointer-events-none"
                    loading="eager"
                  />
                  {/* Glass Sheen Sweep */}
                  {stageState.mirror.sheenP > 0 && stageState.mirror.sheenP < 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${toolSpecs.mirror.anchorLogical.x - 55}px`,
                        top: `${toolSpecs.mirror.anchorLogical.y - 55}px`,
                        width: 110,
                        height: 110,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '-20%',
                          left: '-20%',
                          width: '140%',
                          height: '140%',
                          background:
                            'linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.7) 50%, transparent 65%)',
                          transform: `translate3d(${lerp(-80, 80, stageState.mirror.sheenP)}px, ${lerp(-80, 80, stageState.mirror.sheenP)}px, 0)`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </ToolRig>

              {/* 4. Forceps / Clamp Frame Stack (Frames 1 -> 4) */}
              <ToolRig
                x={stageState.clamp.x}
                y={stageState.clamp.y}
                angle={stageState.clamp.angle}
                opacity={stageState.clamp.opacity}
                elevation={stageState.clamp.elevation}
                scale={stageState.clamp.scale}
                anchorLogical={toolSpecs.clamp.anchorLogical}
                width={toolSpecs.clamp.width}
                height={toolSpecs.clamp.height}
                debug={RITUAL_CONFIG.debug}
                debugColor="#facc15"
              >
                <div className="relative w-full h-full">
                  {tools.clamp.frames.map((src, idx) => (
                    <img
                      key={src}
                      src={src}
                      alt={`Clamp frame ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-75"
                      style={{
                        opacity: stageState.clamp.frameIdx === idx ? 1 : 0,
                      }}
                      loading="eager"
                    />
                  ))}
                </div>
              </ToolRig>

              {/* 5. Piercing Needle */}
              <ToolRig
                x={stageState.needle.x}
                y={stageState.needle.y}
                angle={stageState.needle.angle}
                opacity={stageState.needle.opacity}
                elevation={stageState.needle.elevation}
                anchorLogical={toolSpecs.needle.anchorLogical}
                width={toolSpecs.needle.width}
                height={toolSpecs.needle.height}
                debug={RITUAL_CONFIG.debug}
                debugColor="#4ade80"
              >
                <img
                  src={tools.needle.src}
                  alt="Piercing Needle"
                  className="w-full h-full object-contain pointer-events-none"
                  loading="eager"
                />
              </ToolRig>

              {/* 6. Forceps with Jewel & Release Swaps */}
              <ToolRig
                x={stageState.jewelClamp.x}
                y={stageState.jewelClamp.y}
                angle={stageState.jewelClamp.angle}
                opacity={stageState.jewelClamp.opacity}
                elevation={stageState.jewelClamp.elevation}
                scale={stageState.jewelClamp.scale}
                anchorLogical={
                  stageState.jewelClamp.reverseFrame >= 0
                    ? toolSpecs.clamp.anchorLogical
                    : toolSpecs.forecepwithjew.anchorLogical
                }
                width={
                  stageState.jewelClamp.reverseFrame >= 0
                    ? toolSpecs.clamp.width
                    : toolSpecs.forecepwithjew.width
                }
                height={
                  stageState.jewelClamp.reverseFrame >= 0
                    ? toolSpecs.clamp.height
                    : toolSpecs.forecepwithjew.height
                }
                debug={RITUAL_CONFIG.debug}
                debugColor="#f97316"
              >
                <div className="relative w-full h-full">
                  {stageState.jewelClamp.reverseFrame === -1 ? (
                    <img
                      src={tools.forecepwithjew.src}
                      alt="Forceps with Jeweled Stud"
                      className="w-full h-full object-contain pointer-events-none"
                      loading="eager"
                    />
                  ) : (
                    tools.clamp.frames.map((src, idx) => (
                      <img
                        key={src}
                        src={src}
                        alt={`Opening frame ${idx + 1}`}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-75"
                        style={{
                          opacity: stageState.jewelClamp.reverseFrame === idx ? 1 : 0,
                        }}
                        loading="eager"
                      />
                    ))
                  )}
                </div>
              </ToolRig>

              {/* 7. Particles Overlay */}
              <div className="absolute inset-0 pointer-events-none z-25">
                {stageState.particles.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      position: 'absolute',
                      left: `${p.x - p.size / 2}px`,
                      top: `${p.y - p.size / 2}px`,
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      opacity: p.opacity,
                      transform: `rotate(${p.rot}deg)`,
                      pointerEvents: 'none',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill={p.color} className="w-full h-full drop-shadow">
                      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
                    </svg>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Debug Overlay ── */}
          {RITUAL_CONFIG.debug && (
            <div className="absolute inset-0 pointer-events-none z-50">
              {/* Stage border outline */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  border: '1px dashed #ef4444',
                }}
              />

              {/* PIERCE_POINT Crosshairs */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${piercePoint.y}px`,
                  height: 1,
                  backgroundColor: 'rgba(239, 68, 68, 0.7)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${piercePoint.x}px`,
                  width: 1,
                  backgroundColor: 'rgba(239, 68, 68, 0.7)',
                }}
              />

              {/* PIERCE_POINT Reticle */}
              <div
                style={{
                  position: 'absolute',
                  left: `${piercePoint.x - 8}px`,
                  top: `${piercePoint.y - 8}px`,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid #ef4444',
                  boxShadow: '0 0 6px #ef4444',
                }}
              />

              {/* Debug HUD */}
              <div
                className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/80 font-mono text-[10px] text-green-400 border border-green-500/30"
                style={{ pointerEvents: 'none' }}
              >
                t: {time.toFixed(2)}s | {stageState.phaseName} | scale: {scaleFactor.toFixed(2)}x
                <br />
                PIERCE: ({piercePoint.x}, {piercePoint.y})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

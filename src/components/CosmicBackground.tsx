import React, { useEffect, useRef } from 'react';

interface CosmicBackgroundProps {
  active: boolean;
}

export const CosmicBackground: React.FC<CosmicBackgroundProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (prefersReducedMotion) {
        drawFrame(0);
      }
    };
    window.addEventListener('resize', handleResize);

    // 3-layer starfield (distant dust, mid stars, bright accent stars)
    const starCount = Math.min(240, Math.max(90, Math.floor((width * height) / 6200)));
    const stars = Array.from({ length: starCount }, (_, i) => {
      const layer = i % 5 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
      return {
        x: Math.random(),
        y: Math.random(),
        radius: layer === 2 ? Math.random() * 1.4 + 1.0 : layer === 1 ? Math.random() * 0.9 + 0.5 : Math.random() * 0.6 + 0.25,
        alpha: Math.random() * 0.65 + 0.25,
        speed: (Math.random() * 0.012 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
        hue: i % 7 === 0 ? 42 : i % 4 === 0 ? 202 : i % 9 === 0 ? 255 : 215, // gold, ice-blue, soft indigo, white-blue
        sat: i % 7 === 0 ? 90 : i % 4 === 0 ? 85 : 35,
        glow: layer === 2,
      };
    });

    // Milky Way diagonal micro-dust points
    const dustCount = 110;
    const dustPoints = Array.from({ length: dustCount }, () => {
      const t = Math.random();
      const spread = (Math.random() - 0.5) * 0.28 + (Math.random() - 0.5) * 0.14;
      return {
        t,
        spread,
        r: Math.random() * 0.9 + 0.2,
        a: Math.random() * 0.35 + 0.08,
      };
    });

    interface ShootingStar {
      x: number;
      y: number;
      len: number;
      speed: number;
      angle: number;
      alpha: number;
    }
    let shootingStar: ShootingStar | null = null;
    let nextShootingStarTime = Date.now() + 2800;

    let lastFrame = 0;
    const fpsInterval = 1000 / 24;

    const drawFrame = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // 1. Deep obsidian space gradient
      const bgGrad = ctx.createRadialGradient(
        width * 0.55,
        height * 0.22,
        40,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.95
      );
      bgGrad.addColorStop(0, '#0f1b38');
      bgGrad.addColorStop(0.45, '#070d1e');
      bgGrad.addColorStop(1, '#02040b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Soft celestial nebulas (sapphire, golden-amber, indigo aurora)
      const nebulaAmber = ctx.createRadialGradient(
        width * 0.14,
        height * 0.18,
        10,
        width * 0.14,
        height * 0.18,
        Math.max(width, height) * 0.38
      );
      nebulaAmber.addColorStop(0, 'rgba(245, 158, 11, 0.09)');
      nebulaAmber.addColorStop(0.5, 'rgba(217, 119, 6, 0.03)');
      nebulaAmber.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = nebulaAmber;
      ctx.fillRect(0, 0, width, height);

      const nebulaSky = ctx.createRadialGradient(
        width * 0.22,
        height * 0.78,
        20,
        width * 0.22,
        height * 0.78,
        Math.max(width, height) * 0.42
      );
      nebulaSky.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
      nebulaSky.addColorStop(0.55, 'rgba(14, 165, 233, 0.03)');
      nebulaSky.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = nebulaSky;
      ctx.fillRect(0, 0, width, height);

      const nebulaIndigo = ctx.createRadialGradient(
        width * 0.84,
        height * 0.48,
        20,
        width * 0.84,
        height * 0.48,
        Math.max(width, height) * 0.44
      );
      nebulaIndigo.addColorStop(0, 'rgba(99, 102, 241, 0.11)');
      nebulaIndigo.addColorStop(0.55, 'rgba(139, 92, 246, 0.04)');
      nebulaIndigo.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = nebulaIndigo;
      ctx.fillRect(0, 0, width, height);

      // 3. Subtle Milky Way diagonal glow + fine dust
      ctx.save();
      const bandGrad = ctx.createLinearGradient(0, height * 0.85, width, height * 0.1);
      bandGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      bandGrad.addColorStop(0.35, 'rgba(148, 163, 184, 0.035)');
      bandGrad.addColorStop(0.65, 'rgba(129, 140, 248, 0.04)');
      bandGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, 0, width, height);

      for (const d of dustPoints) {
        const px = d.t * width;
        const py = (1 - d.t) * height * 0.82 + height * 0.09 + d.spread * height;
        ctx.beginPath();
        ctx.arc(px, py, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(203, 213, 225, ${d.a})`;
        ctx.fill();
      }
      ctx.restore();

      // 4. Distant ringed horizon silhouette in upper right corner
      const planetX = width * 0.88;
      const planetY = height * 0.16;
      const planetR = Math.min(width, height) * 0.11;
      if (planetR > 28) {
        const halo = ctx.createRadialGradient(planetX, planetY, planetR * 0.8, planetX, planetY, planetR * 1.9);
        halo.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
        halo.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(planetX, planetY, planetR * 1.9, 0, Math.PI * 2);
        ctx.fill();

        const sphere = ctx.createLinearGradient(
          planetX - planetR,
          planetY - planetR,
          planetX + planetR,
          planetY + planetR
        );
        sphere.addColorStop(0, 'rgba(30, 58, 138, 0.28)');
        sphere.addColorStop(0.5, 'rgba(15, 23, 42, 0.45)');
        sphere.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
        ctx.fillStyle = sphere;
        ctx.beginPath();
        ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
        ctx.fill();

        // Thin golden-ice crescent rim
        ctx.save();
        ctx.beginPath();
        ctx.arc(planetX, planetY, planetR, Math.PI * 0.85, Math.PI * 1.68);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Subtle orbital ring
        ctx.translate(planetX, planetY);
        ctx.rotate(-0.32);
        ctx.beginPath();
        ctx.ellipse(0, 0, planetR * 1.65, planetR * 0.28, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 5. Render twinkling stars
      for (const star of stars) {
        if (!prefersReducedMotion) {
          star.alpha += star.speed;
          if (star.alpha > 0.95 || star.alpha < 0.18) {
            star.speed = -star.speed;
          }
        }
        const sx = star.x * width;
        const sy = star.y * height;
        ctx.beginPath();
        ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, ${star.sat}%, 88%, ${Math.max(0.15, star.alpha)})`;
        if (star.glow) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = `hsla(${star.hue}, ${star.sat}%, 75%, 0.65)`;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 6. Shooting stars (golden-white atmospheric trail)
      if (!prefersReducedMotion) {
        const now = Date.now();
        if (!shootingStar && now > nextShootingStarTime) {
          shootingStar = {
            x: Math.random() * (width * 0.65) + width * 0.08,
            y: Math.random() * (height * 0.35),
            len: Math.random() * 95 + 65,
            speed: Math.random() * 7 + 11,
            angle: Math.PI / 4.2 + (Math.random() * 0.16 - 0.08),
            alpha: 0.95,
          };
        }

        if (shootingStar) {
          const tailX = shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.len;
          const tailY = shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.len;

          const starGrad = ctx.createLinearGradient(shootingStar.x, shootingStar.y, tailX, tailY);
          starGrad.addColorStop(0, `rgba(255, 248, 225, ${shootingStar.alpha})`);
          starGrad.addColorStop(0.35, `rgba(186, 230, 253, ${shootingStar.alpha * 0.6})`);
          starGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

          ctx.beginPath();
          ctx.moveTo(shootingStar.x, shootingStar.y);
          ctx.lineTo(tailX, tailY);
          ctx.strokeStyle = starGrad;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
          shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
          shootingStar.alpha -= 0.022;

          if (shootingStar.alpha <= 0 || shootingStar.x > width || shootingStar.y > height) {
            shootingStar = null;
            nextShootingStarTime = now + Math.random() * 5500 + 3800;
          }
        }
      }
      void time;
    };

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;

      const delta = time - lastFrame;
      if (delta < fpsInterval) return;
      lastFrame = time - (delta % fpsInterval);

      drawFrame(time);
    };

    if (prefersReducedMotion) {
      drawFrame(0);
    } else {
      drawFrame(0);
      animId = requestAnimationFrame(render);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};

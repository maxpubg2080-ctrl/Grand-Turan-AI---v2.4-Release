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

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Star generation
    const starCount = Math.min(180, Math.floor((width * height) / 8000));
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.4,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.015 + 0.005,
      hue: Math.random() > 0.7 ? 200 : Math.random() > 0.4 ? 45 : 280, // cyan, gold, violet tints
    }));

    // Shooting stars
    interface ShootingStar {
      x: number;
      y: number;
      len: number;
      speed: number;
      angle: number;
      alpha: number;
    }
    let shootingStar: ShootingStar | null = null;
    let nextShootingStarTime = Date.now() + 2500;

    let lastFrame = 0;
    const fpsInterval = 1000 / 24; // 24 FPS is smooth and very low CPU

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;

      const delta = time - lastFrame;
      if (delta < fpsInterval) return;
      lastFrame = time - (delta % fpsInterval);

      ctx.clearRect(0, 0, width, height);

      // Deep space background gradient
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.3,
        100,
        width * 0.5,
        height * 0.5,
        Math.max(width, height)
      );
      bgGrad.addColorStop(0, '#0f172a'); // slate 900
      bgGrad.addColorStop(0.5, '#090d16');
      bgGrad.addColorStop(1, '#030712'); // black violet
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Glowing nebula patches
      const nebula1 = ctx.createRadialGradient(width * 0.2, height * 0.25, 20, width * 0.2, height * 0.25, 300);
      nebula1.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
      nebula1.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(width * 0.8, height * 0.75, 40, width * 0.8, height * 0.75, 400);
      nebula2.addColorStop(0, 'rgba(168, 85, 247, 0.07)');
      nebula2.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Render stars
      stars.forEach((star) => {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0.2) {
          star.speed = -star.speed;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 80%, 80%, ${Math.max(0.1, star.alpha)})`;
        ctx.shadowBlur = star.radius > 1 ? 4 : 0;
        ctx.shadowColor = `hsla(${star.hue}, 90%, 70%, 0.8)`;
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Shooting star logic
      const now = Date.now();
      if (!shootingStar && now > nextShootingStarTime) {
        shootingStar = {
          x: Math.random() * (width * 0.7) + width * 0.1,
          y: Math.random() * (height * 0.4),
          len: Math.random() * 80 + 50,
          speed: Math.random() * 8 + 12,
          angle: (Math.PI / 4) + (Math.random() * 0.2 - 0.1),
          alpha: 1,
        };
      }

      if (shootingStar) {
        const tailX = shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.len;
        const tailY = shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.len;

        const starGrad = ctx.createLinearGradient(shootingStar.x, shootingStar.y, tailX, tailY);
        starGrad.addColorStop(0, `rgba(255, 255, 255, ${shootingStar.alpha})`);
        starGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = starGrad;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
        shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
        shootingStar.alpha -= 0.02;

        if (shootingStar.alpha <= 0 || shootingStar.x > width || shootingStar.y > height) {
          shootingStar = null;
          nextShootingStarTime = now + Math.random() * 6000 + 4000;
        }
      }
    };

    render(0);

    return () => {
      cancelAnimationFrame(animId);
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

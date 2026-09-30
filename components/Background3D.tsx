'use client';

import { useEffect, useRef } from 'react';

export function Background3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // 3D Particles
    const PARTICLE_COUNT = 90;
    interface Particle3D {
      x: number;
      y: number;
      z: number;
      size: number;
      speedZ: number;
      color: string;
    }

    const particles: Particle3D[] = [];
    const colors = ['rgba(242, 101, 56, 0.6)', 'rgba(99, 102, 241, 0.5)', 'rgba(245, 158, 11, 0.5)', 'rgba(255, 255, 255, 0.4)'];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * 800 + 100,
        size: Math.random() * 2 + 1,
        speedZ: Math.random() * 0.8 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // 3D Floating Geometry (Rotating Wireframe Icosahedron / Octahedron points)
    let rotationAngle = 0;
    const fov = 500;

    // 3D Wireframe vertices of an Octahedron
    const baseVertices = [
      { x: 0, y: -120, z: 0 },
      { x: 120, y: 0, z: 0 },
      { x: 0, y: 0, z: 120 },
      { x: -120, y: 0, z: 0 },
      { x: 0, y: 0, z: -120 },
      { x: 0, y: 120, z: 0 },
    ];

    const edges = [
      [0, 1], [0, 2], [0, 3], [0, 4],
      [5, 1], [5, 2], [5, 3], [5, 4],
      [1, 2], [2, 3], [3, 4], [4, 1],
    ];

    const render = () => {
      // Smooth mouse lerp
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      const tiltX = (mouseX / width - 0.5) * 0.6;
      const tiltY = (mouseY / height - 0.5) * 0.6;

      ctx.clearRect(0, 0, width, height);

      // 1. Ambient Dynamic Light Glows
      const glow1 = ctx.createRadialGradient(
        width * 0.3 + tiltX * 80,
        height * 0.25 + tiltY * 60,
        0,
        width * 0.3 + tiltX * 80,
        height * 0.25 + tiltY * 60,
        width * 0.5
      );
      glow1.addColorStop(0, 'rgba(242, 101, 56, 0.12)'); // Terracotta flame glow
      glow1.addColorStop(0.5, 'rgba(120, 50, 25, 0.04)');
      glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');

      const glow2 = ctx.createRadialGradient(
        width * 0.75 - tiltX * 80,
        height * 0.6 - tiltY * 60,
        0,
        width * 0.75 - tiltX * 80,
        height * 0.6 - tiltY * 60,
        width * 0.45
      );
      glow2.addColorStop(0, 'rgba(99, 102, 241, 0.10)'); // Electric indigo glow
      glow2.addColorStop(0.6, 'rgba(49, 46, 129, 0.03)');
      glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      // 2. 3D Perspective Grid at bottom
      const horizonY = height * 0.75;
      const gridCount = 14;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= gridCount; i++) {
        const xProgress = (i / gridCount) * width;
        const startX = width * 0.5 + (xProgress - width * 0.5) * 0.2;
        ctx.moveTo(startX, horizonY);
        ctx.lineTo(xProgress * 1.4 - width * 0.2, height);
      }
      for (let j = 1; j <= 6; j++) {
        const lineY = horizonY + Math.pow(j / 6, 2) * (height - horizonY);
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 3. Render 3D Floating Geometry (Center-right subtle floating artifact)
      rotationAngle += 0.007;
      const cx = width * 0.82 + tiltX * 60;
      const cy = height * 0.32 + tiltY * 50;
      const cz = 450;

      const cosY = Math.cos(rotationAngle);
      const sinY = Math.sin(rotationAngle);
      const cosX = Math.cos(rotationAngle * 0.7);
      const sinX = Math.sin(rotationAngle * 0.7);

      const projectedVertices = baseVertices.map((v) => {
        // Rotate around Y
        let rx = v.x * cosY + v.z * sinY;
        let rz = -v.x * sinY + v.z * cosY;
        // Rotate around X
        let ry = v.y * cosX - rz * sinX;
        rz = v.y * sinX + rz * cosX;

        // Perspective projection
        const totalZ = cz + rz;
        const scale = fov / totalZ;
        return {
          x: cx + rx * scale,
          y: cy + ry * scale,
          z: totalZ,
        };
      });

      // Draw 3D Edges
      ctx.save();
      ctx.strokeStyle = 'rgba(242, 101, 56, 0.18)';
      ctx.lineWidth = 1.2;
      edges.forEach(([i1, i2]) => {
        const p1 = projectedVertices[i1];
        const p2 = projectedVertices[i2];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw vertex nodes
      projectedVertices.forEach((p) => {
        ctx.fillStyle = 'rgba(242, 101, 56, 0.4)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // 4. Render 3D Drifting Particles
      ctx.save();
      particles.forEach((p) => {
        p.z -= p.speedZ;
        if (p.z <= 10) {
          p.z = 800;
          p.x = (Math.random() - 0.5) * width * 1.5;
          p.y = (Math.random() - 0.5) * height * 1.5;
        }

        const scale = fov / p.z;
        const px = width / 2 + (p.x + tiltX * 120) * scale;
        const py = height / 2 + (p.y + tiltY * 100) * scale;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const alpha = Math.min(1, Math.max(0, (800 - p.z) / 600));
          ctx.fillStyle = p.color.replace(/[\d\.]+\)$/, `${alpha * 0.6})`);
          ctx.beginPath();
          ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={{ opacity: 0.95 }}
    />
  );
}

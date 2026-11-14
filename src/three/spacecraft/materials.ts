import { useMemo } from 'react';
import * as THREE from 'three';
import { createRng } from '@/game/scenarios/rng';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Crinkled multi-layer-insulation foil: a height map made of overlapping soft facets. */
function foilBump(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const rng = createRng(4242);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = rng.range(0, 256);
    const y = rng.range(0, 256);
    const r = rng.range(6, 34);
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    const a = Math.floor(rng.range(60, 200));
    const b = Math.floor(rng.range(60, 200));
    g.addColorStop(0, `rgba(${a},${a},${a},0.5)`);
    g.addColorStop(1, `rgba(${b},${b},${b},0.5)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    const sides = rng.int(3, 5);
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2 + rng.range(0, 1);
      ctx.lineTo(x + Math.cos(ang) * r * rng.range(0.5, 1), y + Math.sin(ang) * r * rng.range(0.5, 1));
    }
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

/** Solar-cell grid for one panel. */
function cellTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#9aa7b8';
  ctx.fillRect(0, 0, 256, 512);
  const cols = 6;
  const rows = 12;
  const gap = 3;
  const cw = (256 - gap * (cols + 1)) / cols;
  const ch = (512 - gap * (rows + 1)) / rows;
  const rng = createRng(99);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = gap + i * (cw + gap);
      const y = gap + j * (ch + gap);
      const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
      const tint = rng.range(-6, 6);
      g.addColorStop(0, `rgb(${14 + tint},${30 + tint},${78 + tint})`);
      g.addColorStop(1, `rgb(${6 + tint},${14 + tint},${44 + tint})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = 'rgba(160,190,235,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + cw / 2, y);
      ctx.lineTo(x + cw / 2, y + ch);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function louverTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 128);
  ctx.fillStyle = '#dfe5ec';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) {
    ctx.fillStyle = 'rgba(40,55,80,0.45)';
    ctx.fillRect(0, y, 64, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, y + 2, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface OrbiterMaterials {
  foil: THREE.MeshStandardMaterial;
  foilDark: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  radiator: THREE.MeshStandardMaterial;
  cells: THREE.MeshStandardMaterial;
  panelBack: THREE.MeshStandardMaterial;
  panelEdge: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshStandardMaterial;
  tank: THREE.MeshStandardMaterial;
  lens: THREE.MeshStandardMaterial;
  ledCyan: THREE.MeshStandardMaterial;
  ledAmber: THREE.MeshStandardMaterial;
}

/** One shared set of PBR materials for the orbiter; textures are generated on a canvas. */
export function useOrbiterMaterials(): OrbiterMaterials {
  return useMemo(() => {
    const bump = foilBump();
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
    return {
      foil: std({ color: '#c9973f', metalness: 1, roughness: 0.3, bumpMap: bump, bumpScale: 1.6, envMapIntensity: 1.25 }),
      foilDark: std({ color: '#3a3f4a', metalness: 0.9, roughness: 0.42, bumpMap: bump, bumpScale: 1.2 }),
      frame: std({ color: '#2a303b', metalness: 0.85, roughness: 0.4 }),
      white: std({ color: '#e8ecf1', metalness: 0.08, roughness: 0.52 }),
      radiator: std({ map: louverTexture(), metalness: 0.35, roughness: 0.35 }),
      cells: std({ map: cellTexture(), metalness: 0.55, roughness: 0.22, envMapIntensity: 1.4, emissive: '#0a1a44', emissiveIntensity: 0.25 }),
      panelBack: std({ color: '#8a6a3c', metalness: 0.5, roughness: 0.55 }),
      panelEdge: std({ color: '#aab4c2', metalness: 0.9, roughness: 0.3 }),
      black: std({ color: '#0c0f14', metalness: 0.4, roughness: 0.6 }),
      steel: std({ color: '#b6bfcb', metalness: 1, roughness: 0.22 }),
      nozzle: std({ color: '#5b4a42', metalness: 0.95, roughness: 0.38, side: THREE.DoubleSide }),
      tank: std({ color: '#d7dbe0', metalness: 0.9, roughness: 0.2 }),
      lens: std({ color: '#0b1630', metalness: 0.9, roughness: 0.05, envMapIntensity: 2 }),
      ledCyan: std({ color: '#0e2a30', emissive: '#52D7E8', emissiveIntensity: 2.4 }),
      ledAmber: std({ color: '#30200a', emissive: '#FFB84D', emissiveIntensity: 2.0 }),
    };
  }, []);
}

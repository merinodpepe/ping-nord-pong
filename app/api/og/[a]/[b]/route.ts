import { getRivalry } from '@/lib/data';
import { initials } from '@/lib/avatar';
import { pfEmblemSVG } from '@/lib/emblem';

// Imagen por rivalidad: el SVG del emblema (pfEmblemSVG) sobre fondo de la marca. Sin dependencias de render.
export async function GET(_: Request, { params }: { params: Promise<{ a: string; b: string }> }) {
  const { a, b } = await params;
  const data = await getRivalry(decodeURIComponent(a), decodeURIComponent(b));
  if (!data) return new Response('not found', { status: 404 });
  const { rivalry: r, a: pa, b: pb } = data;
  const crow = r.crow_id === pa.id ? pa : pb;
  const snake = r.crow_id === pa.id ? pb : pa;
  const inner = pfEmblemSVG(r.emblem_state, r.seed, initials(crow.alias), initials(snake.alias), 400)
    .replace(/^<svg [^>]*>/, '<svg x="400" y="40" width="400" height="533" viewBox="-10 -50 420 560">');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0A1020"/>${inner}` +
    `<text x="600" y="610" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="34" fill="#F2F5FA">${esc(pa.alias)} ${r.wins_low === r.wins_high ? '=' : ''} ${esc(pb.alias)} · ${r.wins_low}–${r.wins_high}</text></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=300, s-maxage=300' } });
}
const esc = (s: string) => s.replace(/[<>&"']/g, '');

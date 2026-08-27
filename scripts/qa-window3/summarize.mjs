// 汇总浏览器走查分片输出，给报告用的一张表。
import fs from 'node:fs';

const files = process.argv.slice(2);
const rows = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const r of j.results) rows.push(r);
}
rows.sort((a, b) => a.id.localeCompare(b.id));

const out = [];
for (const r of rows) {
  const camp = Object.entries(r.campaign || {}).map(([lv, c]) => `${lv}:${c.open === 'clicked' ? '' : c.open + '/'}${c.win ? 'W' : ''}${c.lose ? 'L' : ''}${!c.win && !c.lose ? '-' : ''}`);
  const modes = Object.entries(r.modes || {}).map(([m, c]) => `${m.replace(/^[^\p{L}\p{N}]+/u, '').split(' ')[0]}:${c.enter}${c.win ? '/W' : ''}${c.lose ? '/L' : ''}`);
  out.push({
    id: r.id,
    title: r.title,
    entry: r.entry.entry,
    campaign: camp.join(' '),
    modes: modes.join(' '),
    reentry: `${r.reentry?.first}/${r.reentry?.second}`,
    m_entry: r.mobile?.entry,
    m_overflowHome: r.mobile?.overflowHome?.doc ?? '',
    m_overflowLevel: r.mobile?.overflowLevel?.doc ?? '',
    m_minHit: r.mobile?.minHit?.min ?? '',
    m_minSel: r.mobile?.minHit?.sel ?? '',
    canvas: r.mobile?.canvas ? `${r.mobile.canvas.w}x${r.mobile.canvas.h}` : '',
    errors: (r.errors || []).length,
    err0: (r.errors || [])[0]?.slice(0, 120) ?? '',
    idle: r.idleLose ? `${r.idleLose.win ? 'W' : ''}${r.idleLose.lose ? 'L' : ''}${!r.idleLose.win && !r.idleLose.lose ? '-' : ''}` : 'n/a',
    sec: Math.round((r.ms || 0) / 1000),
  });
}
console.log(JSON.stringify(out, null, 1));

import { readdirSync, readFileSync, existsSync } from "node:fs";

const skip = new Set(["garden-guard", "sprout-defense", "ocean-munch", "fruit-slice", "brave-path"]);
const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const root = "src/games";
for (const id of readdirSync(root).sort()) {
  const f = `${root}/${id}/index.ts`;
  if (!existsSync(f)) continue;
  if (only ? !only.has(id) : skip.has(id)) continue;
  const src = readFileSync(f, "utf8");
  const out = [];
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
    let m;
    while ((m = re.exec(line))) {
      const s = m[2];
      if (/[\u4e00-\u9fa5]/.test(s)) out.push(`${i + 1}: ${s}`);
    }
  });
  if (out.length) {
    console.log(`\n########## ${id} (${out.length}) ##########`);
    console.log(out.join("\n"));
  }
}

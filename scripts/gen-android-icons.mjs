/**
 * 安卓图标已并进 `scripts/gen-icons.mjs`(源图是 public/icons/cover.png)。
 * 保留这个入口,免得有人还按旧文档跑。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(here, "gen-icons.mjs")], {
  stdio: "inherit"
});
child.on("exit", (code) => process.exit(code ?? 1));

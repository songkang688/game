/**
 * Electron 主进程:加载 dist/index.html(或开发服务器)。
 * 安全设置:关闭 nodeIntegration、开启 contextIsolation、禁止外链跳转。
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const DEV_URL = process.env.ELECTRON_START_URL;

/**
 * 存档保险箱:进度另存一份到「文档/一朵一星存档」。
 * 装在 userData 里的 localStorage 会跟着卸载一起没,文档目录不会——
 * 重装后页面开机自检读回这个文件,进度就接上了。
 */
const VAULT_DIR_NAME = "一朵一星存档";
const VAULT_FILE_NAME = "一朵一星存档.json";

function vaultDir() {
  let base;
  try {
    base = app.getPath("documents");
  } catch {
    base = app.getPath("home");
  }
  return path.join(base, VAULT_DIR_NAME);
}

function vaultFile() {
  return path.join(vaultDir(), VAULT_FILE_NAME);
}

function registerVaultIpc() {
  ipcMain.handle("yiduo-vault:where", () => vaultDir());

  ipcMain.handle("yiduo-vault:read", () => {
    try {
      return fs.readFileSync(vaultFile(), "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("yiduo-vault:write", (_event, text) => {
    if (typeof text !== "string" || !text) return false;
    const file = vaultFile();
    const tmp = `${file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // 先留一份上次的:写到一半断电也还有昨天的进度
      if (fs.existsSync(file)) {
        try {
          fs.copyFileSync(file, `${file}.bak`);
        } catch {
          // 备份失败不影响主写入
        }
      }
      // 先写临时文件再改名,避免半截文件
      fs.writeFileSync(tmp, text, "utf8");
      fs.renameSync(tmp, file);
      return true;
    } catch {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        // 清理失败无所谓
      }
      return false;
    }
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, "..", "dist", "icons", "icon-512.png");
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#fff5fa",
    autoHideMenuBar: true,
    title: "一朵一星 1.2 · 76 款原创小游戏合集",
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // 小朋友的应用:禁止弹新窗口、禁止导航到外部地址
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !(DEV_URL && url.startsWith(DEV_URL))) {
      event.preventDefault();
    }
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  registerVaultIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

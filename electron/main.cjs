/**
 * Electron 主进程:加载 dist/index.html(或开发服务器)。
 * 安全设置:关闭 nodeIntegration、开启 contextIsolation、禁止外链跳转。
 */
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const DEV_URL = process.env.ELECTRON_START_URL;

function createWindow() {
  const iconPath = path.join(__dirname, "..", "dist", "icons", "icon-512.png");
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#fff5fa",
    autoHideMenuBar: true,
    title: "一朵一星",
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
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

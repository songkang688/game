/**
 * 预加载脚本:只把「存档保险箱」这一件事递给页面。
 *
 * sandbox 开着,这里拿不到 fs,真正读写在主进程做;页面只能读写那一个存档文件,
 * 碰不到别的路径。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("yiduoVault", {
  kind: "electron",
  where: () => ipcRenderer.invoke("yiduo-vault:where"),
  read: () => ipcRenderer.invoke("yiduo-vault:read"),
  write: (text) => ipcRenderer.invoke("yiduo-vault:write", text)
});

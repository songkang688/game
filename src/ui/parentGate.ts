/**
 * 家长说明:先过一道简单算术门(乘法,小朋友一般不会),
 * 通过后显示家长面板(关于、隐私、清空进度、进度备份、跳关记录)。
 *
 * 1.1 起算术门本身搬到了 `parentAuth.ts`(basic 档),这里只负责调用与面板。
 */
import { save } from "../engine/save";
import { backupToVault, getVault, readEnvelope, restoreFromVault } from "../engine/vault";
import { playSound } from "../engine/audio";
import { loadGames } from "../engine/loader";
import { showDialog } from "./dialogs";
import { clearSkipRecords, formatSkipSummary, readSkipRecords, requestParentAuth } from "./parentAuth";

export function showParentGate(): void {
  void requestParentAuth("basic", "要打开家长面板,先确认一下你是家长。").then((ok) => {
    if (ok) showParentPanel();
  });
}

function showParentPanel(): void {
  const content = document.createElement("div");
  content.className = "parent-content";

  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.textContent = "家长说明";
  content.appendChild(title);

  const list = document.createElement("ul");
  list.className = "parent-list";
  const items = [
    `🌸 「一朵一星」1.3 有 ${loadGames().length} 款原创小游戏。闯关最长 188 关:前 99 关适合低年级,后面的关卡和新玩法会更有挑战。`,
    "🎨 所有游戏均为原创同类型玩法,不使用任何商业 IP。",
    "🚫 无广告、无内购、无联网账号。",
    "💾 星星和进度只存在你自己的设备上,从不上传;还会自动多存一份到应用外面的文件,卸载重装也不丢(见下方「卸载也不丢」)。",
    "⏰ 建议每次游玩不超过 20 分钟,保护眼睛哦。"
  ];
  for (const text of items) {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  }
  content.appendChild(list);

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn btn--danger";
  resetBtn.textContent = "清空全部进度";
  let confirming = false;
  resetBtn.addEventListener("click", () => {
    if (!confirming) {
      confirming = true;
      resetBtn.textContent = "再点一次确认清空";
      return;
    }
    save.resetAll();
    playSound("pop");
    resetBtn.textContent = "已清空 ✓";
    resetBtn.disabled = true;
  });
  content.appendChild(resetBtn);

  // ---- 进度备份:导出 / 导入 ----
  const backupRow = document.createElement("div");
  backupRow.className = "dialog-buttons";

  const feedback = document.createElement("p");
  feedback.className = "dialog-text";
  feedback.hidden = true;
  function setFeedback(text: string, isError = false): void {
    feedback.hidden = false;
    feedback.textContent = text;
    feedback.style.color = isError ? "#c0392b" : "var(--pink-deep)";
  }

  const importArea = document.createElement("div");
  importArea.hidden = true;

  const importInput = document.createElement("textarea");
  importInput.className = "gate-input";
  importInput.rows = 3;
  importInput.placeholder = "把备份文本粘贴到这里";
  importInput.setAttribute("aria-label", "进度备份文本");
  importInput.style.width = "100%";
  importInput.style.resize = "vertical";

  const importConfirmBtn = document.createElement("button");
  importConfirmBtn.type = "button";
  importConfirmBtn.className = "btn btn--primary";
  importConfirmBtn.textContent = "确认导入";
  importConfirmBtn.addEventListener("click", () => {
    const result = save.importAll(importInput.value);
    if (result.ok) {
      playSound("win");
      setFeedback(`导入成功,${result.count} 项进度都回来啦 ✓`);
      importArea.hidden = true;
      importInput.value = "";
    } else {
      playSound("oops");
      setFeedback(result.error, true);
    }
  });
  // 手机上让家长粘贴一长串备份文本太难为人了,给一个直接选备份文件的口子
  const importFileBtn = document.createElement("button");
  importFileBtn.type = "button";
  importFileBtn.className = "btn btn--ghost";
  importFileBtn.textContent = "📄 选择备份文件";

  const importFileInput = document.createElement("input");
  importFileInput.type = "file";
  importFileInput.accept = ".txt,.json,text/plain,application/json";
  importFileInput.hidden = true;
  importFileInput.setAttribute("aria-label", "选择进度备份文件");

  importFileBtn.addEventListener("click", () => {
    playSound("tap");
    importFileInput.click();
  });
  importFileInput.addEventListener("change", () => {
    const file = importFileInput.files?.[0];
    if (!file) return;
    void file
      .text()
      .then((text) => {
        // 自动备份写出去的是带时间戳的信封,手动导出的是裸备份文本,两种都收
        const envelope = readEnvelope(text);
        const result = save.importAll(envelope ? envelope.payload : text);
        if (result.ok) {
          playSound("win");
          setFeedback(`导入成功,${result.count} 项进度都回来啦 ✓`);
          importArea.hidden = true;
        } else {
          playSound("oops");
          setFeedback(result.error, true);
        }
      })
      .catch(() => {
        playSound("oops");
        setFeedback("这个文件读不出来,换一个试试吧", true);
      })
      .finally(() => {
        importFileInput.value = "";
      });
  });

  importArea.append(importInput, importConfirmBtn, importFileBtn, importFileInput);

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn btn--ghost";
  exportBtn.textContent = "📤 导出进度";
  exportBtn.addEventListener("click", () => {
    playSound("tap");
    const text = save.exportAll();
    // 下载 txt 备份文件(剪贴板不可用时也有着落)
    let downloaded = false;
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `一朵一星进度备份-${stamp}.txt`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      downloaded = true;
    } catch {
      // 某些壳环境不支持下载,只走剪贴板
    }
    const fileNote = downloaded ? "并下载了备份文件" : "";
    const clip = navigator.clipboard?.writeText(text);
    if (clip) {
      clip
        .then(() => setFeedback(`已复制到剪贴板${fileNote ? "," + fileNote : ""},收好哦 ✓`))
        .catch(() =>
          setFeedback(
            downloaded ? "已下载备份文件,收好哦 ✓" : "导出失败了,换个浏览器试试吧",
            !downloaded
          )
        );
    } else {
      setFeedback(
        downloaded ? "已下载备份文件,收好哦 ✓" : "导出失败了,换个浏览器试试吧",
        !downloaded
      );
    }
  });

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "btn btn--ghost";
  importBtn.textContent = "📥 导入进度";
  importBtn.addEventListener("click", () => {
    playSound("tap");
    importArea.hidden = !importArea.hidden;
    if (!importArea.hidden) importInput.focus();
  });

  backupRow.append(exportBtn, importBtn);
  content.append(backupRow, importArea, feedback, buildVaultSection(), buildSkipSection());

  showDialog({
    className: "dialog--parent",
    content,
    dismissible: true,
    buttons: [{ label: "关闭", kind: "ghost", onClick: () => undefined }]
  });
}

/**
 * 「卸载也不丢」一段:把进度自动多存一份到应用外面的文件里。
 *
 * 三种设备说法不一样,按实际能用的通道给不同的话术:
 *  - 桌面安装版 / 安卓包:开箱就在写,家长只需要知道存在哪儿;
 *  - 桌面浏览器:要家长亲手选一次文件夹(浏览器的规矩,必须有用户手势);
 *  - 手机浏览器:选不了文件夹,只能引导用上面的导出/导入。
 */
function buildVaultSection(): HTMLElement {
  const box = document.createElement("div");
  box.className = "parent-vault";

  const heading = document.createElement("h3");
  heading.className = "dialog-title";
  heading.textContent = "卸载也不丢";
  box.appendChild(heading);

  const note = document.createElement("p");
  note.className = "dialog-text";
  box.appendChild(note);

  const status = document.createElement("p");
  status.className = "dialog-text";
  box.appendChild(status);

  const row = document.createElement("div");
  row.className = "dialog-buttons";
  box.appendChild(row);

  const connectBtn = document.createElement("button");
  connectBtn.type = "button";
  connectBtn.className = "btn btn--primary";
  connectBtn.textContent = "📁 选择存档文件夹";

  const backupBtn = document.createElement("button");
  backupBtn.type = "button";
  backupBtn.className = "btn btn--ghost";
  backupBtn.textContent = "💾 立即备份一次";

  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "btn btn--ghost";
  restoreBtn.textContent = "♻️ 从备份恢复";

  const vault = getVault();

  function setStatus(text: string, isError = false): void {
    status.textContent = text;
    status.style.color = isError ? "#c0392b" : "var(--pink-deep)";
  }

  function render(): void {
    if (vault.kind === "none") {
      note.textContent =
        "这台设备的浏览器不支持自动存到文件夹。请用上面的「导出进度」存一份备份文件,换设备或重装后再「导入进度」。";
      row.hidden = true;
      status.hidden = true;
      return;
    }
    if (vault.kind === "electron" || vault.kind === "capacitor") {
      note.textContent =
        "进度会自动多存一份到应用外面的文件里。卸载或重装本应用都不会删掉它,重新装好打开就自动接回来。";
      connectBtn.hidden = true;
    } else {
      note.textContent =
        "选一个文件夹(建议放在「文档」里),进度会自动写进去。浏览器数据被清掉或换台机器时,重新选同一个文件夹就能接回来。";
    }
    void vault.ready().then((ok) => {
      setStatus(ok ? `正在自动备份到:${vault.location}` : "还没开启,点下面的按钮选个文件夹吧。");
      backupBtn.disabled = !ok;
      restoreBtn.disabled = !ok;
    });
  }

  connectBtn.addEventListener("click", () => {
    playSound("tap");
    void vault.connect().then((ok) => {
      if (!ok) {
        setStatus("没有选好文件夹,再试一次吧。", true);
        return;
      }
      playSound("win");
      void backupToVault().then((written) => {
        setStatus(
          written ? `好啦,正在自动备份到:${vault.location}` : `已记住文件夹,但这次没写进去,请检查文件夹权限。`,
          !written
        );
        backupBtn.disabled = false;
        restoreBtn.disabled = false;
      });
    });
  });

  backupBtn.addEventListener("click", () => {
    playSound("tap");
    backupBtn.disabled = true;
    void backupToVault().then((ok) => {
      backupBtn.disabled = false;
      setStatus(ok ? `已存好:${vault.location}` : "这次没写进去,请检查文件夹还在不在。", !ok);
    });
  });

  let confirming = false;
  restoreBtn.addEventListener("click", () => {
    if (!confirming) {
      confirming = true;
      restoreBtn.textContent = "再点一次用备份覆盖现在的进度";
      return;
    }
    confirming = false;
    restoreBtn.textContent = "♻️ 从备份恢复";
    playSound("tap");
    void restoreFromVault(true).then((result) => {
      if (result.ok) {
        playSound("win");
        const when = result.savedAt ? `(${result.savedAt.slice(0, 10)} 存的)` : "";
        setStatus(`恢复成功,${result.count} 项进度都回来啦 ${when}✓`);
      } else {
        playSound("oops");
        setStatus(vaultErrorText(result.reason, result.error), true);
      }
    });
  });

  row.append(connectBtn, backupBtn, restoreBtn);
  render();
  return box;
}

/** 把恢复失败的原因翻译成家长看得懂的一句话 */
function vaultErrorText(reason: string, detail?: string): string {
  if (reason === "no-vault") return "还没开启自动备份。";
  if (reason === "no-file") return "那个位置还没有备份文件。";
  if (reason === "bad-file") return "备份文件看不懂,可能被改过或不是本应用的。";
  if (reason === "import-failed") return detail ?? "备份没能读进来。";
  return "暂时恢复不了,请稍后再试。";
}

/** id → 中文名;拿不到游戏清单时退回用 id 显示 */
function gameTitles(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    for (const g of loadGames()) map.set(g.meta.id, g.meta.title);
  } catch {
    // 清单读不出来不影响看记录
  }
  return map;
}

/**
 * 「跳关记录」一段:哪些游戏被跳过了几关(读 `yiduo-yixing.l99skip.<id>`),
 * 并给一个二次确认的「清空全部跳关记录」。只动这一组 key,不碰星级与钱包存档。
 */
function buildSkipSection(): HTMLElement {
  const box = document.createElement("div");
  box.className = "parent-skip";

  const heading = document.createElement("h3");
  heading.className = "dialog-title";
  heading.textContent = "跳关记录";
  box.appendChild(heading);

  const note = document.createElement("p");
  note.className = "dialog-text";
  note.textContent = "孩子每次跳关都要你亲自确认,这里能看到跳过的关卡。跳过的关记 0 星,随时可以回去重打。";
  box.appendChild(note);

  const list = document.createElement("ul");
  list.className = "parent-list";
  box.appendChild(list);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn btn--ghost";
  clearBtn.textContent = "🧹 清空全部跳关记录";

  function renderList(): void {
    list.innerHTML = "";
    const records = readSkipRecords();
    if (records.length === 0) {
      const li = document.createElement("li");
      li.textContent = "暂无";
      list.appendChild(li);
      clearBtn.disabled = true;
      return;
    }
    const titles = gameTitles();
    for (const rec of records) {
      const li = document.createElement("li");
      li.textContent = `🎮 《${titles.get(rec.gameId) ?? rec.gameId}》:${formatSkipSummary(rec.levels)}`;
      list.appendChild(li);
    }
    clearBtn.disabled = false;
  }

  let confirming = false;
  clearBtn.addEventListener("click", () => {
    if (!confirming) {
      confirming = true;
      clearBtn.textContent = "再点一次确认清空";
      return;
    }
    clearSkipRecords();
    playSound("pop");
    confirming = false;
    clearBtn.textContent = "已清空 ✓";
    renderList();
    clearBtn.disabled = true;
  });

  box.appendChild(clearBtn);
  renderList();
  return box;
}

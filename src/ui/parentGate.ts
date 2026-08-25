/**
 * 家长说明:先过一道简单算术门(乘法,一年级小朋友一般不会),
 * 通过后显示家长面板(关于、隐私、清空进度)。
 */
import { save } from "../engine/save";
import { playSound } from "../engine/audio";
import { showDialog } from "./dialogs";

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// 防暴力试答案:答错 3 次锁 30 秒。
// 用模块级时间戳记录,关闭弹窗再打开也不重置(刷新页面才清零,不进存档)。
const MAX_WRONG = 3;
const LOCK_MS = 30_000;
let lockUntil = 0;
let wrongStreak = 0;

export function showParentGate(): void {
  const content = document.createElement("div");
  content.className = "gate-content";

  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.textContent = "家长请回答";
  content.appendChild(title);

  const hint = document.createElement("p");
  hint.className = "dialog-text";
  hint.textContent = "为了确认是家长本人,请回答一道乘法题:";
  content.appendChild(hint);

  const question = document.createElement("div");
  question.className = "gate-question";
  content.appendChild(question);

  const input = document.createElement("input");
  input.className = "gate-input";
  input.type = "number";
  input.inputMode = "numeric";
  input.placeholder = "答案";
  input.setAttribute("aria-label", "算术题答案");
  content.appendChild(input);

  const lockMsg = document.createElement("p");
  lockMsg.className = "dialog-text";
  lockMsg.style.color = "var(--pink-deep)";
  lockMsg.style.fontWeight = "bold";
  lockMsg.hidden = true;
  content.appendChild(lockMsg);

  let answer = 0;
  function newQuestion(): void {
    const a = rand(3, 9);
    const b = rand(3, 9);
    answer = a * b;
    question.textContent = `${a} × ${b} = ?`;
    input.value = "";
    input.focus();
  }

  const handle = showDialog({
    className: "dialog--gate",
    content,
    dismissible: true,
    buttons: []
  });

  const row = document.createElement("div");
  row.className = "dialog-buttons";

  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "btn btn--primary";
  okBtn.textContent = "确认";

  let wasLocked = false;
  function refreshLock(): void {
    const remainMs = lockUntil - Date.now();
    const locked = remainMs > 0;
    okBtn.disabled = locked;
    input.disabled = locked;
    lockMsg.hidden = !locked;
    if (locked) {
      lockMsg.textContent = `休息一下,${Math.ceil(remainMs / 1000)} 秒后再试`;
    } else if (wasLocked) {
      // 倒计时刚结束:换一道新题重新来
      newQuestion();
    }
    wasLocked = locked;
  }

  // 每半秒刷新一次倒计时;弹窗被关掉(节点脱离文档)后自动停表
  const lockTimer = window.setInterval(() => {
    if (!content.isConnected) {
      window.clearInterval(lockTimer);
      return;
    }
    refreshLock();
  }, 500);

  okBtn.addEventListener("click", () => {
    if (Date.now() < lockUntil) return;
    if (Number(input.value) === answer) {
      playSound("coin");
      wrongStreak = 0;
      window.clearInterval(lockTimer);
      handle.close();
      showParentPanel();
    } else {
      playSound("oops");
      handle.el.classList.remove("dialog--shake");
      // 触发重排以便重新播放抖动动画
      void handle.el.offsetWidth;
      handle.el.classList.add("dialog--shake");
      wrongStreak += 1;
      if (wrongStreak >= MAX_WRONG) {
        wrongStreak = 0;
        lockUntil = Date.now() + LOCK_MS;
      }
      newQuestion();
      refreshLock();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") okBtn.click();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn--ghost";
  cancelBtn.textContent = "返回";
  cancelBtn.addEventListener("click", () => {
    window.clearInterval(lockTimer);
    handle.close();
  });

  row.append(okBtn, cancelBtn);
  content.appendChild(row);
  newQuestion();
  refreshLock();
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
    "🌸 「一朵一星」是送给一年级左右小朋友的小游戏合集。",
    "🎨 所有游戏均为原创同类型玩法,不使用任何商业 IP。",
    "🚫 无广告、无内购、无联网账号。",
    "💾 星星和进度只保存在本机(localStorage),不上传。",
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
  importArea.append(importInput, importConfirmBtn);

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
  content.append(backupRow, importArea, feedback);

  showDialog({
    className: "dialog--parent",
    content,
    dismissible: true,
    buttons: [{ label: "关闭", kind: "ghost", onClick: () => undefined }]
  });
}

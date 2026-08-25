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
  okBtn.addEventListener("click", () => {
    if (Number(input.value) === answer) {
      playSound("coin");
      handle.close();
      showParentPanel();
    } else {
      playSound("oops");
      handle.el.classList.remove("dialog--shake");
      // 触发重排以便重新播放抖动动画
      void handle.el.offsetWidth;
      handle.el.classList.add("dialog--shake");
      newQuestion();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") okBtn.click();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn--ghost";
  cancelBtn.textContent = "返回";
  cancelBtn.addEventListener("click", () => handle.close());

  row.append(okBtn, cancelBtn);
  content.appendChild(row);
  newQuestion();
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

  showDialog({
    className: "dialog--parent",
    content,
    dismissible: true,
    buttons: [{ label: "关闭", kind: "ghost", onClick: () => undefined }]
  });
}

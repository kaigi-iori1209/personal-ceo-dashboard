const TODO_KEY = "todoRoadmap.tasks";
const ROADMAP_KEY = "todoRoadmap.goals";
const GOAL_TREE_KEY = "todoRoadmap.goalTree";

const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".tab-panel");
const todoForm = document.querySelector("#todoForm");
const openTodoFormButton = document.querySelector("#openTodoForm");
const todoList = document.querySelector("#todoList");
const focusList = document.querySelector("#focusList");
const doneLog = document.querySelector("#doneLog");
const filterInput = document.querySelector("#filterInput");
const totalCount = document.querySelector("#totalCount");
const doneCount = document.querySelector("#doneCount");
const weeklyRateText = document.querySelector("#weeklyRateText");
const weeklyRateBar = document.querySelector("#weeklyRateBar");
const todayFinalGoal = document.querySelector("#todayFinalGoal");
const goalFields = document.querySelectorAll("[data-goal]");
const roadmapView = document.querySelector("#roadmapView");
const roadmapForm = document.querySelector("#roadmapForm");
const toggleRoadmapEditButton = document.querySelector("#toggleRoadmapEdit");
const saveGoalTreeButton = document.querySelector("#saveGoalTree");
const formTitle = document.querySelector("#formTitle");
const submitButton = document.querySelector("#submitButton");
const cancelEditButton = document.querySelector("#cancelEdit");
const titleInput = document.querySelector("#titleInput");
const categoryInput = document.querySelector("#categoryInput");
const priorityInput = document.querySelector("#priorityInput");
const dueInput = document.querySelector("#dueInput");
const urlInput = document.querySelector("#urlInput");
const memoInput = document.querySelector("#memoInput");

let todos = loadData(TODO_KEY, []).map(normalizeTodo);
const oldRoadmap = loadData(ROADMAP_KEY, {});
let goalTree = {
  finalGoal: "",
  oneYear: oldRoadmap.oneYear || "",
  sixMonths: oldRoadmap.sixMonths || "",
  threeMonths: oldRoadmap.threeMonths || "",
  thisMonth: oldRoadmap.thisMonth || "",
  today: "",
  ...loadData(GOAL_TREE_KEY, {})
};
let editingId = null;

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTodo(todo) {
  return {
    id: todo.id || crypto.randomUUID(),
    title: todo.title || "",
    category: normalizeCategory(todo.category),
    priority: normalizePriority(todo.priority),
    due: todo.due || "",
    url: todo.url || "",
    memo: todo.memo || "",
    done: Boolean(todo.done),
    createdAt: todo.createdAt || "",
    completedAt: todo.completedAt || ""
  };
}

function normalizeCategory(category) {
  const categories = ["仕事", "副業", "動画制作", "学習", "生活", "その他"];
  return categories.includes(category) ? category : "その他";
}

function normalizePriority(priority) {
  const priorities = ["高", "中", "低"];
  return priorities.includes(priority) ? priority : "中";
}

function saveTodos() {
  localStorage.setItem(TODO_KEY, JSON.stringify(todos));
}

function saveGoalTree(closeEditor = false) {
  goalFields.forEach((field) => {
    goalTree[field.dataset.goal] = field.value.trim();
  });
  localStorage.setItem(GOAL_TREE_KEY, JSON.stringify(goalTree));
  renderRoadmap();
  renderToday();
  if (closeEditor) roadmapForm.classList.add("hidden");
}

function getFormTodo(formData) {
  return {
    title: formData.get("title").trim(),
    category: formData.get("category"),
    priority: formData.get("priority"),
    due: formData.get("due"),
    url: formData.get("url").trim(),
    memo: formData.get("memo").trim()
  };
}

function createTodo(formData) {
  return {
    id: crypto.randomUUID(),
    ...getFormTodo(formData),
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: ""
  };
}

function getDaysUntil(due) {
  const today = new Date();
  const dueDate = new Date(`${due}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate - today) / 86400000);
}

function getDueState(due) {
  if (!due) return "none";
  const daysLeft = getDaysUntil(due);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 3) return "soon3";
  if (daysLeft <= 7) return "soon7";
  return "normal";
}

function getDueLabel(todo) {
  const labels = {
    none: "期限なし",
    overdue: "期限切れ",
    soon3: "3日以内",
    soon7: "7日以内",
    normal: todo.due
  };
  return todo.due ? `${todo.due} / ${labels[getDueState(todo.due)]}` : labels.none;
}

function getPriorityScore(priority) {
  return { "高": 3, "中": 2, "低": 1 }[priority] || 0;
}

function getPriorityClass(priority) {
  if (priority === "高") return "high";
  if (priority === "低") return "low";
  return "mid";
}

function getFocusTodos() {
  return todos
    .filter((todo) => !todo.done)
    .sort((a, b) => {
      const priorityDiff = getPriorityScore(b.priority) - getPriorityScore(a.priority);
      const dueA = a.due ? getDaysUntil(a.due) : Number.MAX_SAFE_INTEGER;
      const dueB = b.due ? getDaysUntil(b.due) : Number.MAX_SAFE_INTEGER;
      return priorityDiff || dueA - dueB;
    })
    .slice(0, 3);
}

function renderFocus() {
  const focusTodos = getFocusTodos();
  focusList.innerHTML = "";

  if (focusTodos.length === 0) {
    focusList.innerHTML = '<p class="empty compact">今は集中タスクがありません</p>';
    return;
  }

  focusTodos.forEach((todo) => {
    const item = document.createElement("article");
    item.className = "focus-card compact-task";
    item.innerHTML = `
      <input type="checkbox" aria-label="完了にする">
      <div>
        <p class="todo-title"></p>
        <div class="meta">
          <span class="badge priority-${getPriorityClass(todo.priority)}">${todo.priority}</span>
          <span class="badge due-${getDueState(todo.due)}">${getDueLabel(todo)}</span>
        </div>
      </div>
    `;
    item.querySelector(".todo-title").textContent = todo.title;
    item.querySelector("input").addEventListener("change", () => toggleTodo(todo.id));
    focusList.appendChild(item);
  });
}

function renderTodos() {
  const category = filterInput.value;
  const visibleTodos = category === "all" ? todos : todos.filter((todo) => todo.category === category);
  todoList.innerHTML = "";

  if (visibleTodos.length === 0) {
    todoList.innerHTML = '<p class="empty">TODOはまだありません。</p>';
  }

  visibleTodos.forEach((todo) => {
    const card = document.createElement("article");
    card.className = `todo-card ${todo.done ? "done" : ""}`;
    card.innerHTML = `
      <div class="todo-main">
        <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="完了にする">
        <div>
          <p class="todo-title"></p>
          <div class="meta">
            <span class="badge">${todo.category}</span>
            <span class="badge priority-${getPriorityClass(todo.priority)}">${todo.priority}</span>
            <span class="badge due-${getDueState(todo.due)}">${getDueLabel(todo)}</span>
          </div>
        </div>
        <div class="card-actions">
          ${todo.url ? '<button class="open-btn" type="button">開く</button>' : ""}
          <button class="edit-btn" type="button">編集</button>
          <button class="delete-btn" type="button">削除</button>
        </div>
      </div>
      <p class="todo-memo"></p>
    `;
    card.querySelector(".todo-title").textContent = todo.title;
    card.querySelector(".todo-memo").textContent = todo.memo;
    card.querySelector("input").addEventListener("change", () => toggleTodo(todo.id));
    card.querySelector(".edit-btn").addEventListener("click", () => startEdit(todo.id));
    card.querySelector(".delete-btn").addEventListener("click", () => deleteTodo(todo.id));
    const openButton = card.querySelector(".open-btn");
    if (openButton) openButton.addEventListener("click", () => window.open(todo.url, "_blank", "noopener"));
    todoList.appendChild(card);
  });

  renderToday();
  renderDoneLog();
  renderHeaderCounts();
}

function renderToday() {
  const rate = getWeeklyRate();
  todayFinalGoal.textContent = goalTree.finalGoal || "未設定";
  weeklyRateText.textContent = `${rate}%`;
  weeklyRateBar.style.width = `${Math.min(rate, 100)}%`;
  renderFocus();
}

function renderHeaderCounts() {
  const active = todos.filter((todo) => !todo.done).length;
  const done = todos.filter((todo) => todo.done).length;
  totalCount.textContent = `未完了 ${active}`;
  doneCount.textContent = `完了 ${done}`;
}

function renderDoneLog() {
  const doneTodos = todos
    .filter((todo) => todo.done)
    .sort((a, b) => getDateTime(b.completedAt) - getDateTime(a.completedAt));
  doneLog.innerHTML = "";

  if (doneTodos.length === 0) {
    doneLog.innerHTML = '<p class="empty compact">完了ログはまだありません。</p>';
    return;
  }

  const groups = {};
  doneTodos.forEach((todo) => {
    const dateKey = formatDate(todo.completedAt || new Date().toISOString());
    groups[dateKey] = groups[dateKey] || [];
    groups[dateKey].push(todo);
  });

  Object.entries(groups).forEach(([date, items]) => {
    const group = document.createElement("section");
    group.className = "done-group";
    group.innerHTML = `<h3>${date}</h3><div class="done-items"></div>`;
    const list = group.querySelector(".done-items");

    items.forEach((todo) => {
      const row = document.createElement("article");
      row.className = "done-item";
      row.innerHTML = `
        <div>
          <p class="todo-title"></p>
          <div class="meta">
            <span class="badge">${todo.category}</span>
            <span class="badge priority-${getPriorityClass(todo.priority)}">${todo.priority}</span>
            <span class="badge">${formatDateTime(todo.completedAt)}</span>
          </div>
        </div>
        <button class="delete-btn" type="button">削除</button>
      `;
      row.querySelector(".todo-title").textContent = todo.title;
      row.querySelector("button").addEventListener("click", () => deleteTodo(todo.id));
      list.appendChild(row);
    });

    doneLog.appendChild(group);
  });
}

function renderRoadmap() {
  goalFields.forEach((field) => {
    field.value = goalTree[field.dataset.goal] || "";
  });

  const items = [
    ["最終目標", goalTree.finalGoal],
    ["1年後", goalTree.oneYear],
    ["半年後", goalTree.sixMonths],
    ["3ヶ月後", goalTree.threeMonths],
    ["今月", goalTree.thisMonth],
    ["今日", goalTree.today]
  ];

  roadmapView.innerHTML = "";
  items.forEach(([label, text]) => {
    const item = document.createElement("article");
    item.className = "roadmap-node";
    item.innerHTML = `<span>${label}</span><p></p>`;
    item.querySelector("p").textContent = text || "未設定";
    roadmapView.appendChild(item);
  });
}

function getWeeklyRate() {
  const weekStart = getWeekStart();
  const added = todos.filter((todo) => getDateTime(todo.createdAt) >= weekStart).length;
  const completed = todos.filter((todo) => getDateTime(todo.completedAt) >= weekStart).length;
  return added === 0 ? 0 : Math.round((completed / added) * 100);
}

function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateTime(value) {
  return value ? new Date(value) : new Date(0);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "完了日なし";
  return new Date(value).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function switchTab(tabName) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
}

function openTodoForm() {
  todoForm.classList.remove("hidden");
  todoForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function startEdit(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  editingId = id;
  titleInput.value = todo.title;
  categoryInput.value = todo.category;
  priorityInput.value = todo.priority;
  dueInput.value = todo.due;
  urlInput.value = todo.url;
  memoInput.value = todo.memo;
  formTitle.textContent = "Edit TODO";
  submitButton.textContent = "更新する";
  openTodoForm();
}

function resetForm() {
  editingId = null;
  todoForm.reset();
  formTitle.textContent = "New TODO";
  submitButton.textContent = "追加する";
  todoForm.classList.add("hidden");
}

function toggleTodo(id) {
  todos = todos.map((todo) => {
    if (todo.id !== id) return todo;
    const nextDone = !todo.done;
    return { ...todo, done: nextDone, completedAt: nextDone ? new Date().toISOString() : "" };
  });
  saveTodos();
  renderTodos();
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  if (editingId === id) resetForm();
  saveTodos();
  renderTodos();
}

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(todoForm);

  if (editingId) {
    todos = todos.map((todo) => (
      todo.id === editingId ? { ...todo, ...getFormTodo(formData) } : todo
    ));
  } else {
    todos.unshift(createTodo(formData));
  }

  saveTodos();
  resetForm();
  renderTodos();
  switchTab("tasks");
});

tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
openTodoFormButton.addEventListener("click", openTodoForm);
cancelEditButton.addEventListener("click", resetForm);
filterInput.addEventListener("change", renderTodos);
toggleRoadmapEditButton.addEventListener("click", () => roadmapForm.classList.toggle("hidden"));
saveGoalTreeButton.addEventListener("click", () => saveGoalTree(true));
goalFields.forEach((field) => field.addEventListener("blur", () => saveGoalTree(false)));

saveTodos();
renderRoadmap();
renderTodos();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

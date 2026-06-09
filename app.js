const STORAGE_KEYS = {
  todos: "todoRoadmap.tasks",
  roadmap: "todoRoadmap.goals",
  goalTree: "todoRoadmap.goalTree",
  supabase: "personalCeo.supabaseConfig",
  syncMeta: "personalCeo.syncMeta"
};

const ROADMAP_LABELS = {
  finalGoal: "最終目標",
  oneYear: "1年後",
  sixMonths: "半年後",
  threeMonths: "3ヶ月後",
  thisMonth: "今月",
  today: "今日",
  none: "なし"
};

const ROADMAP_ORDER = ["finalGoal", "oneYear", "sixMonths", "threeMonths", "thisMonth", "today"];

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
const roadmapLinkInput = document.querySelector("#roadmapLinkInput");
const urlInput = document.querySelector("#urlInput");
const memoInput = document.querySelector("#memoInput");
const exportBackupButton = document.querySelector("#exportBackup");
const importBackupButton = document.querySelector("#importBackupButton");
const importBackupInput = document.querySelector("#importBackupInput");
const dataMessage = document.querySelector("#dataMessage");
const supabaseUrlInput = document.querySelector("#supabaseUrlInput");
const supabaseAnonKeyInput = document.querySelector("#supabaseAnonKeyInput");
const saveSupabaseConfigButton = document.querySelector("#saveSupabaseConfig");
const testSupabaseConnectionButton = document.querySelector("#testSupabaseConnection");
const syncNowButton = document.querySelector("#syncNow");
const syncStatus = document.querySelector("#syncStatus");

let todos = [];
let goalTree = {};
let supabaseConfig = {};
let syncTimer = null;
let suppressSync = false;
let editingId = null;

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (key !== STORAGE_KEYS.syncMeta) {
    localStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ updatedAt: new Date().toISOString() }));
  }
  if (!suppressSync && key !== STORAGE_KEYS.supabase && key !== STORAGE_KEYS.syncMeta) {
    scheduleSupabaseSync();
  }
}

function loadAppData() {
  const oldRoadmap = loadData(STORAGE_KEYS.roadmap, {});
  todos = loadData(STORAGE_KEYS.todos, []).map(normalizeTodo);
  goalTree = {
    finalGoal: "",
    oneYear: oldRoadmap.oneYear || "",
    sixMonths: oldRoadmap.sixMonths || "",
    threeMonths: oldRoadmap.threeMonths || "",
    thisMonth: oldRoadmap.thisMonth || "",
    today: "",
    ...loadData(STORAGE_KEYS.goalTree, {})
  };
  supabaseConfig = loadData(STORAGE_KEYS.supabase, { url: "", anonKey: "" });
}

function getAllStoredData() {
  return {
    [STORAGE_KEYS.todos]: todos,
    [STORAGE_KEYS.roadmap]: loadData(STORAGE_KEYS.roadmap, {}),
    [STORAGE_KEYS.goalTree]: goalTree,
    [STORAGE_KEYS.supabase]: supabaseConfig
  };
}

function applyStoredData(data, updatedAt = new Date().toISOString()) {
  suppressSync = true;
  Object.entries(data).forEach(([key, value]) => {
    if (Object.values(STORAGE_KEYS).includes(key) && key !== STORAGE_KEYS.syncMeta) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
  localStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ updatedAt }));
  suppressSync = false;
  loadAppData();
}

function saveTodos() {
  saveData(STORAGE_KEYS.todos, todos);
}

function normalizeTodo(todo) {
  return {
    id: todo.id || crypto.randomUUID(),
    title: todo.title || "",
    category: normalizeCategory(todo.category),
    priority: normalizePriority(todo.priority),
    due: todo.due || "",
    roadmapLink: normalizeRoadmapLink(todo.roadmapLink),
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

function normalizeRoadmapLink(link) {
  return [...ROADMAP_ORDER, "none"].includes(link) ? link : "none";
}

function saveGoalTree(closeEditor = false) {
  goalFields.forEach((field) => {
    goalTree[field.dataset.goal] = field.value.trim();
  });
  saveData(STORAGE_KEYS.goalTree, goalTree);
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
    roadmapLink: formData.get("roadmapLink"),
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
      const todayDiff = Number(b.roadmapLink === "today") - Number(a.roadmapLink === "today");
      const priorityDiff = getPriorityScore(b.priority) - getPriorityScore(a.priority);
      const dueA = a.due ? getDaysUntil(a.due) : Number.MAX_SAFE_INTEGER;
      const dueB = b.due ? getDaysUntil(b.due) : Number.MAX_SAFE_INTEGER;
      return todayDiff || priorityDiff || dueA - dueB;
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
            <span class="badge link-badge">${ROADMAP_LABELS[todo.roadmapLink]}</span>
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
  renderRoadmap();
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
  totalCount.textContent = `未完了 ${todos.filter((todo) => !todo.done).length}`;
  doneCount.textContent = `完了 ${todos.filter((todo) => todo.done).length}`;
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

  roadmapView.innerHTML = "";
  ROADMAP_ORDER.forEach((key) => {
    const linkedTodos = todos.filter((todo) => todo.roadmapLink === key);
    const done = linkedTodos.filter((todo) => todo.done).length;
    const total = linkedTodos.length;
    const rate = total === 0 ? 0 : Math.round((done / total) * 100);
    const item = document.createElement("article");
    item.className = "roadmap-node";
    item.innerHTML = `
      <span>${ROADMAP_LABELS[key]}</span>
      <p></p>
      <div class="roadmap-rate">${done}/${total} 完了 ${rate}%</div>
      <div class="linked-todos"></div>
    `;
    item.querySelector("p").textContent = goalTree[key] || "未設定";
    const linkedList = item.querySelector(".linked-todos");
    linkedTodos.slice(0, 5).forEach((todo) => {
      const row = document.createElement("div");
      row.className = `linked-todo ${todo.done ? "done" : ""}`;
      row.textContent = todo.title;
      linkedList.appendChild(row);
    });
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
  roadmapLinkInput.value = todo.roadmapLink;
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

function getBackupData() {
  return {
    app: "Personal CEO",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: getAllStoredData()
  };
}

function exportBackup() {
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(getBackupData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `personal-ceo-backup-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showDataMessage("JSONを書き出しました。");
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      const data = backup.data || backup;
      if (!Array.isArray(data[STORAGE_KEYS.todos])) throw new Error("TODOデータが見つかりません。");
      if (!confirm("現在のデータをバックアップ内容で復元します。よろしいですか？")) return;

      applyStoredData(data);
      renderAll();
      showDataMessage("読み込みが完了しました。");
    } catch {
      showDataMessage("不正なJSONです。読み込みできませんでした。", true);
    }
  };
  reader.readAsText(file);
}

function showDataMessage(message, isError = false) {
  dataMessage.textContent = message;
  dataMessage.classList.toggle("error", isError);
}

function saveSupabaseConfig() {
  supabaseConfig = {
    url: supabaseUrlInput.value.trim(),
    anonKey: supabaseAnonKeyInput.value.trim()
  };
  saveData(STORAGE_KEYS.supabase, supabaseConfig);
  scheduleSupabaseSync();
  setSyncStatus("Supabase設定を保存しました。");
}

function renderSupabaseConfig() {
  supabaseUrlInput.value = supabaseConfig.url || "";
  supabaseAnonKeyInput.value = supabaseConfig.anonKey || "";
  const meta = loadData(STORAGE_KEYS.syncMeta, {});
  if (meta.lastSyncedAt) setSyncStatus(`最終同期: ${formatDateTime(meta.lastSyncedAt)}`);
}

function hasSupabaseConfig() {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

function getSupabaseUrl(path) {
  return `${supabaseConfig.url.trim().replace(/\/+$/, "")}/rest/v1/${path}`;
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: supabaseConfig.anonKey,
    Authorization: `Bearer ${supabaseConfig.anonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function fetchSupabaseRecord() {
  if (!hasSupabaseConfig()) return null;
  const response = await fetch(getSupabaseUrl("app_data?id=eq.dashboard"), {
    headers: getSupabaseHeaders()
  });
  if (!response.ok) throw new Error(await getSupabaseErrorMessage(response));
  const rows = await response.json();
  return rows[0] || null;
}

async function pushSupabaseData() {
  if (!hasSupabaseConfig()) return false;
  const updatedAt = new Date().toISOString();
  const response = await fetch(getSupabaseUrl("app_data?on_conflict=id"), {
    method: "POST",
    headers: getSupabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({
      id: "dashboard",
      data: getAllStoredData(),
      updated_at: updatedAt
    })
  });
  if (!response.ok) throw new Error(await getSupabaseErrorMessage(response));
  localStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({
    ...loadData(STORAGE_KEYS.syncMeta, {}),
    updatedAt,
    lastSyncedAt: updatedAt
  }));
  setSyncStatus(`同期成功: ${formatDateTime(updatedAt)}`);
  return true;
}

function scheduleSupabaseSync() {
  if (!hasSupabaseConfig()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    pushSupabaseData().catch((error) => setSyncStatus(`同期失敗: ${error.message}`, true));
  }, 800);
}

async function syncNow() {
  try {
    await pushSupabaseData();
  } catch (error) {
    setSyncStatus(`同期失敗: ${error.message}`, true);
  }
}

async function testSupabaseConnection() {
  saveSupabaseConfig();
  try {
    await fetchSupabaseRecord();
    setSyncStatus("接続テスト成功");
  } catch (error) {
    setSyncStatus(`接続テスト失敗: ${error.message}`, true);
  }
}

async function getSupabaseErrorMessage(response) {
  const body = await response.text();
  let detail = body;
  try {
    const json = JSON.parse(body);
    detail = json.message || json.error_description || json.error || body;
  } catch {
    detail = body || response.statusText;
  }
  return `HTTP ${response.status}: ${detail}`;
}

async function hydrateFromSupabase() {
  if (!hasSupabaseConfig()) return;
  try {
    const remote = await fetchSupabaseRecord();
    if (!remote) return;
    const localMeta = loadData(STORAGE_KEYS.syncMeta, {});
    const localUpdated = new Date(localMeta.updatedAt || 0).getTime();
    const remoteUpdated = new Date(remote.updated_at || 0).getTime();
    if (remoteUpdated > localUpdated) {
      applyStoredData(remote.data || {}, remote.updated_at);
      setSyncStatus(`Supabaseから復元: ${formatDateTime(remote.updated_at)}`);
    } else {
      await pushSupabaseData();
    }
  } catch (error) {
    setSyncStatus(`同期失敗: ${error.message}`, true);
  }
}

function setSyncStatus(message, isError = false) {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("error", isError);
}

function renderAll() {
  saveTodos();
  renderSupabaseConfig();
  renderRoadmap();
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
exportBackupButton.addEventListener("click", exportBackup);
importBackupButton.addEventListener("click", () => importBackupInput.click());
importBackupInput.addEventListener("change", () => importBackup(importBackupInput.files[0]));
saveSupabaseConfigButton.addEventListener("click", saveSupabaseConfig);
testSupabaseConnectionButton.addEventListener("click", testSupabaseConnection);
syncNowButton.addEventListener("click", syncNow);

async function initializeApp() {
  loadAppData();
  await hydrateFromSupabase();
  renderAll();
}

initializeApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

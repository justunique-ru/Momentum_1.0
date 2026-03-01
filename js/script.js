import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB0MdvdOuHVaYUd38FxPJ6yG4W9aSQPwhU",
  authDomain: "momentum-frontend-4d144.firebaseapp.com",
  projectId: "momentum-frontend-4d144",
  storageBucket: "momentum-frontend-4d144.firebasestorage.app",
  messagingSenderId: "929664395924",
  appId: "1:929664395924:web:5cf8deab615ad35262a281",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

let currentUser = null;

// Кэши данных пользователя (хранение на клиенте, но источник — Firestore)
let globalDataCache = null;
const dayDataCache = {};
let wishlistCategoriesCache = null;
let goalsCache = null;
let moneyCategoriesCache = null;
let transactionsCache = null;
let notesCache = null;
let recentColorsCache = null;

function updateUserInfoUI(user) {
  const el = document.getElementById("user-info");
  if (!el) return;
  if (user) {
    el.textContent = `Вы вошли как: ${user.displayName || user.email}`;
  } else {
    el.textContent = "Вы не авторизованы";
  }
}

async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    currentUser = user;

    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email,
        name: user.displayName || "",
        photoURL: user.photoURL || "",
      },
      { merge: true },
    );
  } catch (error) {
    console.error(error);
    alert("Ошибка входа через Google");
  }
}

async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
    // Локальные кэши очищаем, т.к. они относятся к пользователю
    globalDataCache = null;
    Object.keys(dayDataCache).forEach((k) => delete dayDataCache[k]);
    wishlistCategoriesCache = null;
    goalsCache = null;
    moneyCategoriesCache = null;
    transactionsCache = null;
    notesCache = null;
    recentColorsCache = null;
  } catch (error) {
    console.error(error);
  }
}

window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

// Привязываем обработчики к кнопкам авторизации в сайдбаре
const googleLoginBtn = document.getElementById("googleLoginBtn");
const googleLogoutBtn = document.getElementById("googleLogoutBtn");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    loginWithGoogle();
  });
}
if (googleLogoutBtn) {
  googleLogoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

async function ensureGlobalDataLoaded() {
  if (!currentUser || globalDataCache) return;
  const ref = doc(db, "globalData", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    globalDataCache = snap.data();
  }
}

async function preloadAllDays() {
  if (!currentUser) return;
  const snap = await getDocs(collection(db, "days"));
  snap.forEach((docSnap) => {
    const id = docSnap.id;
    const prefix = currentUser.uid + "_";
    if (id.startsWith(prefix)) {
      const key = id.substring(prefix.length);
      dayDataCache[key] = docSnap.data();
    }
  });
}

async function ensureWishlistLoaded() {
  if (!currentUser || wishlistCategoriesCache) return;
  const ref = doc(db, "wishlistCategories", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    wishlistCategoriesCache = snap.data().categories || [];
  } else {
    wishlistCategoriesCache = [];
  }
}

async function ensureGoalsLoaded() {
  if (!currentUser || goalsCache) return;
  const ref = doc(db, "goals", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    goalsCache = snap.data().goals || [];
  } else {
    goalsCache = [];
  }
}

async function ensureMoneyLoaded() {
  if (!currentUser || moneyCategoriesCache || transactionsCache) return;
  const ref = doc(db, "money", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    moneyCategoriesCache = data.categories || null;
    transactionsCache = data.transactions || [];
  } else {
    moneyCategoriesCache = null;
    transactionsCache = [];
  }
}

async function ensureNotesLoaded() {
  if (!currentUser || notesCache) return;
  const ref = doc(db, "notes", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    notesCache = snap.data().notes || [];
  } else {
    notesCache = [];
  }
}

async function ensureRecentColorsLoaded() {
  if (!currentUser || recentColorsCache) return;
  const ref = doc(db, "recentColors", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    recentColorsCache = snap.data().colors || ["#7c3aed", "#ef4444", "#10b981"];
  } else {
    recentColorsCache = ["#7c3aed", "#ef4444", "#10b981"];
  }
}

async function preloadUserData() {
  await Promise.all([ensureGlobalDataLoaded(), preloadAllDays(), ensureWishlistLoaded(), ensureGoalsLoaded(), ensureMoneyLoaded(), ensureNotesLoaded(), ensureRecentColorsLoaded()]);
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateUserInfoUI(user);

  if (user) {
    await preloadUserData();
    if (typeof render === "function") {
      render();
    }
    if (typeof attachGoalsEventListeners === "function" && document.getElementById("goalsList")) {
      attachGoalsEventListeners();
    }
  } else {
    if (typeof render === "function") {
      render();
    }
    if (typeof attachGoalsEventListeners === "function" && document.getElementById("goalsList")) {
      attachGoalsEventListeners();
    }
  }
});

// State Management
function getTodayGMT3() {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt3Time = new Date(utcTime + 3 * 60 * 60 * 1000);
  return new Date(gmt3Time.getFullYear(), gmt3Time.getMonth(), gmt3Time.getDate(), 12, 0, 0);
}

let currentDate = getTodayGMT3();
let calendarDate = getTodayGMT3();
let editMode = null;

// Default data
const defaultHabits = [
  { id: 1, name: "Morning meditation", points: 10, color: "#10b981" },
  { id: 2, name: "Exercise", points: 15, color: "#f59e0b" },
  { id: 3, name: "Read 30 mins", points: 10, color: "#3b82f6" },
  { id: 4, name: "Drink 8 glasses water", points: 5, color: "#06b6d4" },
];

const defaultPomoCategories = [
  { id: 1, name: "Deep Work", color: "#7c3aed", count: 4, pointsEach: 10 },
  { id: 2, name: "Learning", color: "#ec4899", count: 3, pointsEach: 8 },
  { id: 3, name: "Admin", color: "#6b7280", count: 2, pointsEach: 5 },
];

const defaultTreats = [
  { id: 1, name: "Coffee break", cost: 15, sale: null },
  { id: 2, name: "Netflix episode", cost: 30, sale: null },
  { id: 3, name: "Snack", cost: 10, sale: null },
  { id: 4, name: "Gaming hour", cost: 50, sale: null },
];

// Utility functions
function getDateKey(date) {
  return date.toISOString().split("T")[0];
}

function loadGlobalData() {
  if (currentUser && globalDataCache) {
    return globalDataCache;
  }
  return {
    habits: [...defaultHabits],
    pomoCategories: [...defaultPomoCategories],
    treats: [...defaultTreats],
  };
}

function saveGlobalData(data) {
  if (currentUser) {
    globalDataCache = data;
    setDoc(doc(db, "globalData", currentUser.uid), data).catch(console.error);
  }
}

function loadDayData(date) {
  const key = getDateKey(date);
  if (currentUser && dayDataCache[key]) {
    return dayDataCache[key];
  }

  const global = loadGlobalData();
  return {
    habitsCompleted: [],
    pomosCompleted: global.pomoCategories.map((c) => ({ id: c.id, completed: [] })),
    tasks: [],
    treatsUsed: global.treats.map((t) => ({ id: t.id, count: 0 })),
  };
}

function saveDayData(date, data) {
  const key = getDateKey(date);
  if (currentUser) {
    dayDataCache[key] = data;
    const payload = {
      ...data,
      userId: currentUser.uid,
      dateKey: key,
    };
    setDoc(doc(db, "days", `${currentUser.uid}_${key}`), payload).catch(console.error);
  }
}

function formatDate(date) {
  const today = getTodayGMT3();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (getDateKey(date) === getDateKey(today)) return "Today";
  if (getDateKey(date) === getDateKey(yesterday)) return "Yesterday";
  if (getDateKey(date) === getDateKey(tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function getTreatCurrentCost(treat, date) {
  if (!treat.sale || !treat.sale.days || treat.sale.days.length === 0) {
    return treat.cost;
  }
  const dayOfWeek = date.getDay();
  if (treat.sale.days.includes(dayOfWeek)) {
    return treat.sale.price;
  }
  return treat.cost;
}

function isTreatOnSale(treat, date) {
  if (!treat.sale || !treat.sale.days || treat.sale.days.length === 0) {
    return false;
  }
  const dayOfWeek = date.getDay();
  return treat.sale.days.includes(dayOfWeek);
}

// Render functions
function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calendarMonth");
  const today = getTodayGMT3();

  monthLabel.textContent = calendarDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const lastDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7;

  grid.innerHTML = "";

  for (let i = 0; i < startDay; i++) {
    grid.innerHTML += '<div class="h-8"></div>';
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day, 12, 0, 0);
    const dayKey = getDateKey(date);
    const isSelected = getDateKey(currentDate) === dayKey;
    const isToday = getDateKey(today) === dayKey;
    const hasData = currentUser && dayDataCache[dayKey];
    const points = hasData ? calculateDayPoints(date) : 0;

    grid.innerHTML += `
      <div class="calendar-day h-8 w-8 flex items-center justify-center text-xs rounded-lg relative
          ${isSelected ? "selected" : ""} ${isToday && !isSelected ? "today" : ""} ${points > 0 ? "has-points" : ""}"
          data-date="${dayKey}">
          ${day}
      </div>
    `;
  }

  grid.querySelectorAll(".calendar-day").forEach((el) => {
    el.addEventListener("click", () => {
      const [year, month, dayNum] = el.dataset.date.split("-").map(Number);
      currentDate = new Date(year, month - 1, dayNum, 12, 0, 0);
      render();
    });
  });
}

function renderHabits() {
  const container = document.getElementById("habitsList");
  const global = loadGlobalData();
  const dayData = loadDayData(currentDate);

  container.innerHTML = global.habits
    .map((habit) => {
      const isCompleted = dayData.habitsCompleted.includes(habit.id);
      return `
                    <div class="item-row flex items-center gap-3 p-2.5 ${isCompleted ? "completed" : ""}" 
                         draggable="true" data-id="${habit.id}" data-type="habit">
                        <div class="check-circle w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                             style="border-color: ${habit.color}; ${isCompleted ? `background: ${habit.color}` : ""}"
                             data-id="${habit.id}">
                            ${isCompleted ? '<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' : ""}
                        </div>
                        <span class="flex-1 text-sm text-gray-700">${habit.name}</span>
                        <span class="text-xs font-medium text-gray-400">${habit.points}</span>
                    </div>
                `;
    })
    .join("");

  container.querySelectorAll(".check-circle").forEach((el) => {
    el.addEventListener("click", () => toggleHabit(parseInt(el.dataset.id)));
  });

  setupDragDrop(container, "habits");
}

function renderPomodoros() {
  const container = document.getElementById("pomodorosList");
  const global = loadGlobalData();
  const dayData = loadDayData(currentDate);

  container.innerHTML = global.pomoCategories
    .map((cat) => {
      const catData = dayData.pomosCompleted.find((p) => p.id === cat.id) || { completed: [] };
      const completedCount = catData.completed.length;
      return `
                    <div class="flex items-center gap-4" data-id="${cat.id}" data-type="pomo">
                        <div class="flex-1">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                    <div class="w-2 h-2 rounded-full" style="background: ${cat.color}"></div>
                                    <span class="text-sm font-medium text-gray-800">${cat.name}</span>
                                </div>
                                <span class="text-xs text-gray-400">${completedCount}/${cat.count} • ${cat.pointsEach} pts each</span>
                            </div>
                            <div class="flex gap-2">
                                ${Array(cat.count)
                                  .fill(0)
                                  .map((_, i) => {
                                    const isCompleted = catData.completed.includes(i);
                                    return `
                                        <div class="pomo-dot w-5 h-5 rounded-xl flex items-center justify-center text-xs font-medium
                                            ${isCompleted ? "text-white" : "text-gray-400 border-2 border-gray-200 bg-gray-50"}"
                                            style="${isCompleted ? `background: ${cat.color}` : ""}"
                                            data-cat="${cat.id}" data-idx="${i}">
                                            ${isCompleted ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' : i + 1}
                                        </div>
                                    `;
                                  })
                                  .join("")}
                            </div>
                        </div>
                    </div>
                `;
    })
    .join("");

  container.querySelectorAll(".pomo-dot").forEach((el) => {
    el.addEventListener("click", () => togglePomo(parseInt(el.dataset.cat), parseInt(el.dataset.idx)));
  });
}

function renderTasks() {
  const container = document.getElementById("tasksList");
  const dayData = loadDayData(currentDate);
  const goals = loadGoals();

  if (dayData.tasks.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No tasks yet. Add one below!</div>';
  } else {
    container.innerHTML = dayData.tasks
      .map((task, idx) => {
        // Get goal name if task is from a goal
        let goalLabel = "";
        if (task.goalId && task.goalName) {
          goalLabel = `<span class="goal-label" title="${task.goalName}">${task.goalName}</span>`;
        } else if (task.goalId) {
          // Fallback: find goal name from goals data
          const goal = goals.find((g) => g.id === task.goalId);
          if (goal) {
            goalLabel = `<span class="goal-label" title="${goal.name}">${goal.name}</span>`;
          }
        }

        return `
                    <div class="task-item flex items-center gap-3 p-2.5 rounded-xl group ${task.completed ? "completed" : ""}" data-idx="${idx}">
                        <input type="checkbox" class="task-checkbox w-4 h-4 accent-violet-600 rounded" ${task.completed ? "checked" : ""} data-idx="${idx}">
                        <span class="task-name flex-1 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded" data-idx="${idx}">${task.name}</span>
                        ${goalLabel}
                        <span class="task-points text-xs font-medium text-gray-400 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded" data-idx="${idx}">${task.points}</span>
                        <div class="task-actions flex gap-0.5">
                            <button class="postpone-task btn-icon p-1.5 rounded-lg" data-idx="${idx}" title="Move to tomorrow">
                                <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                                </svg>
                            </button>
                            <button class="delete-task btn-icon p-1.5 rounded-lg" data-idx="${idx}" title="Delete">
                                <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
      })
      .join("");
  }

  container.querySelectorAll(".task-checkbox").forEach((el) => {
    el.addEventListener("change", () => toggleTask(parseInt(el.dataset.idx)));
  });

  container.querySelectorAll(".task-name").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      startTaskNameEdit(parseInt(el.dataset.idx), el);
    });
  });

  container.querySelectorAll(".task-points").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      startTaskPointsEdit(parseInt(el.dataset.idx), el);
    });
  });

  container.querySelectorAll(".postpone-task").forEach((el) => {
    el.addEventListener("click", () => postponeTask(parseInt(el.dataset.idx)));
  });
  container.querySelectorAll(".delete-task").forEach((el) => {
    el.addEventListener("click", () => deleteTask(parseInt(el.dataset.idx)));
  });

  const totalTaskPoints = dayData.tasks.filter((t) => t.completed).reduce((sum, t) => sum + t.points, 0);
  document.getElementById("taskPoints").textContent = `${totalTaskPoints} pts`;
}

function startTaskNameEdit(idx, element) {
  const dayData = loadDayData(currentDate);
  const task = dayData.tasks[idx];
  const currentText = task.name;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "flex-1 text-sm text-gray-700 px-2 py-1 border-2 border-violet-500 rounded outline-none bg-white";
  input.value = currentText;

  element.replaceWith(input);
  input.focus();
  input.select();

  const saveEdit = () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== currentText) {
      const dayData = loadDayData(currentDate);
      dayData.tasks[idx].name = newValue;
      saveDayData(currentDate, dayData);
    }
    renderTasks();
  };

  input.addEventListener("blur", saveEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      renderTasks();
    }
  });
}

function startTaskPointsEdit(idx, element) {
  const dayData = loadDayData(currentDate);
  const task = dayData.tasks[idx];
  const currentPoints = task.points;

  const input = document.createElement("input");
  input.type = "number";
  input.className = "w-12 text-xs font-medium text-gray-700 px-2 py-1 border-2 border-violet-500 rounded outline-none bg-white text-center";
  input.value = currentPoints;
  input.min = "0";

  element.replaceWith(input);
  input.focus();
  input.select();

  const saveEdit = () => {
    const newValue = parseInt(input.value) || 0;
    if (newValue !== currentPoints) {
      const dayData = loadDayData(currentDate);
      dayData.tasks[idx].points = newValue;
      saveDayData(currentDate, dayData);
    }
    renderTasks();
    renderPoints();
  };

  input.addEventListener("blur", saveEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      renderTasks();
    }
  });
}

function renderTreats() {
  const container = document.getElementById("treatsList");
  const global = loadGlobalData();
  const dayData = loadDayData(currentDate);
  const allTimePoints = calculateAllTimePoints();

  document.getElementById("treatsSpent").textContent = `${allTimePoints.spent} total spent`;

  container.innerHTML = global.treats
    .map((treat) => {
      const treatData = dayData.treatsUsed.find((t) => t.id === treat.id) || { count: 0 };
      const isOnSale = isTreatOnSale(treat, currentDate);
      const currentCost = getTreatCurrentCost(treat, currentDate);

      let priceDisplay = "";
      if (isOnSale) {
        const isFree = currentCost === 0;
        const salePriceText = isFree ? "FREE" : `-${currentCost} pts`;
        const freeClass = isFree ? "free" : "";
        priceDisplay = `
          <span class="original-price">-${treat.cost}</span>
          <span class="sale-price ${freeClass} ml-1">${salePriceText}</span>
          <span class="sale-badge ml-1">SALE</span>
        `;
      } else {
        priceDisplay = `<span class="text-xs text-rose-400">-${treat.cost} pts</span>`;
      }

      return `
        <div class="treat-item flex items-center gap-3 p-3 rounded-xl border ${isOnSale ? "border-rose-300 bg-rose-50" : "border-gray-100"} affordable" 
             data-id="${treat.id}">
            <div class="flex-1">
                <span class="text-sm font-medium text-gray-800">${treat.name}</span>
                <div class="flex items-center gap-1">
                  ${priceDisplay}
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="treat-dec w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-sm font-bold ${treatData.count === 0 ? "invisible" : ""}" data-id="${treat.id}">−</button>
                <span class="treat-count text-sm font-semibold w-6 text-center cursor-pointer" data-id="${treat.id}">${treatData.count}</span>
                <button class="treat-inc w-6 h-6 rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 flex items-center justify-center text-sm font-bold" data-id="${treat.id}">+</button>
            </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".treat-inc").forEach((el) => {
    el.addEventListener("click", () => changeTreat(parseInt(el.dataset.id), 1));
  });
  container.querySelectorAll(".treat-dec").forEach((el) => {
    el.addEventListener("click", () => changeTreat(parseInt(el.dataset.id), -1));
  });
  container.querySelectorAll(".treat-count").forEach((el) => {
    el.addEventListener("click", () => editTreatCount(parseInt(el.dataset.id)));
  });
}

function renderStats() {
  const container = document.getElementById("statsChart");
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - i);
    days.push(date);
  }

  let maxHabits = 1,
    maxPomos = 1,
    maxTasks = 1;
  const global = loadGlobalData();

  days.forEach((date) => {
    const dayData = loadDayData(date);
    maxHabits = Math.max(maxHabits, global.habits.length);
    maxPomos = Math.max(
      maxPomos,
      global.pomoCategories.reduce((sum, c) => sum + c.count, 0),
    );
    maxTasks = Math.max(maxTasks, dayData.tasks.length || 1);
  });

  container.innerHTML = days
    .map((date) => {
      const dayData = loadDayData(date);
      const habitsCompleted = dayData.habitsCompleted.length;
      const pomosCompleted = dayData.pomosCompleted.reduce((sum, p) => sum + p.completed.length, 0);
      const tasksCompleted = dayData.tasks.filter((t) => t.completed).length;

      const hHeight = (habitsCompleted / maxHabits) * 100;
      const pHeight = (pomosCompleted / maxPomos) * 100;
      const tHeight = (tasksCompleted / maxTasks) * 100;

      const dayName = date.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
      const isToday = getDateKey(date) === getDateKey(currentDate);

      return `
                    <div class="flex-1 flex flex-col items-center stat-group cursor-pointer" 
                         data-habits="${habitsCompleted}" data-pomos="${pomosCompleted}" data-tasks="${tasksCompleted}"
                         data-date="${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}">
                        <div class="flex-1 w-full flex items-end justify-center gap-0.5 pb-2">
                            <div class="stat-bar w-2 bg-emerald-400" style="height: ${Math.max(hHeight, 4)}%"></div>
                            <div class="stat-bar w-2 bg-violet-400" style="height: ${Math.max(pHeight, 4)}%"></div>
                            <div class="stat-bar w-2 bg-amber-400" style="height: ${Math.max(tHeight, 4)}%"></div>
                        </div>
                        <span class="text-xs font-medium ${isToday ? "text-violet-600" : "text-gray-400"}">${dayName}</span>
                    </div>
                `;
    })
    .join("");

  container.querySelectorAll(".stat-group").forEach((el) => {
    el.addEventListener("mouseenter", (e) => {
      const tooltip = document.getElementById("tooltip");
      tooltip.innerHTML = `
                        <div class="font-semibold mb-1">${el.dataset.date}</div>
                        <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>Habits: ${el.dataset.habits}</div>
                        <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-violet-400"></span>Pomodorros: ${el.dataset.pomos}</div>
                        <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-400"></span>Tasks: ${el.dataset.tasks}</div>
                    `;
      tooltip.classList.remove("hidden");
      const rect = el.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + "px";
      tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + "px";
    });
    el.addEventListener("mouseleave", () => {
      document.getElementById("tooltip").classList.add("hidden");
    });
  });
}

function renderPoints() {
  const allTimePoints = calculateAllTimePoints();
  const todayEarned = calculateTodayEarned(currentDate);
  const dayData = loadDayData(currentDate);

  const totalPointsEl = document.getElementById("totalPoints");
  totalPointsEl.textContent = allTimePoints.available;

  if (allTimePoints.available < 0) {
    totalPointsEl.classList.add("text-rose-200");
  } else {
    totalPointsEl.classList.remove("text-rose-200");
  }

  document.getElementById("totalEarned").textContent = allTimePoints.earned;
  document.getElementById("totalSpent").textContent = allTimePoints.spent;
  document.getElementById("habitsCompleted").textContent = dayData.habitsCompleted.length;
  document.getElementById("pomosCompleted").textContent = dayData.pomosCompleted.reduce((sum, p) => sum + p.completed.length, 0);
  document.getElementById("tasksCompleted").textContent = dayData.tasks.filter((t) => t.completed).length;

  document.getElementById("pointsTrend").textContent = `+${todayEarned} today`;
}

function calculateDayPoints(date) {
  const global = loadGlobalData();
  const dayData = loadDayData(date);

  let points = 0;

  dayData.habitsCompleted.forEach((id) => {
    const habit = global.habits.find((h) => h.id === id);
    if (habit) points += habit.points;
  });

  dayData.pomosCompleted.forEach((pomo) => {
    const cat = global.pomoCategories.find((c) => c.id === pomo.id);
    if (cat) points += pomo.completed.length * cat.pointsEach;
  });

  dayData.tasks.forEach((task) => {
    if (task.completed) points += task.points;
  });

  points -= calculateSpentPoints(date);

  return points;
}

function calculateSpentPoints(date) {
  const global = loadGlobalData();
  const dayData = loadDayData(date);
  let spent = 0;

  dayData.treatsUsed.forEach((t) => {
    const treat = global.treats.find((tr) => tr.id === t.id);
    if (treat) {
      const cost = getTreatCurrentCost(treat, date);
      spent += t.count * cost;
    }
  });

  return spent;
}

function calculateAllTimePoints() {
  const global = loadGlobalData();
  let totalEarned = 0;
  let totalSpent = 0;

  const allDays = currentUser ? Object.entries(dayDataCache) : [];
  allDays.forEach(([key, dayData]) => {
    const date = new Date(key);

    dayData.habitsCompleted?.forEach((id) => {
      const habit = global.habits.find((h) => h.id === id);
      if (habit) totalEarned += habit.points;
    });

    dayData.pomosCompleted?.forEach((pomo) => {
      const cat = global.pomoCategories.find((c) => c.id === pomo.id);
      if (cat) totalEarned += pomo.completed.length * cat.pointsEach;
    });

    dayData.tasks?.forEach((task) => {
      if (task.completed) totalEarned += task.points;
    });

    dayData.treatsUsed?.forEach((t) => {
      const treat = global.treats.find((tr) => tr.id === t.id);
      if (treat) {
        const cost = getTreatCurrentCost(treat, date);
        totalSpent += t.count * cost;
      }
    });
  });

  const goals = loadGoals();
  goals.forEach((goal) => {
    if (goal.milestones) {
      goal.milestones.forEach((m) => {
        if (m.completed) {
          totalEarned += m.points || 10;
        }
        if (m.tasks) {
          m.tasks.forEach((t) => {
            if (t.subtasks) {
              t.subtasks.forEach((st) => {
                if (st.completed) {
                  totalEarned += st.points || 2;
                }
              });
            }
          });
        }
      });
    }
  });

  return { earned: totalEarned, spent: totalSpent, available: totalEarned - totalSpent };
}

function calculateTodayEarned(date) {
  const global = loadGlobalData();
  const dayData = loadDayData(date);
  let points = 0;

  dayData.habitsCompleted.forEach((id) => {
    const habit = global.habits.find((h) => h.id === id);
    if (habit) points += habit.points;
  });

  dayData.pomosCompleted.forEach((pomo) => {
    const cat = global.pomoCategories.find((c) => c.id === pomo.id);
    if (cat) points += pomo.completed.length * cat.pointsEach;
  });

  dayData.tasks.forEach((task) => {
    if (task.completed) points += task.points;
  });

  return points;
}

// Action handlers
function toggleHabit(id) {
  const dayData = loadDayData(currentDate);
  const idx = dayData.habitsCompleted.indexOf(id);
  if (idx >= 0) {
    dayData.habitsCompleted.splice(idx, 1);
  } else {
    dayData.habitsCompleted.push(id);
  }
  saveDayData(currentDate, dayData);
  render();
}

function togglePomo(catId, idx) {
  const dayData = loadDayData(currentDate);
  let catData = dayData.pomosCompleted.find((p) => p.id === catId);
  if (!catData) {
    catData = { id: catId, completed: [] };
    dayData.pomosCompleted.push(catData);
  }

  const completedIdx = catData.completed.indexOf(idx);
  if (completedIdx >= 0) {
    catData.completed.splice(completedIdx, 1);
  } else {
    catData.completed.push(idx);
  }
  saveDayData(currentDate, dayData);
  render();
}

function toggleTask(idx) {
  const dayData = loadDayData(currentDate);
  const task = dayData.tasks[idx];
  task.completed = !task.completed;
  saveDayData(currentDate, dayData);

  // Sync with Goals if this task came from a goal milestone
  if (task.goalId && task.milestoneId && task.goalTaskId) {
    const goals = loadGoals();
    const goal = goals.find((g) => g.id === task.goalId);
    if (goal && goal.milestones) {
      const milestone = goal.milestones.find((m) => m.id === task.milestoneId);
      if (milestone && milestone.tasks) {
        const goalTask = milestone.tasks.find((t) => t.id === task.goalTaskId);
        if (goalTask) {
          goalTask.completed = task.completed;
          saveGoals(goals);
        }
      }
    }
  }

  // Sync with subtask if this is a subtask
  if (task.goalId && task.milestoneId && task.goalTaskId && task.subtaskId) {
    const goals = loadGoals();
    const goal = goals.find((g) => g.id === task.goalId);
    if (goal && goal.milestones) {
      const milestone = goal.milestones.find((m) => m.id === task.milestoneId);
      if (milestone && milestone.tasks) {
        const goalTask = milestone.tasks.find((t) => t.id === task.goalTaskId);
        if (goalTask && goalTask.subtasks) {
          const subtask = goalTask.subtasks.find((st) => st.id === task.subtaskId);
          if (subtask) {
            subtask.completed = task.completed;
            saveGoals(goals);
          }
        }
      }
    }
  }

  render();
}

function addTask() {
  const input = document.getElementById("newTaskInput");
  const pointsInput = document.getElementById("newTaskPoints");
  if (!input.value.trim()) return;

  const dayData = loadDayData(currentDate);
  dayData.tasks.push({
    name: input.value.trim(),
    points: parseInt(pointsInput.value) || 5,
    completed: false,
  });
  saveDayData(currentDate, dayData);
  input.value = "";
  render();
}

function postponeTask(idx) {
  const dayData = loadDayData(currentDate);
  const task = dayData.tasks.splice(idx, 1)[0];
  task.completed = false;

  const nextDay = new Date(currentDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayData = loadDayData(nextDay);
  nextDayData.tasks.push(task);

  saveDayData(currentDate, dayData);
  saveDayData(nextDay, nextDayData);
  render();
}

function deleteTask(idx) {
  if (!confirm("Delete this task?")) return;
  const dayData = loadDayData(currentDate);
  dayData.tasks.splice(idx, 1);
  saveDayData(currentDate, dayData);
  render();
}

function changeTreat(id, delta) {
  const dayData = loadDayData(currentDate);
  const global = loadGlobalData();
  const treat = global.treats.find((t) => t.id === id);

  let treatData = dayData.treatsUsed.find((t) => t.id === id);
  if (!treatData) {
    treatData = { id, count: 0 };
    dayData.treatsUsed.push(treatData);
  }

  treatData.count = Math.max(0, treatData.count + delta);
  saveDayData(currentDate, dayData);
  render();
}

function editTreatCount(id) {
  const dayData = loadDayData(currentDate);
  let treatData = dayData.treatsUsed.find((t) => t.id === id);
  if (!treatData) {
    treatData = { id, count: 0 };
    dayData.treatsUsed.push(treatData);
  }

  const newCount = prompt("Number of treats:", treatData.count);
  if (newCount === null) return;
  treatData.count = Math.max(0, parseInt(newCount) || 0);
  saveDayData(currentDate, dayData);
  render();
}

// Modal functions
function openEditModal(type) {
  editMode = type;
  const modal = document.getElementById("editModal");
  const title = document.getElementById("modalTitle");
  const content = document.getElementById("modalContent");
  const global = loadGlobalData();

  let items, fields;
  switch (type) {
    case "habits":
      title.textContent = "Edit Habits";
      items = global.habits;
      fields = ["name", "points", "color"];
      break;
    case "pomodoros":
      title.textContent = "Edit Focus Categories";
      items = global.pomoCategories;
      fields = ["name", "count", "pointsEach", "color"];
      break;
    case "treats":
      title.textContent = "Edit Treats";
      items = global.treats;
      fields = ["name", "cost"];
      break;
  }

  content.innerHTML =
    items
      .map((item, idx) => {
        const hasSale = item.sale && item.sale.days && item.sale.days.length > 0;
        const saleButton =
          type === "treats"
            ? `
          <button class="sale-btn p-1.5 rounded-lg border ${hasSale ? "has-sale border-rose-200" : "border-gray-200"} text-xs font-medium" data-idx="${idx}" title="Configure sale">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          </button>
        `
            : "";

        return `
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl" draggable="true" data-idx="${idx}">
              <div class="flex flex-col gap-0.5">
                  <button class="move-up text-gray-300 hover:text-gray-500 text-xs" data-idx="${idx}">▲</button>
                  <button class="move-down text-gray-300 hover:text-gray-500 text-xs" data-idx="${idx}">▼</button>
              </div>
              <div class="flex-1 flex gap-2 items-center">
                  ${fields
                    .map((f) => {
                      if (f === "color") {
                        return `<input type="color" class="w-8 h-8 rounded-lg cursor-pointer border-0" data-field="${f}" value="${item[f]}">`;
                      }
                      if (f === "emoji") {
                        return `<input type="text" class="w-12 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-lg" data-field="${f}" value="${item[f]}">`;
                      }
                      return `<input type="${f === "points" || f === "cost" || f === "count" || f === "pointsEach" ? "number" : "text"}" 
                          class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" data-field="${f}" value="${item[f]}" placeholder="${f}">`;
                    })
                    .join("")}
                  ${saleButton}
              </div>
              <button class="delete-item text-gray-300 hover:text-rose-500 transition" data-idx="${idx}">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
              </button>
          </div>
      `;
      })
      .join("") +
    `
          <button id="addNewItem" class="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-violet-400 hover:text-violet-500 transition font-medium">
              + Add New
          </button>
      `;

  content.querySelectorAll(".move-up").forEach((el) => {
    el.addEventListener("click", () => moveItem(parseInt(el.dataset.idx), -1));
  });
  content.querySelectorAll(".move-down").forEach((el) => {
    el.addEventListener("click", () => moveItem(parseInt(el.dataset.idx), 1));
  });
  content.querySelectorAll(".delete-item").forEach((el) => {
    el.addEventListener("click", () => deleteItem(parseInt(el.dataset.idx)));
  });
  content.querySelectorAll(".sale-btn").forEach((el) => {
    el.addEventListener("click", () => openSaleModal(parseInt(el.dataset.idx)));
  });
  document.getElementById("addNewItem").addEventListener("click", addNewItem);

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

let currentSaleIdx = null;

function openSaleModal(idx) {
  currentSaleIdx = idx;
  const global = loadGlobalData();
  const treat = global.treats[idx];

  const saleModal = document.getElementById("saleModal");
  if (!saleModal) {
    createSaleModal();
  }

  const salePriceInput = document.getElementById("salePriceInput");
  const dayCheckboxes = document.querySelectorAll(".sale-day-checkbox");

  if (treat.sale) {
    salePriceInput.value = treat.sale.price || "";
    dayCheckboxes.forEach((cb) => {
      cb.checked = treat.sale.days && treat.sale.days.includes(parseInt(cb.value));
      updateDayCheckboxStyle(cb);
    });
  } else {
    salePriceInput.value = "";
    dayCheckboxes.forEach((cb) => {
      cb.checked = false;
      updateDayCheckboxStyle(cb);
    });
  }

  document.getElementById("saleModal").classList.remove("hidden");
  document.getElementById("saleModal").classList.add("flex");
}

function closeSaleModal() {
  document.getElementById("saleModal").classList.add("hidden");
  document.getElementById("saleModal").classList.remove("flex");
  currentSaleIdx = null;
}

function saveSale() {
  if (currentSaleIdx === null) return;

  const global = loadGlobalData();
  const salePriceInput = document.getElementById("salePriceInput");
  const dayCheckboxes = document.querySelectorAll(".sale-day-checkbox:checked");

  const priceValue = salePriceInput.value;
  const price = priceValue !== "" ? parseInt(priceValue) : null;
  const days = Array.from(dayCheckboxes).map((cb) => parseInt(cb.value));

  if (days.length > 0 && price !== null && price >= 0) {
    global.treats[currentSaleIdx].sale = { price, days };
  } else {
    global.treats[currentSaleIdx].sale = null;
  }

  saveGlobalData(global);
  closeSaleModal();
  openEditModal("treats");
}

function updateDayCheckboxStyle(checkbox) {
  const label = checkbox.closest(".day-checkbox-label");
  if (checkbox.checked) {
    label.classList.add("checked");
  } else {
    label.classList.remove("checked");
  }
}

function createSaleModal() {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayValues = [1, 2, 3, 4, 5, 6, 0];

  const modalHtml = `
    <div id="saleModal" class="fixed inset-0 modal-overlay hidden items-center justify-center z-[60]">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div class="flex justify-between items-center mb-5">
          <h3 class="text-lg font-bold text-gray-900">Configure Sale</h3>
          <button id="closeSaleModal" class="btn-icon p-2 rounded-lg text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Sale Price (points)</label>
            <input type="number" id="salePriceInput" min="0" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white" placeholder="Enter discounted price">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Sale Days</label>
            <div class="grid grid-cols-7 gap-1">
              ${dayNames
                .map(
                  (day, idx) => `
                <label class="day-checkbox-label flex flex-col items-center p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" class="sale-day-checkbox hidden" value="${dayValues[idx]}">
                  <span class="text-xs font-medium text-gray-600">${day}</span>
                </label>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button id="clearSaleBtn" class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition">Clear Sale</button>
          <button id="saveSaleBtn" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition">Save Sale</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document.getElementById("closeSaleModal").addEventListener("click", closeSaleModal);
  document.getElementById("saveSaleBtn").addEventListener("click", saveSale);
  document.getElementById("clearSaleBtn").addEventListener("click", () => {
    document.getElementById("salePriceInput").value = "";
    document.querySelectorAll(".sale-day-checkbox").forEach((cb) => {
      cb.checked = false;
      updateDayCheckboxStyle(cb);
    });
    saveSale();
  });

  document.querySelectorAll(".sale-day-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => updateDayCheckboxStyle(cb));
  });

  document.getElementById("saleModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("saleModal")) closeSaleModal();
  });
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  document.getElementById("editModal").classList.remove("flex");
}

function saveModalChanges() {
  const content = document.getElementById("modalContent");
  const global = loadGlobalData();
  const items = [];
  const existingItems = editMode === "treats" ? global.treats : editMode === "habits" ? global.habits : global.pomoCategories;

  content.querySelectorAll('[draggable="true"]').forEach((row, idx) => {
    const item = { id: idx + 1 };
    row.querySelectorAll("input").forEach((input) => {
      const field = input.dataset.field;
      if (!field) return;
      let value = input.value;
      if (input.type === "number") value = parseInt(value) || 0;
      item[field] = value;
    });

    if (editMode === "treats" && existingItems[idx]) {
      item.sale = existingItems[idx].sale || null;
    }

    items.push(item);
  });

  switch (editMode) {
    case "habits":
      global.habits = items;
      break;
    case "pomodoros":
      global.pomoCategories = items;
      break;
    case "treats":
      global.treats = items;
      break;
  }

  saveGlobalData(global);
  closeEditModal();
  render();
}

function moveItem(idx, direction) {
  const content = document.getElementById("modalContent");
  const rows = content.querySelectorAll('[draggable="true"]');
  const newIdx = idx + direction;

  if (newIdx < 0 || newIdx >= rows.length) return;

  const parent = rows[0].parentNode;
  if (direction < 0) {
    parent.insertBefore(rows[idx], rows[newIdx]);
  } else {
    parent.insertBefore(rows[newIdx], rows[idx]);
  }

  content.querySelectorAll('[draggable="true"]').forEach((row, i) => {
    row.dataset.idx = i;
    row.querySelectorAll("[data-idx]").forEach((el) => (el.dataset.idx = i));
  });
}

function deleteItem(idx) {
  const content = document.getElementById("modalContent");
  const rows = content.querySelectorAll('[draggable="true"]');
  rows[idx].remove();
}

function addNewItem() {
  const content = document.getElementById("modalContent");
  const addBtn = document.getElementById("addNewItem");

  let newItem, fields;
  switch (editMode) {
    case "habits":
      newItem = { name: "New Habit", points: 1, color: "#7c3aed" };
      fields = ["name", "points", "color"];
      break;
    case "pomodoros":
      newItem = { name: "New Category", count: 5, pointsEach: 1, color: "#7c3aed" };
      fields = ["name", "count", "pointsEach", "color"];
      break;
    case "treats":
      newItem = { name: "New Treat", cost: 10, sale: null };
      fields = ["name", "cost"];
      break;
  }

  const idx = content.querySelectorAll('[draggable="true"]').length;
  const saleButton =
    editMode === "treats"
      ? `
    <button class="sale-btn p-1.5 rounded-lg border border-gray-200 text-xs font-medium" data-idx="${idx}" title="Configure sale">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
      </svg>
    </button>
  `
      : "";

  const newRow = document.createElement("div");
  newRow.className = "flex items-center gap-3 p-3 bg-gray-50 rounded-xl";
  newRow.draggable = true;
  newRow.dataset.idx = idx;
  newRow.innerHTML = `
      <div class="flex flex-col gap-0.5">
          <button class="move-up text-gray-300 hover:text-gray-500 text-xs" data-idx="${idx}">▲</button>
          <button class="move-down text-gray-300 hover:text-gray-500 text-xs" data-idx="${idx}">▼</button>
      </div>
      <div class="flex-1 flex gap-2 items-center">
          ${fields
            .map((f) => {
              if (f === "color") {
                return `<input type="color" class="w-8 h-8 rounded-lg cursor-pointer border-0" data-field="${f}" value="${newItem[f]}">`;
              }
              if (f === "emoji") {
                return `<input type="text" class="w-12 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-lg" data-field="${f}" value="${newItem[f]}">`;
              }
              return `<input type="${f === "points" || f === "cost" || f === "count" || f === "pointsEach" ? "number" : "text"}" 
                  class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" data-field="${f}" value="${newItem[f]}" placeholder="${f}">`;
            })
            .join("")}
          ${saleButton}
      </div>
      <button class="delete-item text-gray-300 hover:text-rose-500 transition" data-idx="${idx}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
      </button>
  `;

  content.insertBefore(newRow, addBtn);

  newRow.querySelector(".move-up").addEventListener("click", () => moveItem(idx, -1));
  newRow.querySelector(".move-down").addEventListener("click", () => moveItem(idx, 1));
  newRow.querySelector(".delete-item").addEventListener("click", () => deleteItem(idx));

  const saleBtnEl = newRow.querySelector(".sale-btn");
  if (saleBtnEl) {
    saleBtnEl.addEventListener("click", () => openSaleModal(idx));
  }
}

function setupDragDrop(container, type) {
  container.querySelectorAll('[draggable="true"]').forEach((el) => {
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", el.dataset.id);
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", () => {
      el.classList.remove("drag-over");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      const draggedId = parseInt(e.dataTransfer.getData("text/plain"));
      const targetId = parseInt(el.dataset.id);
      if (draggedId !== targetId) {
        reorderItems(type, draggedId, targetId);
      }
    });
  });
}

function reorderItems(type, fromId, toId) {
  const global = loadGlobalData();
  let items;
  switch (type) {
    case "habits":
      items = global.habits;
      break;
    case "pomodoros":
      items = global.pomoCategories;
      break;
    case "treats":
      items = global.treats;
      break;
  }

  const fromIdx = items.findIndex((i) => i.id === fromId);
  const toIdx = items.findIndex((i) => i.id === toId);
  const [item] = items.splice(fromIdx, 1);
  items.splice(toIdx, 0, item);

  saveGlobalData(global);
  render();
}

// Main render
function render() {
  document.getElementById("currentDate").textContent = formatDate(currentDate);
  renderCalendar();
  renderHabits();
  renderPomodoros();
  renderTasks();
  renderTreats();
  renderPoints();
  renderStats();
}

// Event listeners
document.getElementById("prevDay").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() - 1);
  render();
});

document.getElementById("nextDay").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 1);
  render();
});

document.getElementById("prevMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

document.getElementById("addTask").addEventListener("click", addTask);
document.getElementById("newTaskInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") addTask();
});

document.getElementById("editHabits").addEventListener("click", () => openEditModal("habits"));
document.getElementById("editPomodoros").addEventListener("click", () => openEditModal("pomodoros"));
document.getElementById("editTreats").addEventListener("click", () => openEditModal("treats"));

document.getElementById("addHabit").addEventListener("click", () => {
  openEditModal("habits");
  setTimeout(addNewItem, 100);
});
document.getElementById("addPomoCategory").addEventListener("click", () => {
  openEditModal("pomodoros");
  setTimeout(addNewItem, 100);
});
document.getElementById("addTreat").addEventListener("click", () => {
  openEditModal("treats");
  setTimeout(addNewItem, 100);
});

document.getElementById("closeModal").addEventListener("click", closeEditModal);
document.getElementById("modalSave").addEventListener("click", saveModalChanges);
document.getElementById("editModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("editModal")) closeEditModal();
});

// Page Navigation
let currentPage = "planner";

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("active"));

  document.getElementById(`${page}-page`).classList.add("active");
  document.querySelector(`[data-page="${page}"]`).classList.add("active");

  if (page === "goals") {
    renderGoals();
  } else if (page === "planner") {
    render();
  } else if (page === "wishlist") {
    renderWishlist();
    attachWishlistEventListeners();
  } else if (page === "money") {
    renderMoney();
  } else if (page === "notes") {
    renderNotes();
    attachNotesEventListeners();
  }
}

document.querySelectorAll("[data-page]").forEach((btn) => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});

// Wishlist Management with Categories
function loadWishlistCategories() {
  if (currentUser && wishlistCategoriesCache) {
    return wishlistCategoriesCache;
  }
  return [];
}

function saveWishlistCategories(categories) {
  if (!currentUser) return;
  wishlistCategoriesCache = categories;
  setDoc(doc(db, "wishlistCategories", currentUser.uid), { categories }, { merge: true }).catch(console.error);
}

let openWishForm = null;

function renderWishlist() {
  const container = document.getElementById("wishlistCategories");
  const categories = loadWishlistCategories();

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="card p-12 text-center">
        <p class="text-gray-500">No categories yet. Add a category to start your wishlist!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = categories
    .map((category) => {
      const completedCount = category.wishes ? category.wishes.filter((w) => w.completed).length : 0;
      const totalCount = category.wishes ? category.wishes.length : 0;

      return `
      <div class="wish-category card overflow-hidden" data-category-id="${category.id}">
        <div class="wish-category-header p-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div>
              <h3 class="font-bold text-gray-900">${category.name}</h3>
              <span class="text-xs text-gray-500">${completedCount}/${totalCount} completed</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="edit-category btn-icon p-2 rounded-lg text-gray-400 hover:text-violet-600" data-category-id="${category.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
              </svg>
            </button>
            <button class="delete-category btn-icon p-2 rounded-lg text-gray-400 hover:text-rose-600" data-category-id="${category.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="p-4 pt-2">
          <div class="space-y-2 mb-4">
            ${
              category.wishes && category.wishes.length > 0
                ? category.wishes
                    .map(
                      (wish) => `
                <div class="wish-item flex items-center gap-3 p-3 bg-gray-50 rounded-lg group ${wish.completed ? "opacity-60" : ""}" data-wish-id="${wish.id}">
                  <input type="checkbox" class="wish-checkbox w-4 h-4 accent-rose-500 rounded flex-shrink-0" 
                         ${wish.completed ? "checked" : ""} 
                         data-category-id="${category.id}" data-wish-id="${wish.id}">
                  <div class="flex-1 min-w-0">
                    <h4 class="wish-title font-medium text-gray-900 text-sm truncate cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1 ${wish.completed ? "line-through text-gray-500" : ""}" 
                        data-category-id="${category.id}" data-wish-id="${wish.id}">${wish.title}</h4>
                    <div class="wish-link-container">
                      ${
                        wish.link
                          ? `<a href="${wish.link}" target="_blank" rel="noopener noreferrer" class="wish-link text-xs text-gray-500 hover:text-violet-600 flex items-center gap-1 truncate">
                            <span class="truncate">${wish.link}</span>
                          </a>`
                          : `<span class="wish-link-placeholder text-xs text-gray-400 cursor-pointer hover:text-violet-500 px-1 py-0.5 rounded -mx-1 hover:bg-gray-100" 
                                data-category-id="${category.id}" data-wish-id="${wish.id}">+ Add link</span>`
                      }
                      ${
                        wish.link
                          ? `<span class="wish-link-edit text-xs text-gray-400 cursor-pointer hover:text-violet-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                                          data-category-id="${category.id}" data-wish-id="${wish.id}">(edit)</span>`
                          : ""
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="delete-wish btn-icon p-1.5 rounded-lg text-gray-400 hover:text-rose-600" 
                            data-category-id="${category.id}" data-wish-id="${wish.id}">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
            `,
                    )
                    .join("")
                : '<p class="text-xs text-gray-400 italic py-2">No wishes in this category yet</p>'
            }
          </div>
          
          <div class="wish-form-container" data-category-id="${category.id}"></div>
          
          <button class="add-wish-btn w-full py-2.5 text-sm text-rose-500 hover:text-rose-600 font-medium flex items-center justify-center gap-2 border-2 border-dashed border-rose-200 rounded-xl hover:border-rose-400 hover:bg-rose-50 transition" 
                  data-category-id="${category.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Wish
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  attachWishlistEventListeners();
}

function showWishForm(categoryId) {
  closeWishForm();

  const container = document.querySelector(`.wish-form-container[data-category-id="${categoryId}"]`);
  if (!container) return;

  openWishForm = categoryId;

  container.innerHTML = `
                <div class="wish-form-inline p-4 bg-rose-50 rounded-xl border border-rose-200 mb-3">
                    <div class="space-y-3">
                        <div>
                            <input type="text" class="wish-title-input w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:bg-white" 
                                   placeholder="What do you wish for?" autofocus>
                        </div>
                        <div>
                            <input type="url" class="wish-link-input w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:bg-white" 
                                   placeholder="Link (optional)">
                        </div>
                    </div>
                    <div class="flex gap-2 justify-end mt-3">
                        <button class="cancel-wish-btn px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition">
                            Cancel
                        </button>
                        <button class="save-wish-btn px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition" data-category-id="${categoryId}">
                            Add Wish
                        </button>
                    </div>
                </div>
            `;

  const titleInput = container.querySelector(".wish-title-input");
  const linkInput = container.querySelector(".wish-link-input");
  titleInput.focus();

  titleInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      linkInput.focus();
    }
  });

  linkInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveWish(categoryId, titleInput.value, linkInput.value);
    }
  });

  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeWishForm();
  });

  linkInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeWishForm();
  });

  container.querySelector(".save-wish-btn").addEventListener("click", () => {
    saveWish(categoryId, titleInput.value, linkInput.value);
  });

  container.querySelector(".cancel-wish-btn").addEventListener("click", () => {
    closeWishForm();
  });
}

function closeWishForm() {
  if (openWishForm !== null) {
    const container = document.querySelector(`.wish-form-container[data-category-id="${openWishForm}"]`);
    if (container) container.innerHTML = "";
    openWishForm = null;
  }
}

function saveWish(categoryId, title, link) {
  if (!title || !title.trim()) return;

  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category.wishes) category.wishes = [];
  category.wishes.push({
    id: Date.now(),
    title: title.trim(),
    link: link ? link.trim() : "",
    createdAt: new Date().toISOString(),
  });
  saveWishlistCategories(categories);
  renderWishlist();
}

let openCategoryForm = false;

function addWishCategory() {
  if (openCategoryForm) return;

  const container = document.getElementById("wishlistCategories");
  const existingForm = document.getElementById("categoryFormInline");
  if (existingForm) existingForm.remove();

  openCategoryForm = true;

  const formHtml = `
    <div id="categoryFormInline" class="card p-4 mb-6 border-2 border-violet-200 bg-violet-50">
      <h4 class="font-semibold text-gray-900 text-sm mb-3">Add New Category</h4>
      <div class="flex gap-3">
        <input type="text" id="newCategoryNameInput" class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:bg-white" 
               placeholder="Enter category name..." autofocus>
        <button id="saveCategoryBtn" class="px-6 py-2.5 accent-gradient text-white rounded-xl font-medium hover:opacity-90 transition">
          Add
        </button>
        <button id="cancelCategoryBtn" class="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">
          Cancel
        </button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML("beforebegin", formHtml);

  const nameInput = document.getElementById("newCategoryNameInput");
  nameInput.focus();

  nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveCategoryFromForm();
    }
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCategoryForm();
    }
  });

  document.getElementById("saveCategoryBtn").addEventListener("click", saveCategoryFromForm);
  document.getElementById("cancelCategoryBtn").addEventListener("click", closeCategoryForm);
}

function saveCategoryFromForm() {
  const nameInput = document.getElementById("newCategoryNameInput");
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.focus();
    return;
  }

  const categories = loadWishlistCategories();
  categories.push({
    id: Date.now(),
    name: name,
    wishes: [],
  });
  saveWishlistCategories(categories);
  closeCategoryForm();
  renderWishlist();
}

function closeCategoryForm() {
  const form = document.getElementById("categoryFormInline");
  if (form) form.remove();
  openCategoryForm = false;
}

function editWishCategory(categoryId) {
  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return;

  const newName = prompt("Category name:", category.name);
  if (newName === null) return;
  if (!newName.trim()) {
    alert("Category name is required");
    return;
  }

  category.name = newName.trim();
  saveWishlistCategories(categories);
  renderWishlist();
}

function deleteWishCategory(categoryId) {
  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  const wishCount = category && category.wishes ? category.wishes.length : 0;

  const confirmMsg = wishCount > 0 ? `Delete this category and its ${wishCount} wishes?` : "Delete this category?";

  if (!confirm(confirmMsg)) return;

  const filtered = categories.filter((c) => c.id !== categoryId);
  saveWishlistCategories(filtered);
  renderWishlist();
}

function editWish(categoryId, wishId) {
  // This function is now replaced by inline editing
  // Keeping for backwards compatibility
}

function startWishTitleEdit(categoryId, wishId, element) {
  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category || !category.wishes) return;
  const wish = category.wishes.find((w) => w.id === wishId);
  if (!wish) return;

  const currentText = wish.title;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "font-medium text-sm text-gray-900 px-2 py-1 border-2 border-rose-400 rounded outline-none bg-white w-full";
  input.value = currentText;

  element.replaceWith(input);
  input.focus();
  input.select();

  const saveEdit = () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== currentText) {
      const categories = loadWishlistCategories();
      const category = categories.find((c) => c.id === categoryId);
      const wish = category.wishes.find((w) => w.id === wishId);
      wish.title = newValue;
      saveWishlistCategories(categories);
    }
    renderWishlist();
  };

  input.addEventListener("blur", saveEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      renderWishlist();
    }
  });
}

function startWishLinkEdit(categoryId, wishId, element) {
  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category || !category.wishes) return;
  const wish = category.wishes.find((w) => w.id === wishId);
  if (!wish) return;

  const currentLink = wish.link || "";
  const container = element.closest(".wish-link-container");

  const input = document.createElement("input");
  input.type = "url";
  input.className = "text-xs text-gray-700 px-2 py-1 border-2 border-rose-400 rounded outline-none bg-white w-full";
  input.value = currentLink;
  input.placeholder = "https://...";

  container.innerHTML = "";
  container.appendChild(input);
  input.focus();
  input.select();

  const saveEdit = () => {
    const newValue = input.value.trim();
    const categories = loadWishlistCategories();
    const category = categories.find((c) => c.id === categoryId);
    const wish = category.wishes.find((w) => w.id === wishId);
    wish.link = newValue;
    saveWishlistCategories(categories);
    renderWishlist();
  };

  input.addEventListener("blur", saveEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      renderWishlist();
    }
  });
}

function toggleWish(categoryId, wishId) {
  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category || !category.wishes) return;

  const wish = category.wishes.find((w) => w.id === wishId);
  if (!wish) return;

  wish.completed = !wish.completed;
  saveWishlistCategories(categories);
  renderWishlist();
}

function deleteWish(categoryId, wishId) {
  const categories = loadWishlistCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category || !category.wishes) return;

  category.wishes = category.wishes.filter((w) => w.id !== wishId);
  saveWishlistCategories(categories);
  renderWishlist();
}

let wishlistEventDelegationAttached = false;

function attachWishlistEventListeners() {
  // Add Category button
  const addCategoryBtn = document.getElementById("addWishCategoryBtn");
  if (addCategoryBtn && !addCategoryBtn.dataset.attached) {
    addCategoryBtn.addEventListener("click", addWishCategory);
    addCategoryBtn.dataset.attached = "true";
  }

  if (wishlistEventDelegationAttached) return;

  const container = document.getElementById("wishlistCategories");
  if (!container) return;

  container.addEventListener("click", (e) => {
    // Toggle Wish Checkbox
    if (e.target.matches(".wish-checkbox")) {
      const cb = e.target;
      toggleWish(parseInt(cb.dataset.categoryId), parseInt(cb.dataset.wishId));
      return;
    }

    // Edit Wish Title (inline)
    if (e.target.closest(".wish-title")) {
      const el = e.target.closest(".wish-title");
      e.preventDefault();
      e.stopPropagation();
      startWishTitleEdit(parseInt(el.dataset.categoryId), parseInt(el.dataset.wishId), el);
      return;
    }

    // Edit Wish Link (inline) - placeholder or edit button
    if (e.target.closest(".wish-link-placeholder") || e.target.closest(".wish-link-edit")) {
      const el = e.target.closest(".wish-link-placeholder") || e.target.closest(".wish-link-edit");
      e.preventDefault();
      e.stopPropagation();
      startWishLinkEdit(parseInt(el.dataset.categoryId), parseInt(el.dataset.wishId), el);
      return;
    }

    // Edit Category
    if (e.target.closest(".edit-category")) {
      const btn = e.target.closest(".edit-category");
      editWishCategory(parseInt(btn.dataset.categoryId));
      return;
    }

    // Delete Category
    if (e.target.closest(".delete-category")) {
      const btn = e.target.closest(".delete-category");
      deleteWishCategory(parseInt(btn.dataset.categoryId));
      return;
    }

    // Add Wish Button
    if (e.target.closest(".add-wish-btn")) {
      const btn = e.target.closest(".add-wish-btn");
      showWishForm(parseInt(btn.dataset.categoryId));
      return;
    }

    // Delete Wish
    if (e.target.closest(".delete-wish")) {
      const btn = e.target.closest(".delete-wish");
      deleteWish(parseInt(btn.dataset.categoryId), parseInt(btn.dataset.wishId));
      return;
    }
  });

  wishlistEventDelegationAttached = true;
}

// Goals Management
function loadGoals() {
  if (currentUser && goalsCache) {
    return goalsCache;
  }
  return [];
}

function saveGoals(goals) {
  if (!currentUser) return;
  goalsCache = goals;
  setDoc(doc(db, "goals", currentUser.uid), { goals }, { merge: true }).catch(console.error);
}

function syncGoalItemToPlanner(goalId, milestoneId, goalTaskId, subtaskId, completed) {
  if (!currentUser) return;

  Object.keys(dayDataCache).forEach((key) => {
    const dayData = dayDataCache[key];
    let updated = false;

    if (dayData.tasks) {
      dayData.tasks.forEach((task) => {
        if (subtaskId) {
          // Sync subtask
          if (task.goalId === goalId && task.milestoneId === milestoneId && task.goalTaskId === goalTaskId && task.subtaskId === subtaskId) {
            task.completed = completed;
            updated = true;
          }
        } else {
          // Sync task
          if (task.goalId === goalId && task.milestoneId === milestoneId && task.goalTaskId === goalTaskId && !task.subtaskId) {
            task.completed = completed;
            updated = true;
          }
        }
      });
    }

    if (updated) {
      dayDataCache[key] = dayData;
      const payload = {
        ...dayData,
        userId: currentUser.uid,
        dateKey: key,
      };
      setDoc(doc(db, "days", `${currentUser.uid}_${key}`), payload).catch(console.error);
    }
  });
}

let openMilestoneForm = null;
let openTaskForm = null;
let openSubtaskForm = null;

function renderGoals() {
  const container = document.getElementById("goalsList");
  const goals = loadGoals();

  if (goals.length === 0) {
    container.innerHTML = `
                    <div class="card p-12 text-center">
                        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <p class="text-gray-500 mb-4">No goals yet. Create your first goal!</p>
                    </div>
                `;
    attachGoalsEventListeners();
    return;
  }

  container.innerHTML = goals
    .map(
      (goal) => `
                <div class="goal-card card p-6" data-goal-id="${goal.id}" draggable="true">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex items-start gap-3 flex-1">
                            <div class="drag-handle mt-1 text-gray-400 cursor-grab">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
                                </svg>
                            </div>
                            <div class="flex-1">
                                <h3 class="editable-text text-xl font-bold text-gray-900 mb-1" data-edit-type="goal-name" data-goal-id="${goal.id}">${goal.name}</h3>
                                <p class="editable-text text-sm text-gray-500" data-edit-type="goal-description" data-goal-id="${goal.id}">${goal.description || "Add description..."}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="edit-goal btn-icon p-2 rounded-lg text-gray-400 hover:text-violet-600" data-goal-id="${goal.id}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                                </svg>
                            </button>
                            <button class="delete-goal btn-icon p-2 rounded-lg text-gray-400 hover:text-rose-600" data-goal-id="${goal.id}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Milestones as blocks -->
                    <div class="space-y-4">
                        ${
                          goal.milestones && goal.milestones.length > 0
                            ? goal.milestones
                                .map((m) => {
                                  const completedTasks = m.tasks ? m.tasks.filter((t) => t.completed).length : 0;
                                  const totalTasks = m.tasks ? m.tasks.length : 0;
                                  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                  return `
                            <div class="milestone-block border-2 border-violet-100 rounded-xl overflow-hidden" data-goal-id="${goal.id}" data-milestone-id="${m.id}" draggable="true">
                                <!-- Milestone Header -->
                                <div class="milestone-header ${m.completed ? "completed" : ""} p-4">
                                    <div class="flex items-center gap-3">
                                        <div class="drag-handle text-gray-400 cursor-grab">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
                                            </svg>
                                        </div>
                                        <input type="checkbox" class="milestone-checkbox w-5 h-5 accent-violet-600 rounded" ${m.completed ? "checked" : ""} 
                                               data-goal-id="${goal.id}" data-milestone-id="${m.id}">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <span class="editable-text font-semibold ${m.completed ? "line-through text-gray-400" : "text-gray-800"}" data-edit-type="milestone-name" data-goal-id="${goal.id}" data-milestone-id="${m.id}">${m.name}</span>
                                                <span class="milestone-points-badge text-xs font-medium px-2 py-0.5 rounded-full text-white ${m.completed ? "opacity-50" : ""}">+${m.points || 10} pts</span>
                                            </div>
                                            ${
                                              totalTasks > 0
                                                ? `
                                                <div class="flex items-center gap-2 mt-1">
                                                    <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div class="h-full bg-violet-500 rounded-full transition-all" style="width: ${progress}%"></div>
                                                    </div>
                                                    <span class="text-xs text-gray-500">${completedTasks}/${totalTasks}</span>
                                                </div>
                                            `
                                                : ""
                                            }
                                        </div>
                                        <button class="delete-milestone btn-icon p-1.5 rounded-lg text-gray-400 hover:text-rose-600" 
                                                data-goal-id="${goal.id}" data-milestone-id="${m.id}">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Milestone Tasks -->
                                <div class="p-4 pt-2 bg-white">
                                    <div class="space-y-3">
                                        ${
                                          m.tasks && m.tasks.length > 0
                                            ? m.tasks
                                                .map((t) => {
                                                  const completedSubtasks = t.subtasks ? t.subtasks.filter((st) => st.completed).length : 0;
                                                  const totalSubtasks = t.subtasks ? t.subtasks.length : 0;

                                                  return `
                                            <div class="task-expandable pl-3 py-1">
                                                <div class="goal-task-item flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg group" data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" draggable="true">
                                                    <div class="drag-handle text-gray-400 cursor-grab">
                                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
                                                        </svg>
                                                    </div>
                                                    <input type="checkbox" class="goal-task-checkbox w-4 h-4 accent-violet-600 rounded" ${t.completed ? "checked" : ""} 
                                                           data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}">
                                                    <span class="editable-text flex-1 text-sm ${t.completed ? "line-through text-gray-400" : "text-gray-700"}" data-edit-type="task-name" data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}">${t.name}</span>
                                                    ${totalSubtasks > 0 ? `<span class="text-xs text-gray-400">${completedSubtasks}/${totalSubtasks}</span>` : ""}
                                                    <span class="text-xs text-gray-400">${t.points || 5} pts</span>
                                                    <button class="add-task-to-planner text-xs text-violet-600 hover:text-violet-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity" 
                                                            data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" data-task-name="${t.name}" data-task-points="${t.points || 5}" data-type="task">
                                                        → Planner
                                                    </button>
                                                    <button class="delete-goal-task text-gray-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" 
                                                            data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                                        </svg>
                                                    </button>
                                                </div>
                                                
                                                <!-- Subtasks -->
                                                <div class="mt-2 space-y-1">
                                                    ${
                                                      t.subtasks && t.subtasks.length > 0
                                                        ? t.subtasks
                                                            .map(
                                                              (st) => `
                                                        <div class="subtask-item flex items-center gap-3 p-2 bg-amber-50 rounded-lg group" data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" data-subtask-id="${st.id}" draggable="true">
                                                            <div class="drag-handle text-gray-400 cursor-grab">
                                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
                                                                </svg>
                                                            </div>
                                                            <input type="checkbox" class="subtask-checkbox w-3.5 h-3.5 accent-amber-500 rounded" ${st.completed ? "checked" : ""} 
                                                                   data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" data-subtask-id="${st.id}">
                                                            <span class="editable-text flex-1 text-xs ${st.completed ? "line-through text-gray-400" : "text-gray-600"}" data-edit-type="subtask-name" data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" data-subtask-id="${st.id}">${st.name}</span>
                                                            <span class="subtask-points-badge text-xs font-medium px-1.5 py-0.5 rounded text-white ${st.completed ? "opacity-50" : ""}">+${st.points || 2}</span>
                                                            <button class="add-subtask-to-planner text-xs text-amber-600 hover:text-amber-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity" 
                                                                    data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" data-subtask-id="${st.id}" 
                                                                    data-task-name="${st.name}" data-task-points="${st.points || 2}" data-type="subtask">
                                                                → Planner
                                                            </button>
                                                            <button class="delete-subtask text-gray-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" 
                                                                    data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}" data-subtask-id="${st.id}">
                                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    `,
                                                            )
                                                            .join("")
                                                        : ""
                                                    }
                                                    
                                                    <!-- Subtask Form Container -->
                                                    <div class="subtask-form-container" data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}"></div>
                                                    
                                                    <!-- Add Subtask Button -->
                                                    <button class="add-subtask ml-6 mt-1 py-1.5 px-3 text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 border border-dashed border-amber-200 rounded hover:border-amber-400 hover:bg-amber-50 transition" 
                                                            data-goal-id="${goal.id}" data-milestone-id="${m.id}" data-task-id="${t.id}">
                                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                                        </svg>
                                                        Add Subtask
                                                    </button>
                                                </div>
                                            </div>
                                        `;
                                                })
                                                .join("")
                                            : ""
                                        }
                                    </div>
                                    
                                    <!-- Add Task Form Container -->
                                    <div class="task-form-container mt-2" data-goal-id="${goal.id}" data-milestone-id="${m.id}"></div>
                                    
                                    <!-- Add Task Button -->
                                    <button class="add-milestone-task mt-2 w-full py-2 text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center justify-center gap-1 border border-dashed border-violet-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition" 
                                            data-goal-id="${goal.id}" data-milestone-id="${m.id}">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        Add Task
                                    </button>
                                </div>
                            </div>
                        `;
                                })
                                .join("")
                            : '<p class="text-sm text-gray-400 italic">No milestones yet. Add your first milestone!</p>'
                        }
                    </div>
                    
                    <!-- Add Milestone Form Container -->
                    <div class="milestone-form-container mt-4" data-goal-id="${goal.id}"></div>
                    
                    <!-- Add Milestone Button -->
                    <button class="add-milestone mt-4 w-full py-3 text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center justify-center gap-2 border-2 border-dashed border-violet-200 rounded-xl hover:border-violet-400 hover:bg-violet-50 transition" data-goal-id="${goal.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                        </svg>
                        Add Milestone
                    </button>
                </div>
            `,
    )
    .join("");

  attachGoalsEventListeners();
}

function showMilestoneForm(goalId) {
  closeMilestoneForm();
  closeTaskForm();
  closeSubtaskForm();

  const container = document.querySelector(`.milestone-form-container[data-goal-id="${goalId}"]:not([data-milestone-id])`);
  if (!container) return;

  openMilestoneForm = goalId;

  container.innerHTML = `
                <div class="inline-add-form p-4 bg-violet-50 rounded-xl border border-violet-200">
                    <div class="flex gap-2 mb-3">
                        <input type="text" class="milestone-name-input flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:bg-white" 
                               placeholder="Enter milestone name..." autofocus>
                        <input type="number" class="milestone-points-input w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center bg-white focus:bg-white" 
                               placeholder="Reward" value="10" min="1">
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button class="cancel-milestone-btn px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition">
                            Cancel
                        </button>
                        <button class="save-milestone-btn px-4 py-2 accent-gradient text-white rounded-lg text-sm font-medium hover:opacity-90 transition" data-goal-id="${goalId}">
                            Add Milestone
                        </button>
                    </div>
                </div>
            `;

  const nameInput = container.querySelector(".milestone-name-input");
  const pointsInput = container.querySelector(".milestone-points-input");
  nameInput.focus();

  nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveMilestone(goalId, nameInput.value, pointsInput.value);
    }
  });

  pointsInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveMilestone(goalId, nameInput.value, pointsInput.value);
    }
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMilestoneForm();
  });

  pointsInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMilestoneForm();
  });

  container.querySelector(".save-milestone-btn").addEventListener("click", () => {
    saveMilestone(goalId, nameInput.value, pointsInput.value);
  });

  container.querySelector(".cancel-milestone-btn").addEventListener("click", () => {
    closeMilestoneForm();
  });
}

function closeMilestoneForm() {
  if (openMilestoneForm !== null) {
    const container = document.querySelector(`.milestone-form-container[data-goal-id="${openMilestoneForm}"]:not([data-milestone-id])`);
    if (container) container.innerHTML = "";
    openMilestoneForm = null;
  }
}

function saveMilestone(goalId, name, points) {
  if (!name || !name.trim()) return;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === goalId);
  if (!goal.milestones) goal.milestones = [];
  goal.milestones.push({
    id: Date.now(),
    name: name.trim(),
    points: parseInt(points) || 10,
    completed: false,
    tasks: [],
  });
  saveGoals(goals);
  renderGoals();
}

function showTaskForm(goalId, milestoneId) {
  closeMilestoneForm();
  closeTaskForm();
  closeSubtaskForm();

  const container = document.querySelector(`.task-form-container[data-goal-id="${goalId}"][data-milestone-id="${milestoneId}"]`);
  if (!container) return;

  openTaskForm = { goalId, milestoneId };

  container.innerHTML = `
                <div class="inline-add-form p-3 bg-violet-50 rounded-lg border border-violet-200">
                    <div class="flex gap-2 mb-2">
                        <input type="text" class="task-name-input flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:bg-white" 
                               placeholder="Enter task name..." autofocus>
                        <input type="number" class="task-points-input w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center bg-white focus:bg-white" 
                               placeholder="Pts" value="5" min="1">
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button class="cancel-task-btn px-3 py-1.5 text-gray-500 hover:text-gray-700 text-sm transition">
                            Cancel
                        </button>
                        <button class="save-task-btn px-4 py-1.5 accent-gradient text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
                            Add Task
                        </button>
                    </div>
                </div>
            `;

  const nameInput = container.querySelector(".task-name-input");
  const pointsInput = container.querySelector(".task-points-input");
  nameInput.focus();

  nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveTaskToMilestone(goalId, milestoneId, nameInput.value, pointsInput.value);
    }
  });

  pointsInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveTaskToMilestone(goalId, milestoneId, nameInput.value, pointsInput.value);
    }
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTaskForm();
  });

  pointsInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTaskForm();
  });

  container.querySelector(".save-task-btn").addEventListener("click", () => {
    saveTaskToMilestone(goalId, milestoneId, nameInput.value, pointsInput.value);
  });

  container.querySelector(".cancel-task-btn").addEventListener("click", () => {
    closeTaskForm();
  });
}

function closeTaskForm() {
  if (openTaskForm !== null) {
    const container = document.querySelector(`.task-form-container[data-goal-id="${openTaskForm.goalId}"][data-milestone-id="${openTaskForm.milestoneId}"]`);
    if (container) container.innerHTML = "";
    openTaskForm = null;
  }
}

function saveTaskToMilestone(goalId, milestoneId, name, points) {
  if (!name || !name.trim()) return;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === goalId);
  const milestone = goal.milestones.find((m) => m.id === milestoneId);
  if (!milestone.tasks) milestone.tasks = [];
  milestone.tasks.push({
    id: Date.now(),
    name: name.trim(),
    points: parseInt(points) || 5,
    completed: false,
    subtasks: [],
  });
  saveGoals(goals);
  renderGoals();
}

function showSubtaskForm(goalId, milestoneId, taskId) {
  closeMilestoneForm();
  closeTaskForm();
  closeSubtaskForm();

  const container = document.querySelector(`.subtask-form-container[data-goal-id="${goalId}"][data-milestone-id="${milestoneId}"][data-task-id="${taskId}"]`);
  if (!container) return;

  openSubtaskForm = { goalId, milestoneId, taskId };

  container.innerHTML = `
                <div class="inline-add-form ml-6 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <div class="flex gap-2 mb-2">
                        <input type="text" class="subtask-name-input flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs bg-white focus:bg-white" 
                               placeholder="Enter subtask name..." autofocus>
                        <input type="number" class="subtask-points-input w-16 px-2 py-1.5 border border-gray-200 rounded text-xs text-center bg-white focus:bg-white" 
                               placeholder="Pts" value="2" min="1">
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button class="cancel-subtask-btn px-2 py-1 text-gray-500 hover:text-gray-700 text-xs transition">
                            Cancel
                        </button>
                        <button class="save-subtask-btn px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-medium transition">
                            Add
                        </button>
                    </div>
                </div>
            `;

  const nameInput = container.querySelector(".subtask-name-input");
  const pointsInput = container.querySelector(".subtask-points-input");
  nameInput.focus();

  nameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveSubtask(goalId, milestoneId, taskId, nameInput.value, pointsInput.value);
    }
  });

  pointsInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveSubtask(goalId, milestoneId, taskId, nameInput.value, pointsInput.value);
    }
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSubtaskForm();
  });

  pointsInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSubtaskForm();
  });

  container.querySelector(".save-subtask-btn").addEventListener("click", () => {
    saveSubtask(goalId, milestoneId, taskId, nameInput.value, pointsInput.value);
  });

  container.querySelector(".cancel-subtask-btn").addEventListener("click", () => {
    closeSubtaskForm();
  });
}

function closeSubtaskForm() {
  if (openSubtaskForm !== null) {
    const container = document.querySelector(`.subtask-form-container[data-goal-id="${openSubtaskForm.goalId}"][data-milestone-id="${openSubtaskForm.milestoneId}"][data-task-id="${openSubtaskForm.taskId}"]`);
    if (container) container.innerHTML = "";
    openSubtaskForm = null;
  }
}

function saveSubtask(goalId, milestoneId, taskId, name, points) {
  if (!name || !name.trim()) return;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === goalId);
  const milestone = goal.milestones.find((m) => m.id === milestoneId);
  const task = milestone.tasks.find((t) => t.id === taskId);
  if (!task.subtasks) task.subtasks = [];
  task.subtasks.push({
    id: Date.now(),
    name: name.trim(),
    points: parseInt(points) || 2,
    completed: false,
  });
  saveGoals(goals);
  renderGoals();
}

let currentEditingGoalId = null;

function openGoalForm(goalId = null) {
  const modal = document.getElementById("goalFormModal");
  const form = document.getElementById("goalForm");
  const title = document.getElementById("goalFormTitle");
  const nameInput = document.getElementById("goalNameInput");
  const descInput = document.getElementById("goalDescriptionInput");

  currentEditingGoalId = goalId;

  if (goalId) {
    const goals = loadGoals();
    const goal = goals.find((g) => g.id === goalId);
    if (goal) {
      title.textContent = "Edit Goal";
      nameInput.value = goal.name;
      descInput.value = goal.description || "";
    }
  } else {
    title.textContent = "Add New Goal";
    form.reset();
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => nameInput.focus(), 100);
}

function closeGoalForm() {
  const modal = document.getElementById("goalFormModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  currentEditingGoalId = null;
}

let addGoalHandlerAttached = false;
function attachAddGoalHandler() {
  if (addGoalHandlerAttached) return;
  const addGoalBtn = document.getElementById("addGoalBtn");
  if (addGoalBtn) {
    addGoalBtn.addEventListener("click", () => openGoalForm());
    addGoalHandlerAttached = true;
  }
}

const goalForm = document.getElementById("goalForm");
if (goalForm) {
  goalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("goalNameInput");
    const descInput = document.getElementById("goalDescriptionInput");

    const name = nameInput.value.trim();
    if (!name) return;

    const goals = loadGoals();

    if (currentEditingGoalId) {
      const goal = goals.find((g) => g.id === currentEditingGoalId);
      if (goal) {
        goal.name = name;
        goal.description = descInput.value.trim();
      }
    } else {
      goals.push({
        id: Date.now(),
        name: name,
        description: descInput.value.trim(),
        milestones: [],
      });
    }

    saveGoals(goals);
    closeGoalForm();
    renderGoals();
  });
}

const closeGoalFormModal = document.getElementById("closeGoalFormModal");
const cancelGoalForm = document.getElementById("cancelGoalForm");
const goalFormModal = document.getElementById("goalFormModal");

if (closeGoalFormModal) {
  closeGoalFormModal.addEventListener("click", closeGoalForm);
}

if (cancelGoalForm) {
  cancelGoalForm.addEventListener("click", closeGoalForm);
}

if (goalFormModal) {
  goalFormModal.addEventListener("click", (e) => {
    if (e.target === goalFormModal) {
      closeGoalForm();
    }
  });
}

let goalsEventDelegationAttached = false;
function attachGoalsEventListeners() {
  attachAddGoalHandler();

  // Setup drag and drop every time goals are rendered
  setupGoalsDragDrop();

  if (goalsEventDelegationAttached) return;
  const goalsContainer = document.getElementById("goalsList");
  if (!goalsContainer) return;

  goalsContainer.addEventListener("click", (e) => {
    // Edit Goal
    if (e.target.closest(".edit-goal")) {
      const btn = e.target.closest(".edit-goal");
      const goalId = parseInt(btn.dataset.goalId);
      openGoalForm(goalId);
      return;
    }

    // Delete Goal
    if (e.target.closest(".delete-goal")) {
      const btn = e.target.closest(".delete-goal");
      if (!confirm("Delete this goal?")) return;
      const goalId = parseInt(btn.dataset.goalId);
      const goals = loadGoals().filter((g) => g.id !== goalId);
      saveGoals(goals);
      renderGoals();
      return;
    }

    // Add Milestone
    if (e.target.closest(".add-milestone")) {
      const btn = e.target.closest(".add-milestone");
      const goalId = parseInt(btn.dataset.goalId);
      showMilestoneForm(goalId);
      return;
    }

    // Toggle Milestone
    if (e.target.matches(".milestone-checkbox")) {
      const cb = e.target;
      const goalId = parseInt(cb.dataset.goalId);
      const milestoneId = parseInt(cb.dataset.milestoneId);
      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      const milestone = goal.milestones.find((m) => m.id === milestoneId);
      milestone.completed = cb.checked;
      saveGoals(goals);
      renderGoals();
      render();
      return;
    }

    // Delete Milestone
    if (e.target.closest(".delete-milestone")) {
      const btn = e.target.closest(".delete-milestone");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      goal.milestones = goal.milestones.filter((m) => m.id !== milestoneId);
      saveGoals(goals);
      renderGoals();
      return;
    }

    // Add Task to Milestone
    if (e.target.closest(".add-milestone-task")) {
      const btn = e.target.closest(".add-milestone-task");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      showTaskForm(goalId, milestoneId);
      return;
    }

    // Toggle Task
    if (e.target.matches(".goal-task-checkbox")) {
      const cb = e.target;
      const goalId = parseInt(cb.dataset.goalId);
      const milestoneId = parseInt(cb.dataset.milestoneId);
      const taskId = parseInt(cb.dataset.taskId);
      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      const milestone = goal.milestones.find((m) => m.id === milestoneId);
      const task = milestone.tasks.find((t) => t.id === taskId);
      task.completed = cb.checked;
      saveGoals(goals);

      syncGoalItemToPlanner(goalId, milestoneId, taskId, null, cb.checked);

      renderGoals();
      return;
    }

    // Add Task to Planner
    if (e.target.closest(".add-task-to-planner")) {
      const btn = e.target.closest(".add-task-to-planner");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      const taskId = parseInt(btn.dataset.taskId);
      const taskName = btn.dataset.taskName;
      const taskPoints = parseInt(btn.dataset.taskPoints);

      document.getElementById("taskNameInput").value = taskName;
      document.getElementById("taskPointsInput").value = taskPoints;

      const today = getTodayGMT3();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      document.getElementById("taskDateInput").value = `${year}-${month}-${day}`;

      const modal = document.getElementById("addTaskModal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.dataset.goalId = goalId;
      modal.dataset.milestoneId = milestoneId;
      modal.dataset.taskId = taskId;
      modal.dataset.subtaskId = "";
      modal.dataset.type = "task";
      return;
    }

    // Delete Task
    if (e.target.closest(".delete-goal-task")) {
      const btn = e.target.closest(".delete-goal-task");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      const taskId = parseInt(btn.dataset.taskId);
      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      const milestone = goal.milestones.find((m) => m.id === milestoneId);
      milestone.tasks = milestone.tasks.filter((t) => t.id !== taskId);
      saveGoals(goals);
      renderGoals();
      return;
    }

    // Add Subtask
    if (e.target.closest(".add-subtask")) {
      const btn = e.target.closest(".add-subtask");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      const taskId = parseInt(btn.dataset.taskId);
      showSubtaskForm(goalId, milestoneId, taskId);
      return;
    }

    // Toggle Subtask
    if (e.target.matches(".subtask-checkbox")) {
      const cb = e.target;
      const goalId = parseInt(cb.dataset.goalId);
      const milestoneId = parseInt(cb.dataset.milestoneId);
      const taskId = parseInt(cb.dataset.taskId);
      const subtaskId = parseInt(cb.dataset.subtaskId);
      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      const milestone = goal.milestones.find((m) => m.id === milestoneId);
      const task = milestone.tasks.find((t) => t.id === taskId);
      const subtask = task.subtasks.find((st) => st.id === subtaskId);
      subtask.completed = cb.checked;
      saveGoals(goals);

      syncGoalItemToPlanner(goalId, milestoneId, taskId, subtaskId, cb.checked);

      renderGoals();
      render();
      return;
    }

    // Add Subtask to Planner
    if (e.target.closest(".add-subtask-to-planner")) {
      const btn = e.target.closest(".add-subtask-to-planner");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      const taskId = parseInt(btn.dataset.taskId);
      const subtaskId = parseInt(btn.dataset.subtaskId);
      const taskName = btn.dataset.taskName;
      const taskPoints = parseInt(btn.dataset.taskPoints);

      document.getElementById("taskNameInput").value = taskName;
      document.getElementById("taskPointsInput").value = taskPoints;

      const today = getTodayGMT3();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      document.getElementById("taskDateInput").value = `${year}-${month}-${day}`;

      const modal = document.getElementById("addTaskModal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      modal.dataset.goalId = goalId;
      modal.dataset.milestoneId = milestoneId;
      modal.dataset.taskId = taskId;
      modal.dataset.subtaskId = subtaskId;
      modal.dataset.type = "subtask";
      return;
    }

    // Delete Subtask
    if (e.target.closest(".delete-subtask")) {
      const btn = e.target.closest(".delete-subtask");
      const goalId = parseInt(btn.dataset.goalId);
      const milestoneId = parseInt(btn.dataset.milestoneId);
      const taskId = parseInt(btn.dataset.taskId);
      const subtaskId = parseInt(btn.dataset.subtaskId);
      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      const milestone = goal.milestones.find((m) => m.id === milestoneId);
      const task = milestone.tasks.find((t) => t.id === taskId);
      task.subtasks = task.subtasks.filter((st) => st.id !== subtaskId);
      saveGoals(goals);
      renderGoals();
      return;
    }
  });

  // Inline editing for goals
  goalsContainer.addEventListener("click", (e) => {
    if (e.target.matches(".editable-text") && !e.target.querySelector("input")) {
      startInlineEdit(e.target);
    }
  });

  goalsEventDelegationAttached = true;
}

// Inline editing functions
function startInlineEdit(element) {
  const currentText = element.textContent;
  const editType = element.dataset.editType;
  const isDescription = editType === "goal-description";
  const placeholder = isDescription && currentText === "Add description..." ? "" : currentText;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-edit-input";
  input.value = placeholder;
  input.placeholder = isDescription ? "Add description..." : "";

  element.innerHTML = "";
  element.appendChild(input);
  input.focus();
  input.select();

  const saveEdit = () => {
    const newValue = input.value.trim();
    saveInlineEdit(element, newValue);
  };

  input.addEventListener("blur", saveEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      element.textContent = currentText;
    }
  });
}

function saveInlineEdit(element, newValue) {
  const editType = element.dataset.editType;
  const goalId = parseInt(element.dataset.goalId);
  const milestoneId = element.dataset.milestoneId ? parseInt(element.dataset.milestoneId) : null;
  const taskId = element.dataset.taskId ? parseInt(element.dataset.taskId) : null;
  const subtaskId = element.dataset.subtaskId ? parseInt(element.dataset.subtaskId) : null;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return;

  switch (editType) {
    case "goal-name":
      if (newValue) {
        goal.name = newValue;
      }
      break;
    case "goal-description":
      goal.description = newValue;
      break;
    case "milestone-name":
      if (newValue && milestoneId) {
        const milestone = goal.milestones.find((m) => m.id === milestoneId);
        if (milestone) milestone.name = newValue;
      }
      break;
    case "task-name":
      if (newValue && milestoneId && taskId) {
        const milestone = goal.milestones.find((m) => m.id === milestoneId);
        if (milestone) {
          const task = milestone.tasks.find((t) => t.id === taskId);
          if (task) task.name = newValue;
        }
      }
      break;
    case "subtask-name":
      if (newValue && milestoneId && taskId && subtaskId) {
        const milestone = goal.milestones.find((m) => m.id === milestoneId);
        if (milestone) {
          const task = milestone.tasks.find((t) => t.id === taskId);
          if (task && task.subtasks) {
            const subtask = task.subtasks.find((st) => st.id === subtaskId);
            if (subtask) subtask.name = newValue;
          }
        }
      }
      break;
  }

  saveGoals(goals);
  renderGoals();
}

const closeAddTaskModal = document.getElementById("closeAddTaskModal");
const cancelAddTask = document.getElementById("cancelAddTask");
const confirmAddTask = document.getElementById("confirmAddTask");
const addTaskModal = document.getElementById("addTaskModal");

if (closeAddTaskModal) {
  closeAddTaskModal.addEventListener("click", () => {
    addTaskModal.classList.add("hidden");
    addTaskModal.classList.remove("flex");
  });
}

if (cancelAddTask) {
  cancelAddTask.addEventListener("click", () => {
    addTaskModal.classList.add("hidden");
    addTaskModal.classList.remove("flex");
  });
}

if (confirmAddTask) {
  confirmAddTask.addEventListener("click", () => {
    const modal = document.getElementById("addTaskModal");
    const taskName = document.getElementById("taskNameInput").value;
    const taskPoints = parseInt(document.getElementById("taskPointsInput").value) || 5;
    const dateInputValue = document.getElementById("taskDateInput").value;

    const goalId = parseInt(modal.dataset.goalId);
    const milestoneId = parseInt(modal.dataset.milestoneId);
    const goalTaskId = parseInt(modal.dataset.taskId);
    const subtaskId = modal.dataset.subtaskId ? parseInt(modal.dataset.subtaskId) : null;
    const type = modal.dataset.type;

    if (!taskName) return;

    const goals = loadGoals();
    const goal = goals.find((g) => g.id === goalId);
    const goalName = goal ? goal.name : "";

    const [year, month, day] = dateInputValue.split("-").map(Number);
    const taskDate = new Date(year, month - 1, day, 12, 0, 0);

    const dayData = loadDayData(taskDate);

    const newTask = {
      name: taskName,
      points: taskPoints,
      completed: false,
      goalId: goalId,
      milestoneId: milestoneId,
      goalTaskId: goalTaskId,
      goalName: goalName,
    };

    if (type === "subtask" && subtaskId) {
      newTask.subtaskId = subtaskId;
    }

    dayData.tasks.push(newTask);
    saveDayData(taskDate, dayData);

    // Store taskDate for "Go to Planner" button
    modal.dataset.addedTaskDate = dateInputValue;

    // Show success message
    showTaskAddedSuccess();
  });
}

function showTaskAddedSuccess() {
  const modal = document.getElementById("addTaskModal");
  const modalContent = modal.querySelector(".bg-white");

  // Store original content
  if (!modal.dataset.originalContent) {
    modal.dataset.originalContent = modalContent.innerHTML;
  }

  const taskDate = modal.dataset.addedTaskDate;
  const [year, month, day] = taskDate.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  modalContent.innerHTML = `
    <div class="flex justify-end">
      <button id="closeSuccessModal" class="btn-icon p-2 rounded-lg text-gray-400 hover:text-gray-600">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="text-center py-6">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
        <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">Task added to planner!</h3>
      <p class="text-gray-500 text-sm mb-6">Added for ${formattedDate}</p>
      <button id="goToPlannerBtn" class="w-full py-3 accent-gradient text-white rounded-xl font-medium hover:opacity-90 transition">
        Go to Planner
      </button>
    </div>
  `;

  // Attach event listeners
  document.getElementById("closeSuccessModal").addEventListener("click", () => {
    closeTaskAddedModal();
  });

  document.getElementById("goToPlannerBtn").addEventListener("click", () => {
    const taskDate = modal.dataset.addedTaskDate;
    const [year, month, day] = taskDate.split("-").map(Number);
    currentDate = new Date(year, month - 1, day, 12, 0, 0);

    closeTaskAddedModal();
    switchPage("planner");
    render();
  });
}

function closeTaskAddedModal() {
  const modal = document.getElementById("addTaskModal");
  const modalContent = modal.querySelector(".bg-white");

  // Restore original content
  if (modal.dataset.originalContent) {
    modalContent.innerHTML = modal.dataset.originalContent;
    delete modal.dataset.originalContent;

    // Re-attach original event listeners
    reattachAddTaskModalListeners();
  }

  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function reattachAddTaskModalListeners() {
  const closeAddTaskModalBtn = document.getElementById("closeAddTaskModal");
  const cancelAddTaskBtn = document.getElementById("cancelAddTask");
  const confirmAddTaskBtn = document.getElementById("confirmAddTask");

  if (closeAddTaskModalBtn) {
    closeAddTaskModalBtn.addEventListener("click", () => {
      document.getElementById("addTaskModal").classList.add("hidden");
      document.getElementById("addTaskModal").classList.remove("flex");
    });
  }

  if (cancelAddTaskBtn) {
    cancelAddTaskBtn.addEventListener("click", () => {
      document.getElementById("addTaskModal").classList.add("hidden");
      document.getElementById("addTaskModal").classList.remove("flex");
    });
  }

  if (confirmAddTaskBtn) {
    confirmAddTaskBtn.addEventListener("click", () => {
      const modal = document.getElementById("addTaskModal");
      const taskName = document.getElementById("taskNameInput").value;
      const taskPoints = parseInt(document.getElementById("taskPointsInput").value) || 5;
      const dateInputValue = document.getElementById("taskDateInput").value;

      const goalId = parseInt(modal.dataset.goalId);
      const milestoneId = parseInt(modal.dataset.milestoneId);
      const goalTaskId = parseInt(modal.dataset.taskId);
      const subtaskId = modal.dataset.subtaskId ? parseInt(modal.dataset.subtaskId) : null;
      const type = modal.dataset.type;

      if (!taskName) return;

      const goals = loadGoals();
      const goal = goals.find((g) => g.id === goalId);
      const goalName = goal ? goal.name : "";

      const [year, month, day] = dateInputValue.split("-").map(Number);
      const taskDate = new Date(year, month - 1, day, 12, 0, 0);

      const dayData = loadDayData(taskDate);

      const newTask = {
        name: taskName,
        points: taskPoints,
        completed: false,
        goalId: goalId,
        milestoneId: milestoneId,
        goalTaskId: goalTaskId,
        goalName: goalName,
      };

      if (type === "subtask" && subtaskId) {
        newTask.subtaskId = subtaskId;
      }

      dayData.tasks.push(newTask);
      saveDayData(taskDate, dayData);

      modal.dataset.addedTaskDate = dateInputValue;
      showTaskAddedSuccess();
    });
  }
}

if (addTaskModal) {
  addTaskModal.addEventListener("click", (e) => {
    if (e.target === addTaskModal) {
      addTaskModal.classList.add("hidden");
      addTaskModal.classList.remove("flex");
    }
  });
}

// Money Management
let moneyViewDate = getTodayGMT3();

let selectedCategoryFilter = "";

// Default categories
const defaultMoneyCategories = {
  income: [
    { id: "work", name: "Work" },
    { id: "freelance", name: "Freelance" },
    { id: "rent", name: "Rent" },
    { id: "maxim", name: "Maxim" },
    { id: "gifts", name: "Gifts" },
    { id: "joiia_income", name: "JOIIA" },
    { id: "savings", name: "Savings" },
  ],
  expenses: [
    { id: "food", name: "Food" },
    { id: "treats", name: "Treats" },
    { id: "clothes", name: "Clothes" },
    { id: "beauty", name: "Beauty" },
    { id: "family", name: "Family" },
    { id: "home", name: "Home" },
    { id: "bills", name: "Bills" },
    { id: "ivanechka", name: "Ivanechka" },
    { id: "joiia_expense", name: "JOIIA" },
  ],
};

function loadMoneyCategories() {
  if (currentUser && moneyCategoriesCache) {
    return moneyCategoriesCache;
  }
  return { ...defaultMoneyCategories };
}

function saveMoneyCategories(categories) {
  if (!currentUser) return;
  moneyCategoriesCache = categories;
  const data = {
    categories,
    transactions: transactionsCache || [],
  };
  setDoc(doc(db, "money", currentUser.uid), data, { merge: true }).catch(console.error);
}

function loadTransactions() {
  if (currentUser && transactionsCache) {
    return transactionsCache;
  }
  return [];
}

function saveTransactions(transactions) {
  if (!currentUser) return;
  transactionsCache = transactions;
  const data = {
    categories: moneyCategoriesCache || { ...defaultMoneyCategories },
    transactions,
  };
  setDoc(doc(db, "money", currentUser.uid), data, { merge: true }).catch(console.error);
}

function getCategoryInfo(categoryId) {
  const categories = loadMoneyCategories();
  const allCategories = [...categories.income, ...categories.expenses];
  const cat = allCategories.find((c) => c.id === categoryId);
  return cat || { name: categoryId };
}

function renderCategoryDropdown() {
  const select = document.getElementById("transactionCategory");
  if (!select) return;

  const categories = loadMoneyCategories();

  select.innerHTML = `
                <option value="">Select category</option>
                <optgroup label="Income">
                    ${categories.income.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
                </optgroup>
                <optgroup label="Expenses">
                    ${categories.expenses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
                </optgroup>
            `;
}

function formatMoney(amount) {
  const formatted = Math.abs(amount).toLocaleString("ru-RU");
  if (amount >= 0) {
    return `+${formatted} ₽`;
  }
  return `-${formatted} ₽`;
}

function formatMoneyPlain(amount) {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function calculateMoneyStats() {
  const transactions = loadTransactions();
  let totalBalance = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;

  const viewYear = moneyViewDate.getFullYear();
  const viewMonth = moneyViewDate.getMonth();

  transactions.forEach((t) => {
    totalBalance += t.amount;

    const tDate = new Date(t.date);
    if (tDate.getFullYear() === viewYear && tDate.getMonth() === viewMonth) {
      if (t.amount >= 0) {
        monthlyIncome += t.amount;
      } else {
        monthlyExpenses += Math.abs(t.amount);
      }
    }
  });

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet: monthlyIncome - monthlyExpenses,
  };
}

function getMonthTransactions() {
  const transactions = loadTransactions();
  const viewYear = moneyViewDate.getFullYear();
  const viewMonth = moneyViewDate.getMonth();

  return transactions
    .filter((t) => {
      const tDate = new Date(t.date);
      const matchesMonth = tDate.getFullYear() === viewYear && tDate.getMonth() === viewMonth;
      const matchesCategory = selectedCategoryFilter === "" || t.category === selectedCategoryFilter;
      return matchesMonth && matchesCategory;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function calculateFilteredTotal() {
  const transactions = getMonthTransactions();

  let total = 0;
  let incomeTotal = 0;
  let expenseTotal = 0;

  transactions.forEach((t) => {
    total += t.amount;
    if (t.amount >= 0) {
      incomeTotal += t.amount;
    } else {
      expenseTotal += Math.abs(t.amount);
    }
  });

  return { total, incomeTotal, expenseTotal };
}

function renderTransactionsSummary() {
  const summaryLabel = document.getElementById("summaryLabel");
  const summaryAmount = document.getElementById("summaryAmount");

  if (!summaryLabel || !summaryAmount) return;

  const { total, incomeTotal, expenseTotal } = calculateFilteredTotal();
  const categories = loadMoneyCategories();

  // Determine label based on filter
  if (selectedCategoryFilter === "") {
    summaryLabel.textContent = "Monthly Total:";
  } else {
    const allCategories = [...categories.income, ...categories.expenses];
    const selectedCat = allCategories.find((c) => c.id === selectedCategoryFilter);
    const categoryName = selectedCat ? selectedCat.name : selectedCategoryFilter;
    summaryLabel.textContent = `${categoryName} Total:`;
  }

  // Format and display amount
  const isExpenseCategory = categories.expenses.some((c) => c.id === selectedCategoryFilter);
  const isIncomeCategory = categories.income.some((c) => c.id === selectedCategoryFilter);

  let displayAmount;
  let colorClass;

  if (selectedCategoryFilter === "") {
    // No filter - show net total
    displayAmount = total;
    colorClass = total >= 0 ? "text-emerald-600" : "text-rose-600";
  } else if (isIncomeCategory) {
    // Income category filter
    displayAmount = incomeTotal;
    colorClass = "text-emerald-600";
  } else if (isExpenseCategory) {
    // Expense category filter - show as positive number but in red
    displayAmount = -expenseTotal;
    colorClass = "text-rose-600";
  } else {
    displayAmount = total;
    colorClass = total >= 0 ? "text-emerald-600" : "text-rose-600";
  }

  summaryAmount.textContent = formatMoney(displayAmount);
  summaryAmount.className = `text-lg font-bold ${colorClass}`;
}

function renderMoney() {
  const stats = calculateMoneyStats();

  // Render category dropdowns
  renderCategoryDropdown();
  renderCategoryFilterDropdown();

  function renderCategoryFilterDropdown() {
    const select = document.getElementById("categoryFilter");
    if (!select) return;

    const categories = loadMoneyCategories();

    select.innerHTML = `
          <option value="">All categories</option>
          <optgroup label="Income">
            ${categories.income.map((c) => `<option value="${c.id}" ${selectedCategoryFilter === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
          </optgroup>
          <optgroup label="Expenses">
            ${categories.expenses.map((c) => `<option value="${c.id}" ${selectedCategoryFilter === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
          </optgroup>
        `;
  }

  // Set default date to today
  setDefaultTransactionDate();

  // Update balance
  document.getElementById("moneyBalance").textContent = formatMoneyPlain(stats.totalBalance);
  document.getElementById("moneyBalance").className = `text-4xl font-bold mb-1 ${stats.totalBalance >= 0 ? "" : "text-rose-100"}`;

  // Update monthly stats
  document.getElementById("monthlyIncome").textContent = `+${stats.monthlyIncome.toLocaleString("ru-RU")} ₽`;
  document.getElementById("monthlyExpenses").textContent = `-${stats.monthlyExpenses.toLocaleString("ru-RU")} ₽`;

  const netEl = document.getElementById("monthlyNet");
  netEl.textContent = formatMoney(stats.monthlyNet);
  netEl.className = `font-bold ${stats.monthlyNet >= 0 ? "text-emerald-600" : "text-rose-600"}`;

  // Update month label
  document.getElementById("moneyMonth").textContent = moneyViewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Render transactions list
  const container = document.getElementById("transactionsList");
  const transactions = getMonthTransactions();

  if (transactions.length === 0) {
    container.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p class="text-gray-500">No transactions this month</p>
            </div>
        `;
    return;
  }

  // Format date as "1.01."
  function formatTransactionDate(dateStr) {
    const dateObj = new Date(dateStr);
    const day = dateObj.getDate();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}.`;
  }

  // Sort by date ascending (by calendar day)
  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = sortedTransactions
    .map((t) => {
      const catInfo = getCategoryInfo(t.category);
      const isIncome = t.amount >= 0;
      return `
            <div class="transaction-item flex items-center gap-3 p-3 bg-white rounded-lg group cursor-pointer" data-id="${t.id}">
                <div class="text-xs text-gray-400 font-medium w-12 flex-shrink-0">${formatTransactionDate(t.date)}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 text-sm truncate">${t.title}</div>
                </div>
                <div class="text-xs text-gray-500 w-20 truncate">${catInfo.name}</div>
                <div class="w-28 text-right">
                    <span class="font-semibold ${isIncome ? "text-emerald-600" : "text-gray-900"}">${formatMoney(t.amount)}</span>
                </div>
                <button class="edit-transaction opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50" data-id="${t.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                </button>
                <button class="delete-transaction opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50" data-id="${t.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `;
    })
    .join("");

  // Attach edit handlers
  container.querySelectorAll(".edit-transaction").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      editTransaction(id);
    });
  });

  // Attach delete handlers
  container.querySelectorAll(".delete-transaction").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      deleteTransaction(id);
    });
  });

  // Render transactions summary
  renderTransactionsSummary();

  // Attach category filter listener
  attachCategoryFilterListener();
}

function addTransaction(title, amount, category, date) {
  const transactions = loadTransactions();
  const categories = loadMoneyCategories();

  // Check if category is an expense category
  const isExpense = categories.expenses.some((c) => c.id === category);
  let finalAmount = parseFloat(amount);

  // If expense category and amount is positive, make it negative
  if (isExpense && finalAmount > 0) {
    finalAmount = -finalAmount;
  }
  // If income category and amount is negative, make it positive
  if (!isExpense && finalAmount < 0) {
    finalAmount = Math.abs(finalAmount);
  }

  transactions.push({
    id: Date.now(),
    title: title.trim(),
    amount: finalAmount,
    category: category,
    date: date,
  });

  saveTransactions(transactions);
  renderMoney();
}

function editTransaction(id) {
  const transactions = loadTransactions();
  const transaction = transactions.find((t) => t.id === id);
  if (!transaction) return;

  const modal = document.getElementById("editTransactionModal");
  const titleInput = document.getElementById("editTransactionTitle");
  const amountInput = document.getElementById("editTransactionAmount");
  const dateInput = document.getElementById("editTransactionDate");
  const categorySelect = document.getElementById("editTransactionCategory");

  // Populate category dropdown
  const categories = loadMoneyCategories();
  categorySelect.innerHTML = `
                <option value="">Select category</option>
                <optgroup label="Income">
                    ${categories.income.map((c) => `<option value="${c.id}" ${transaction.category === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
                </optgroup>
                <optgroup label="Expenses">
                    ${categories.expenses.map((c) => `<option value="${c.id}" ${transaction.category === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
                </optgroup>
            `;

  // Fill form with transaction data
  titleInput.value = transaction.title;
  amountInput.value = transaction.amount;
  dateInput.value = transaction.date;

  modal.dataset.transactionId = id;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function saveTransactionEdit(id, title, amount, date, category) {
  const transactions = loadTransactions();
  const categories = loadMoneyCategories();
  const transaction = transactions.find((t) => t.id === id);
  if (!transaction) return;

  // Check if category is an expense category
  const isExpense = categories.expenses.some((c) => c.id === category);
  let finalAmount = parseFloat(amount);

  // If expense category and amount is positive, make it negative
  if (isExpense && finalAmount > 0) {
    finalAmount = -finalAmount;
  }
  // If income category and amount is negative, make it positive
  if (!isExpense && finalAmount < 0) {
    finalAmount = Math.abs(finalAmount);
  }

  transaction.title = title.trim();
  transaction.amount = finalAmount;
  transaction.date = date;
  transaction.category = category;

  saveTransactions(transactions);
  renderMoney();
}

function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;
  const transactions = loadTransactions().filter((t) => t.id !== id);
  saveTransactions(transactions);
  renderMoney();
}

// Set default date for transaction form
function setDefaultTransactionDate() {
  const dateInput = document.getElementById("transactionDate");
  if (dateInput) {
    const today = getTodayGMT3();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    dateInput.value = `${year}-${month}-${day}`;
  }
}

// Money event listeners
const transactionForm = document.getElementById("transactionForm");
if (transactionForm) {
  transactionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("transactionTitle").value;
    const amount = document.getElementById("transactionAmount").value;
    const category = document.getElementById("transactionCategory").value;
    const date = document.getElementById("transactionDate").value;

    if (!title || !amount || !category || !date) return;

    addTransaction(title, amount, category, date);
    transactionForm.reset();
    // Reset date to today after submit
    setDefaultTransactionDate();
  });
}

// Edit Transaction Modal handlers
const editTransactionModal = document.getElementById("editTransactionModal");
const closeEditTransactionModal = document.getElementById("closeEditTransactionModal");
const cancelEditTransaction = document.getElementById("cancelEditTransaction");
const editTransactionForm = document.getElementById("editTransactionForm");

if (closeEditTransactionModal) {
  closeEditTransactionModal.addEventListener("click", () => {
    editTransactionModal.classList.add("hidden");
    editTransactionModal.classList.remove("flex");
  });
}

if (cancelEditTransaction) {
  cancelEditTransaction.addEventListener("click", () => {
    editTransactionModal.classList.add("hidden");
    editTransactionModal.classList.remove("flex");
  });
}

if (editTransactionForm) {
  editTransactionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = parseInt(editTransactionModal.dataset.transactionId);
    const title = document.getElementById("editTransactionTitle").value;
    const amount = document.getElementById("editTransactionAmount").value;
    const date = document.getElementById("editTransactionDate").value;
    const category = document.getElementById("editTransactionCategory").value;

    if (!title || !amount || !date || !category) return;

    saveTransactionEdit(id, title, amount, date, category);
    editTransactionModal.classList.add("hidden");
    editTransactionModal.classList.remove("flex");
  });
}

if (editTransactionModal) {
  editTransactionModal.addEventListener("click", (e) => {
    if (e.target === editTransactionModal) {
      editTransactionModal.classList.add("hidden");
      editTransactionModal.classList.remove("flex");
    }
  });
}

const prevMonthMoney = document.getElementById("prevMonthMoney");
const nextMonthMoney = document.getElementById("nextMonthMoney");

// Category filter event listener
const categoryFilter = document.getElementById("categoryFilter");
if (categoryFilter) {
  categoryFilter.addEventListener("change", (e) => {
    selectedCategoryFilter = e.target.value;
    renderMoney();
  });
}

if (prevMonthMoney) {
  prevMonthMoney.addEventListener("click", () => {
    moneyViewDate.setMonth(moneyViewDate.getMonth() - 1);
    renderMoney();
  });
}

if (nextMonthMoney) {
  nextMonthMoney.addEventListener("click", () => {
    moneyViewDate.setMonth(moneyViewDate.getMonth() + 1);
    renderMoney();
  });
}

// Categories Modal
const editCategoriesBtn = document.getElementById("editCategoriesBtn");
const categoriesModal = document.getElementById("categoriesModal");
const closeCategoriesModal = document.getElementById("closeCategoriesModal");
const saveCategoriesBtn = document.getElementById("saveCategoriesBtn");
const addIncomeCategory = document.getElementById("addIncomeCategory");
const addExpenseCategory = document.getElementById("addExpenseCategory");

function openCategoriesModal() {
  renderCategoriesModal();
  categoriesModal.classList.remove("hidden");
  categoriesModal.classList.add("flex");
}

function closeCategoriesModalFn() {
  categoriesModal.classList.add("hidden");
  categoriesModal.classList.remove("flex");
}

function renderCategoriesModal() {
  const categories = loadMoneyCategories();

  const incomeList = document.getElementById("incomeCategoriesList");
  const expenseList = document.getElementById("expenseCategoriesList");

  incomeList.innerHTML = categories.income
    .map(
      (cat, idx) => `
                <div class="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg" data-type="income" data-idx="${idx}">
                    <input type="text" class="category-name-input flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" value="${cat.name}" data-type="income" data-idx="${idx}">
                    <button class="delete-category-btn text-gray-300 hover:text-rose-500 transition" data-type="income" data-idx="${idx}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `,
    )
    .join("");

  expenseList.innerHTML = categories.expenses
    .map(
      (cat, idx) => `
                <div class="flex items-center gap-2 p-2 bg-rose-50 rounded-lg" data-type="expense" data-idx="${idx}">
                    <input type="text" class="category-name-input flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" value="${cat.name}" data-type="expense" data-idx="${idx}">
                    <button class="delete-category-btn text-gray-300 hover:text-rose-500 transition" data-type="expense" data-idx="${idx}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `,
    )
    .join("");

  // Attach delete handlers
  document.querySelectorAll(".delete-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const idx = parseInt(btn.dataset.idx);
      const categories = loadMoneyCategories();
      if (type === "income") {
        categories.income.splice(idx, 1);
      } else {
        categories.expenses.splice(idx, 1);
      }
      saveMoneyCategories(categories);
      renderCategoriesModal();
    });
  });
}

function saveCategoriesFromModal() {
  const categories = { income: [], expenses: [] };

  document.querySelectorAll("#incomeCategoriesList .category-name-input").forEach((input, idx) => {
    const name = input.value.trim();
    if (name) {
      categories.income.push({
        id: name.toLowerCase().replace(/\s+/g, "_"),
        name: name,
      });
    }
  });

  document.querySelectorAll("#expenseCategoriesList .category-name-input").forEach((input, idx) => {
    const name = input.value.trim();
    if (name) {
      categories.expenses.push({
        id: name.toLowerCase().replace(/\s+/g, "_"),
        name: name,
      });
    }
  });

  saveMoneyCategories(categories);
  closeCategoriesModalFn();
  renderMoney();
}

function addCategoryToList(type) {
  const categories = loadMoneyCategories();
  const newCat = { id: `new_${Date.now()}`, name: "New Category" };
  if (type === "income") {
    categories.income.push(newCat);
  } else {
    categories.expenses.push(newCat);
  }
  saveMoneyCategories(categories);
  renderCategoriesModal();

  // Focus on new input
  setTimeout(() => {
    const list = type === "income" ? "#incomeCategoriesList" : "#expenseCategoriesList";
    const inputs = document.querySelectorAll(`${list} .category-name-input`);
    if (inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      lastInput.focus();
      lastInput.select();
    }
  }, 50);
}

if (editCategoriesBtn) {
  editCategoriesBtn.addEventListener("click", openCategoriesModal);
}

if (closeCategoriesModal) {
  closeCategoriesModal.addEventListener("click", closeCategoriesModalFn);
}

if (saveCategoriesBtn) {
  saveCategoriesBtn.addEventListener("click", saveCategoriesFromModal);
}

if (addIncomeCategory) {
  addIncomeCategory.addEventListener("click", () => addCategoryToList("income"));
}

if (addExpenseCategory) {
  addExpenseCategory.addEventListener("click", () => addCategoryToList("expense"));
}

if (categoriesModal) {
  categoriesModal.addEventListener("click", (e) => {
    if (e.target === categoriesModal) closeCategoriesModalFn();
  });
}

// Notes Management
let currentSelection = null;

function loadRecentColors() {
  if (currentUser && recentColorsCache) {
    return recentColorsCache;
  }
  return ["#7c3aed", "#ef4444", "#10b981"];
}

function saveRecentColors(colors) {
  if (!currentUser) return;
  recentColorsCache = colors;
  setDoc(doc(db, "recentColors", currentUser.uid), { colors }, { merge: true }).catch(console.error);
}

function addRecentColor(color) {
  let colors = loadRecentColors();
  colors = colors.filter((c) => c.toLowerCase() !== color.toLowerCase());
  colors.unshift(color);
  colors = colors.slice(0, 3);
  saveRecentColors(colors);
  updateColorSwatches();
}

function updateColorSwatches() {
  const colors = loadRecentColors();
  const swatches = document.querySelectorAll(".color-swatch");

  swatches.forEach((swatch, idx) => {
    if (colors[idx]) {
      swatch.style.backgroundColor = colors[idx];
      swatch.style.display = "block";
      swatch.dataset.color = colors[idx];
    } else {
      swatch.style.display = "none";
    }
  });
}

function initTextFormatToolbar() {
  const toolbar = document.getElementById("textFormatToolbar");
  const colorPicker = document.getElementById("textColorPicker");
  const addBtn = toolbar.querySelector(".color-add-btn");

  if (!toolbar || !colorPicker) return;

  updateColorSwatches();

  toolbar.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const color = swatch.dataset.color;
      if (color) {
        applyTextColor(color);
      }
    });
  });

  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    colorPicker.click();
  });

  colorPicker.addEventListener("input", (e) => {
    const color = e.target.value;
    addRecentColor(color);
    applyTextColor(color);
  });

  toolbar.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
}

function handleSelectionChange() {
  const toolbar = document.getElementById("textFormatToolbar");
  if (!toolbar) return;

  const selection = window.getSelection();

  if (currentPage !== "notes") {
    toolbar.classList.remove("visible");
    return;
  }

  if (!selection.rangeCount || selection.isCollapsed) {
    toolbar.classList.remove("visible");
    currentSelection = null;
    return;
  }

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();

  const container = range.commonAncestorContainer;
  const noteBlock = container.nodeType === 3 ? container.parentElement?.closest(".note-block-content, .list-item-text") : container.closest?.(".note-block-content, .list-item-text");

  if (!noteBlock || selectedText.length === 0) {
    toolbar.classList.remove("visible");
    currentSelection = null;
    return;
  }

  currentSelection = {
    range: range.cloneRange(),
    text: selectedText,
  };

  const rect = range.getBoundingClientRect();

  // Позиционируем над выделением (50px выше верхней границы выделения)
  toolbar.style.left = `${rect.left + rect.width / 2}px`;
  toolbar.style.top = `${rect.top + window.scrollY - 50}px`;
  toolbar.classList.add("visible");
}

function applyTextColor(color) {
  if (!currentSelection) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(currentSelection.range);

  const span = document.createElement("span");
  span.style.color = color;

  try {
    const range = selection.getRangeAt(0);
    const contents = range.extractContents();

    const tempDiv = document.createElement("div");
    tempDiv.appendChild(contents);

    tempDiv.querySelectorAll("span[style*='color']").forEach((existingSpan) => {
      existingSpan.style.color = color;
    });

    if (tempDiv.querySelectorAll("span[style*='color']").length === 0) {
      span.innerHTML = tempDiv.innerHTML;
      range.insertNode(span);
    } else {
      while (tempDiv.firstChild) {
        range.insertNode(tempDiv.lastChild);
      }
    }

    const noteBlock = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentElement?.closest(".note-block-content, .list-item-text") : range.commonAncestorContainer.closest?.(".note-block-content, .list-item-text");

    if (noteBlock) {
      noteBlock.dispatchEvent(new Event("input", { bubbles: true }));
    }
  } catch (e) {
    console.error("Error applying color:", e);
  }

  const toolbar = document.getElementById("textFormatToolbar");
  if (toolbar) {
    toolbar.classList.remove("visible");
  }
  currentSelection = null;
}

function loadNotes() {
  if (currentUser && notesCache) {
    return notesCache;
  }
  return [];
}

function saveNotes(notes) {
  if (!currentUser) return;
  notesCache = notes;
  setDoc(doc(db, "notes", currentUser.uid), { notes }, { merge: true }).catch(console.error);
}

let selectedBlockId = null;
let lastEnterTime = 0;

function renderNotes() {
  const container = document.getElementById("notesList");
  const notes = loadNotes();

  if (notes.length === 0) {
    container.innerHTML = `
                    <div class="card p-12 text-center">
                        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        <p class="text-gray-500">No notes yet. Create your first note!</p>
                    </div>
                `;
    return;
  }

  container.innerHTML = notes
    .map(
      (note) => `
                <div class="note-card card p-5" data-note-id="${note.id}">
                    <div class="flex justify-between items-start mb-4">
                        <div class="text-xs text-gray-400">${new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                        <button class="delete-note btn-icon p-1.5 rounded-lg text-gray-400 hover:text-rose-600" data-note-id="${note.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                    <div class="note-blocks space-y-1" data-note-id="${note.id}">
                        ${note.blocks.map((block) => renderBlock(note.id, block)).join("")}
                    </div>
                </div>
            `,
    )
    .join("");

  attachNotesEventListeners();
}

function renderBlock(noteId, block) {
  const isSelected = selectedBlockId === block.id;

  if (block.type === "list") {
    return `
                    <div class="note-block note-block-list p-2 rounded-lg ${isSelected ? "selected" : ""}" data-note-id="${noteId}" data-block-id="${block.id}" data-block-type="list">
                        <div class="block-toolbar flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                            <button class="toolbar-btn block-type-text p-1.5 rounded text-gray-600 text-xs font-medium" data-type="text" title="Text">T</button>
                            <button class="toolbar-btn block-type-title p-1.5 rounded text-gray-600 text-xs font-medium" data-type="title" title="Title">H</button>
                            <button class="toolbar-btn active block-type-list p-1.5 rounded text-gray-600" data-type="list" title="List">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                        </div>
                        <button class="block-copy-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-violet-600 hover:bg-gray-50 shadow-sm" title="Copy">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                        </button>
                        <div class="list-items">
                            ${block.items
                              .map(
                                (item, idx) => `
                                <div class="list-item" data-item-idx="${idx}">
                                    <input type="checkbox" class="list-item-checkbox w-4 h-4 accent-violet-600 rounded" ${item.checked ? "checked" : ""}>
                                    <div class="list-item-text ${item.checked ? "line-through text-gray-400" : ""}" contenteditable="true" data-item-idx="${idx}">${item.text}</div>
                                </div>
                            `,
                              )
                              .join("")}
                        </div>
                    </div>
                `;
  }

  const isTitle = block.type === "title";
  return `
                <div class="note-block note-block-${block.type} p-2 rounded-lg ${isSelected ? "selected" : ""}" data-note-id="${noteId}" data-block-id="${block.id}" data-block-type="${block.type}">
                    <div class="block-toolbar flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                        <button class="toolbar-btn block-type-text p-1.5 rounded text-gray-600 text-xs font-medium ${block.type === "text" ? "active" : ""}" data-type="text" title="Text">T</button>
                        <button class="toolbar-btn block-type-title p-1.5 rounded text-gray-600 text-xs font-medium ${block.type === "title" ? "active" : ""}" data-type="title" title="Title">H</button>
                        <button class="toolbar-btn block-type-list p-1.5 rounded text-gray-600 ${block.type === "list" ? "active" : ""}" data-type="list" title="List">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                    <button class="block-copy-btn p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-violet-600 hover:bg-gray-50 shadow-sm" title="Copy">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                    </button>
                    <div class="note-block-content" contenteditable="true" data-placeholder="${isTitle ? "Heading..." : "Type something..."}">${block.content || ""}</div>
                </div>
            `;
}

function addNote() {
  const notes = loadNotes();
  const newNote = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    blocks: [{ id: Date.now() + 1, type: "text", content: "" }],
  };
  notes.unshift(newNote);
  saveNotes(notes);
  renderNotes();

  // Focus on the first block
  setTimeout(() => {
    const firstBlock = document.querySelector(`[data-note-id="${newNote.id}"] .note-block-content`);
    if (firstBlock) firstBlock.focus();
  }, 100);
}

function deleteNote(noteId) {
  if (!confirm("Delete this note?")) return;
  const notes = loadNotes().filter((n) => n.id !== noteId);
  saveNotes(notes);
  renderNotes();
}

function updateBlockContent(noteId, blockId, content) {
  const notes = loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  const block = note.blocks.find((b) => b.id === blockId);
  if (!block) return;
  block.content = content;
  saveNotes(notes);
}

function updateListItem(noteId, blockId, itemIdx, text, checked) {
  const notes = loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  const block = note.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "list") return;
  if (block.items[itemIdx]) {
    if (text !== undefined) block.items[itemIdx].text = text;
    if (checked !== undefined) block.items[itemIdx].checked = checked;
  }
  saveNotes(notes);
}

function addBlockAfter(noteId, blockId) {
  const notes = loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return null;
  const blockIdx = note.blocks.findIndex((b) => b.id === blockId);
  if (blockIdx === -1) return null;

  const newBlock = { id: Date.now(), type: "text", content: "" };
  note.blocks.splice(blockIdx + 1, 0, newBlock);
  saveNotes(notes);
  return newBlock.id;
}

function addListItem(noteId, blockId, afterIdx) {
  const notes = loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  const block = note.blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "list") return;

  block.items.splice(afterIdx + 1, 0, { text: "", checked: false });
  saveNotes(notes);
  renderNotes();

  // Focus on new item
  setTimeout(() => {
    const newItem = document.querySelector(`[data-block-id="${blockId}"] .list-item[data-item-idx="${afterIdx + 1}"] .list-item-text`);
    if (newItem) newItem.focus();
  }, 50);
}

function changeBlockType(noteId, blockId, newType) {
  const notes = loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  const block = note.blocks.find((b) => b.id === blockId);
  if (!block) return;

  const oldType = block.type;
  if (oldType === newType) return;

  if (newType === "list") {
    // Convert to list
    const content = block.content || "";
    block.type = "list";
    block.items = content ? [{ text: content, checked: false }] : [{ text: "", checked: false }];
    delete block.content;
  } else {
    // Convert from list or change text/title
    if (oldType === "list") {
      const text = block.items.map((i) => i.text).join("\n");
      block.content = text;
      delete block.items;
    }
    block.type = newType;
  }

  saveNotes(notes);
  renderNotes();
}

function copyBlockContent(noteId, blockId) {
  const notes = loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  const block = note.blocks.find((b) => b.id === blockId);
  if (!block) return;

  let text = "";
  if (block.type === "list") {
    text = block.items.map((i) => `${i.checked ? "☑" : "☐"} ${i.text}`).join("\n");
  } else {
    text = block.content || "";
  }

  navigator.clipboard.writeText(text).then(() => {
    // Show brief feedback
    const copyBtn = document.querySelector(`[data-block-id="${blockId}"] .block-copy-btn`);
    if (copyBtn) {
      copyBtn.classList.add("text-emerald-600");
      setTimeout(() => copyBtn.classList.remove("text-emerald-600"), 1000);
    }
  });
}

function selectBlock(blockId) {
  selectedBlockId = blockId;
  document.querySelectorAll(".note-block").forEach((b) => b.classList.remove("selected"));
  if (blockId) {
    const block = document.querySelector(`[data-block-id="${blockId}"]`);
    if (block) block.classList.add("selected");
  }
}

let notesEventDelegationAttached = false;
let textFormatToolbarInitialized = false;

function attachNotesEventListeners() {
  // Initialize text format toolbar once
  if (!textFormatToolbarInitialized) {
    initTextFormatToolbar();
    document.addEventListener("selectionchange", handleSelectionChange);
    textFormatToolbarInitialized = true;
  }

  // Add Note button
  const addNoteBtn = document.getElementById("addNoteBtn");
  if (addNoteBtn && !addNoteBtn.dataset.attached) {
    addNoteBtn.addEventListener("click", addNote);
    addNoteBtn.dataset.attached = "true";
  }

  if (notesEventDelegationAttached) return;

  const container = document.getElementById("notesList");
  if (!container) return;

  // Initialize text format toolbar
  initTextFormatToolbar();

  // Delete note
  container.addEventListener("click", (e) => {
    if (e.target.closest(".delete-note")) {
      const btn = e.target.closest(".delete-note");
      deleteNote(parseInt(btn.dataset.noteId));
      return;
    }

    // Block type change
    if (e.target.closest(".toolbar-btn")) {
      const btn = e.target.closest(".toolbar-btn");
      const block = btn.closest(".note-block");
      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);
      const newType = btn.dataset.type;
      changeBlockType(noteId, blockId, newType);
      return;
    }

    // Copy button
    if (e.target.closest(".block-copy-btn")) {
      const btn = e.target.closest(".block-copy-btn");
      const block = btn.closest(".note-block");
      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);
      copyBlockContent(noteId, blockId);
      return;
    }

    // List item checkbox
    if (e.target.matches(".list-item-checkbox")) {
      const checkbox = e.target;
      const block = checkbox.closest(".note-block");
      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);
      const itemIdx = parseInt(checkbox.closest(".list-item").dataset.itemIdx);
      updateListItem(noteId, blockId, itemIdx, undefined, checkbox.checked);

      // Update visual style
      const textEl = checkbox.closest(".list-item").querySelector(".list-item-text");
      if (checkbox.checked) {
        textEl.classList.add("line-through", "text-gray-400");
      } else {
        textEl.classList.remove("line-through", "text-gray-400");
      }
      return;
    }
  });

  // Focus/click on block to select
  container.addEventListener("focusin", (e) => {
    const block = e.target.closest(".note-block");
    if (block) {
      selectBlock(parseInt(block.dataset.blockId));
    }
  });

  // Click outside to deselect
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".note-block") && !e.target.closest(".block-toolbar") && !e.target.closest(".text-format-toolbar")) {
      selectBlock(null);
    }
  });

  // Input handling for content editable
  container.addEventListener("input", (e) => {
    if (e.target.matches(".note-block-content")) {
      const block = e.target.closest(".note-block");
      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);
      updateBlockContent(noteId, blockId, e.target.innerHTML);
    }

    if (e.target.matches(".list-item-text")) {
      const block = e.target.closest(".note-block");
      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);
      const itemIdx = parseInt(e.target.dataset.itemIdx);
      updateListItem(noteId, blockId, itemIdx, e.target.innerHTML);
    }
  });

  // Paste handling - preserve formatting for highlighted text
  container.addEventListener("paste", (e) => {
    if (e.target.matches(".note-block-content") || e.target.matches(".list-item-text")) {
      e.preventDefault();

      // Get plain text from clipboard
      const text = (e.clipboardData || window.clipboardData).getData("text/plain");

      // Insert plain text at cursor position
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      range.deleteContents();

      // Create text node and insert
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);

      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      // Trigger input event to save changes
      e.target.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  // Selection change handling for format toolbar
  document.addEventListener("selectionchange", handleSelectionChange);

  // Keydown handling for Enter
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const block = e.target.closest(".note-block");
      if (!block) return;

      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);
      const blockType = block.dataset.blockType;

      if (blockType === "list" && e.target.matches(".list-item-text")) {
        e.preventDefault();
        const itemIdx = parseInt(e.target.dataset.itemIdx);
        const currentTime = Date.now();
        const itemText = e.target.textContent.trim();

        // Double Enter detection - create new block
        if (currentTime - lastEnterTime < 500 && itemText === "") {
          // Remove empty item and create new block
          const notes = loadNotes();
          const note = notes.find((n) => n.id === noteId);
          const blockData = note.blocks.find((b) => b.id === blockId);
          if (blockData.items.length > 1) {
            blockData.items.splice(itemIdx, 1);
          }
          saveNotes(notes);

          const newBlockId = addBlockAfter(noteId, blockId);
          renderNotes();
          setTimeout(() => {
            const newContent = document.querySelector(`[data-block-id="${newBlockId}"] .note-block-content`);
            if (newContent) newContent.focus();
          }, 50);
        } else {
          // Add new list item
          addListItem(noteId, blockId, itemIdx);
        }
        lastEnterTime = currentTime;
      } else if (e.target.matches(".note-block-content")) {
        e.preventDefault();
        const newBlockId = addBlockAfter(noteId, blockId);
        renderNotes();
        setTimeout(() => {
          const newContent = document.querySelector(`[data-block-id="${newBlockId}"] .note-block-content`);
          if (newContent) newContent.focus();
        }, 50);
      }
    }

    // Backspace/Delete on empty block or list item to delete
    if (e.key === "Backspace" || e.key === "Delete") {
      const block = e.target.closest(".note-block");
      if (!block) return;

      const blockType = block.dataset.blockType;
      const noteId = parseInt(block.dataset.noteId);
      const blockId = parseInt(block.dataset.blockId);

      // Handle empty list item deletion
      if (blockType === "list" && e.target.matches(".list-item-text") && e.target.textContent === "") {
        const itemIdx = parseInt(e.target.dataset.itemIdx);
        const notes = loadNotes();
        const note = notes.find((n) => n.id === noteId);
        const blockData = note.blocks.find((b) => b.id === blockId);

        if (blockData && blockData.items && blockData.items.length > 1) {
          e.preventDefault();
          blockData.items.splice(itemIdx, 1);
          saveNotes(notes);
          renderNotes();

          // Focus previous or next item and place cursor at end
          setTimeout(() => {
            const focusIdx = e.key === "Backspace" ? Math.max(0, itemIdx - 1) : Math.min(itemIdx, blockData.items.length - 1);
            const targetItem = document.querySelector(`[data-block-id="${blockId}"] .list-item[data-item-idx="${focusIdx}"] .list-item-text`);
            if (targetItem) {
              targetItem.focus();
              // Place cursor at end of text
              const range = document.createRange();
              const selection = window.getSelection();
              range.selectNodeContents(targetItem);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 50);
        } else if (blockData && blockData.items && blockData.items.length === 1) {
          // Last item - convert to text block or delete block
          e.preventDefault();
          const notes2 = loadNotes();
          const note2 = notes2.find((n) => n.id === noteId);

          if (note2.blocks.length > 1) {
            // Delete the entire block
            const blockIdx = note2.blocks.findIndex((b) => b.id === blockId);
            note2.blocks.splice(blockIdx, 1);
            saveNotes(notes2);
            renderNotes();

            // Focus previous block
            if (blockIdx > 0) {
              const prevBlock = note2.blocks[blockIdx - 1];
              setTimeout(() => {
                const prevContent = document.querySelector(`[data-block-id="${prevBlock.id}"] .note-block-content, [data-block-id="${prevBlock.id}"] .list-item-text:last-child`);
                if (prevContent) prevContent.focus();
              }, 50);
            }
          } else {
            // Convert to empty text block
            const blockData2 = note2.blocks.find((b) => b.id === blockId);
            blockData2.type = "text";
            blockData2.content = "";
            delete blockData2.items;
            saveNotes(notes2);
            renderNotes();

            setTimeout(() => {
              const textContent = document.querySelector(`[data-block-id="${blockId}"] .note-block-content`);
              if (textContent) textContent.focus();
            }, 50);
          }
        }
        return;
      }

      // Handle empty text/title block deletion
      if (e.target.matches(".note-block-content") && e.target.textContent === "") {
        const notes = loadNotes();
        const note = notes.find((n) => n.id === noteId);

        if (note.blocks.length > 1) {
          e.preventDefault();
          const blockIdx = note.blocks.findIndex((b) => b.id === blockId);
          note.blocks.splice(blockIdx, 1);
          saveNotes(notes);
          renderNotes();

          // Focus previous block
          if (blockIdx > 0) {
            const prevBlock = note.blocks[blockIdx - 1];
            setTimeout(() => {
              const prevContent = document.querySelector(`[data-block-id="${prevBlock.id}"] .note-block-content, [data-block-id="${prevBlock.id}"] .list-item-text:last-child`);
              if (prevContent) prevContent.focus();
            }, 50);
          }
        }
      }
    }
  });

  notesEventDelegationAttached = true;
}

// Goals Drag and Drop Functions
let draggedGoalElement = null;
let draggedType = null;

function setupGoalsDragDrop() {
  const container = document.getElementById("goalsList");
  if (!container) return;

  // Goal cards drag and drop
  container.querySelectorAll('.goal-card[draggable="true"]').forEach((el) => {
    el.addEventListener("dragstart", handleGoalDragStart);
    el.addEventListener("dragend", handleGoalDragEnd);
    el.addEventListener("dragover", handleGoalDragOver);
    el.addEventListener("dragleave", handleGoalDragLeave);
    el.addEventListener("drop", handleGoalDrop);
  });

  // Milestone blocks drag and drop
  container.querySelectorAll('.milestone-block[draggable="true"]').forEach((el) => {
    el.addEventListener("dragstart", handleMilestoneDragStart);
    el.addEventListener("dragend", handleMilestoneDragEnd);
    el.addEventListener("dragover", handleMilestoneDragOver);
    el.addEventListener("dragleave", handleMilestoneDragLeave);
    el.addEventListener("drop", handleMilestoneDrop);
  });

  // Task items drag and drop
  container.querySelectorAll('.goal-task-item[draggable="true"]').forEach((el) => {
    el.addEventListener("dragstart", handleTaskDragStart);
    el.addEventListener("dragend", handleTaskDragEnd);
    el.addEventListener("dragover", handleTaskDragOver);
    el.addEventListener("dragleave", handleTaskDragLeave);
    el.addEventListener("drop", handleTaskDrop);
  });

  // Subtask items drag and drop
  container.querySelectorAll('.subtask-item[draggable="true"]').forEach((el) => {
    el.addEventListener("dragstart", handleSubtaskDragStart);
    el.addEventListener("dragend", handleSubtaskDragEnd);
    el.addEventListener("dragover", handleSubtaskDragOver);
    el.addEventListener("dragleave", handleSubtaskDragLeave);
    el.addEventListener("drop", handleSubtaskDrop);
  });
}

// Goal drag handlers
function handleGoalDragStart(e) {
  draggedGoalElement = this;
  draggedType = "goal";
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.goalId);
}

function handleGoalDragEnd(e) {
  this.classList.remove("dragging");
  document.querySelectorAll(".goal-card").forEach((el) => el.classList.remove("drag-over"));
  draggedGoalElement = null;
  draggedType = null;
}

function handleGoalDragOver(e) {
  if (draggedType !== "goal") return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  this.classList.add("drag-over");
}

function handleGoalDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleGoalDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");
  if (draggedType !== "goal" || !draggedGoalElement) return;

  const fromId = parseInt(draggedGoalElement.dataset.goalId);
  const toId = parseInt(this.dataset.goalId);
  if (fromId === toId) return;

  const goals = loadGoals();
  const fromIdx = goals.findIndex((g) => g.id === fromId);
  const toIdx = goals.findIndex((g) => g.id === toId);
  const [goal] = goals.splice(fromIdx, 1);
  goals.splice(toIdx, 0, goal);
  saveGoals(goals);
  renderGoals();
}

// Milestone drag handlers
function handleMilestoneDragStart(e) {
  e.stopPropagation();
  draggedGoalElement = this;
  draggedType = "milestone";
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(
    "text/plain",
    JSON.stringify({
      goalId: this.dataset.goalId,
      milestoneId: this.dataset.milestoneId,
    }),
  );
}

function handleMilestoneDragEnd(e) {
  this.classList.remove("dragging");
  document.querySelectorAll(".milestone-block").forEach((el) => el.classList.remove("drag-over"));
  draggedGoalElement = null;
  draggedType = null;
}

function handleMilestoneDragOver(e) {
  if (draggedType !== "milestone") return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
  this.classList.add("drag-over");
}

function handleMilestoneDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleMilestoneDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove("drag-over");
  if (draggedType !== "milestone" || !draggedGoalElement) return;

  const fromGoalId = parseInt(draggedGoalElement.dataset.goalId);
  const fromMilestoneId = parseInt(draggedGoalElement.dataset.milestoneId);
  const toGoalId = parseInt(this.dataset.goalId);
  const toMilestoneId = parseInt(this.dataset.milestoneId);

  if (fromGoalId !== toGoalId) return; // Only allow reordering within same goal
  if (fromMilestoneId === toMilestoneId) return;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === fromGoalId);
  if (!goal || !goal.milestones) return;

  const fromIdx = goal.milestones.findIndex((m) => m.id === fromMilestoneId);
  const toIdx = goal.milestones.findIndex((m) => m.id === toMilestoneId);
  const [milestone] = goal.milestones.splice(fromIdx, 1);
  goal.milestones.splice(toIdx, 0, milestone);
  saveGoals(goals);
  renderGoals();
}

// Task drag handlers
function handleTaskDragStart(e) {
  e.stopPropagation();
  draggedGoalElement = this;
  draggedType = "task";
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(
    "text/plain",
    JSON.stringify({
      goalId: this.dataset.goalId,
      milestoneId: this.dataset.milestoneId,
      taskId: this.dataset.taskId,
    }),
  );
}

function handleTaskDragEnd(e) {
  this.classList.remove("dragging");
  document.querySelectorAll(".goal-task-item").forEach((el) => el.classList.remove("drag-over"));
  draggedGoalElement = null;
  draggedType = null;
}

function handleTaskDragOver(e) {
  if (draggedType !== "task") return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
  this.classList.add("drag-over");
}

function handleTaskDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleTaskDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove("drag-over");
  if (draggedType !== "task" || !draggedGoalElement) return;

  const fromGoalId = parseInt(draggedGoalElement.dataset.goalId);
  const fromMilestoneId = parseInt(draggedGoalElement.dataset.milestoneId);
  const fromTaskId = parseInt(draggedGoalElement.dataset.taskId);
  const toGoalId = parseInt(this.dataset.goalId);
  const toMilestoneId = parseInt(this.dataset.milestoneId);
  const toTaskId = parseInt(this.dataset.taskId);

  if (fromGoalId !== toGoalId || fromMilestoneId !== toMilestoneId) return;
  if (fromTaskId === toTaskId) return;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === fromGoalId);
  const milestone = goal?.milestones?.find((m) => m.id === fromMilestoneId);
  if (!milestone || !milestone.tasks) return;

  const fromIdx = milestone.tasks.findIndex((t) => t.id === fromTaskId);
  const toIdx = milestone.tasks.findIndex((t) => t.id === toTaskId);
  const [task] = milestone.tasks.splice(fromIdx, 1);
  milestone.tasks.splice(toIdx, 0, task);
  saveGoals(goals);
  renderGoals();
}

// Subtask drag handlers
function handleSubtaskDragStart(e) {
  e.stopPropagation();
  draggedGoalElement = this;
  draggedType = "subtask";
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(
    "text/plain",
    JSON.stringify({
      goalId: this.dataset.goalId,
      milestoneId: this.dataset.milestoneId,
      taskId: this.dataset.taskId,
      subtaskId: this.dataset.subtaskId,
    }),
  );
}

function handleSubtaskDragEnd(e) {
  this.classList.remove("dragging");
  document.querySelectorAll(".subtask-item").forEach((el) => el.classList.remove("drag-over"));
  draggedGoalElement = null;
  draggedType = null;
}

function handleSubtaskDragOver(e) {
  if (draggedType !== "subtask") return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
  this.classList.add("drag-over");
}

function handleSubtaskDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleSubtaskDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove("drag-over");
  if (draggedType !== "subtask" || !draggedGoalElement) return;

  const fromGoalId = parseInt(draggedGoalElement.dataset.goalId);
  const fromMilestoneId = parseInt(draggedGoalElement.dataset.milestoneId);
  const fromTaskId = parseInt(draggedGoalElement.dataset.taskId);
  const fromSubtaskId = parseInt(draggedGoalElement.dataset.subtaskId);
  const toGoalId = parseInt(this.dataset.goalId);
  const toMilestoneId = parseInt(this.dataset.milestoneId);
  const toTaskId = parseInt(this.dataset.taskId);
  const toSubtaskId = parseInt(this.dataset.subtaskId);

  if (fromGoalId !== toGoalId || fromMilestoneId !== toMilestoneId || fromTaskId !== toTaskId) return;
  if (fromSubtaskId === toSubtaskId) return;

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === fromGoalId);
  const milestone = goal?.milestones?.find((m) => m.id === fromMilestoneId);
  const task = milestone?.tasks?.find((t) => t.id === fromTaskId);
  if (!task || !task.subtasks) return;

  const fromIdx = task.subtasks.findIndex((st) => st.id === fromSubtaskId);
  const toIdx = task.subtasks.findIndex((st) => st.id === toSubtaskId);
  const [subtask] = task.subtasks.splice(fromIdx, 1);
  task.subtasks.splice(toIdx, 0, subtask);
  saveGoals(goals);
  renderGoals();
}

// Initialize
render();

if (document.getElementById("goalsList")) {
  attachGoalsEventListeners();
}

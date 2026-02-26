const DEFAULT_SETUP = Object.freeze({
  subject: "Matematika",
  duration: 60,
  totalQuestions: 20,
});
const AUTH_STORAGE_KEY = "simulasi_tka_auth_v1";
const ADMIN_STORAGE_KEY = "simulasi_tka_admin_v1";
const HISTORY_LIMIT = 20;

const state = {
  currentView: "view-setup",
  setup: { ...DEFAULT_SETUP },
  auth: {
    token: "",
    user: null,
  },
  admin: {
    token: "",
    eventSource: null,
    draftQuestions: [],
  },
  officialSessionId: "",
  progressSyncId: null,
  participant: null,
  token: "",
  questions: [],
  answers: [],
  flags: [],
  currentQuestion: 0,
  remainingSeconds: 0,
  timerId: null,
  finished: false,
  finishReason: "",
  questionSource: "-",
  security: {
    violations: 0,
    penaltyCount: 0,
    penaltyPoints: 0,
    lockUntil: 0,
    lastEventAt: 0,
  },
  toastTimerId: null,
};

const dom = {
  views: document.querySelectorAll(".view"),
  headerUserBadge: document.getElementById("headerUserBadge"),
  setupAuthStatus: document.getElementById("setupAuthStatus"),
  openCredentialsBtn: document.getElementById("openCredentialsBtn"),
  openAdminBtn: document.getElementById("openAdminBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  setupForm: document.getElementById("setupForm"),
  subjectSelect: document.getElementById("subjectSelect"),
  durationSelect: document.getElementById("durationSelect"),
  questionCountSelect: document.getElementById("questionCountSelect"),
  registerForm: document.getElementById("registerForm"),
  registerUsername: document.getElementById("registerUsername"),
  registerDisplayName: document.getElementById("registerDisplayName"),
  registerPassword: document.getElementById("registerPassword"),
  loginForm: document.getElementById("loginForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  authStatusText: document.getElementById("authStatusText"),
  toConfirmBtn: document.getElementById("toConfirmBtn"),
  refreshCredentialsHistoryBtn: document.getElementById("refreshCredentialsHistoryBtn"),
  logoutFromCredentialsBtn: document.getElementById("logoutFromCredentialsBtn"),
  credentialsHistoryPanel: document.getElementById("credentialsHistoryPanel"),
  credentialsHistoryStatus: document.getElementById("credentialsHistoryStatus"),
  credentialsHistoryList: document.getElementById("credentialsHistoryList"),
  backToSetupFromCredentialsBtn: document.getElementById("backToSetupFromCredentialsBtn"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminPassword: document.getElementById("adminPassword"),
  backFromAdminLoginBtn: document.getElementById("backFromAdminLoginBtn"),
  adminSessionText: document.getElementById("adminSessionText"),
  adminLogoutBtn: document.getElementById("adminLogoutBtn"),
  adminExamForm: document.getElementById("adminExamForm"),
  adminSubjectSelect: document.getElementById("adminSubjectSelect"),
  adminDurationInput: document.getElementById("adminDurationInput"),
  adminQuestionCountInput: document.getElementById("adminQuestionCountInput"),
  adminExamTokenInput: document.getElementById("adminExamTokenInput"),
  adminGenerateQuestionsBtn: document.getElementById("adminGenerateQuestionsBtn"),
  adminStartExamBtn: document.getElementById("adminStartExamBtn"),
  adminStopExamBtn: document.getElementById("adminStopExamBtn"),
  adminRefreshStateBtn: document.getElementById("adminRefreshStateBtn"),
  adminExamStateText: document.getElementById("adminExamStateText"),
  adminAddQuestionBtn: document.getElementById("adminAddQuestionBtn"),
  adminQuestionBuilderStatus: document.getElementById("adminQuestionBuilderStatus"),
  adminQuestionBuilderList: document.getElementById("adminQuestionBuilderList"),
  adminRefreshMonitorBtn: document.getElementById("adminRefreshMonitorBtn"),
  adminMonitorStatus: document.getElementById("adminMonitorStatus"),
  adminMonitorList: document.getElementById("adminMonitorList"),
  adminRefreshResultsBtn: document.getElementById("adminRefreshResultsBtn"),
  adminResultsStatus: document.getElementById("adminResultsStatus"),
  adminResultsList: document.getElementById("adminResultsList"),
  tokenDisplay: document.getElementById("tokenDisplay"),
  refreshTokenBtn: document.getElementById("refreshTokenBtn"),
  confirmForm: document.getElementById("confirmForm"),
  confirmNik: document.getElementById("confirmNik"),
  confirmDisplayName: document.getElementById("confirmDisplayName"),
  confirmGender: document.getElementById("confirmGender"),
  confirmExamSubject: document.getElementById("confirmExamSubject"),
  confirmFullName: document.getElementById("confirmFullName"),
  birthDay: document.getElementById("birthDay"),
  birthMonth: document.getElementById("birthMonth"),
  birthYear: document.getElementById("birthYear"),
  confirmToken: document.getElementById("confirmToken"),
  backToSetupFromConfirmBtn: document.getElementById("backToSetupFromConfirmBtn"),
  loadingText: document.getElementById("loadingText"),
  examQuestionHeading: document.getElementById("examQuestionHeading"),
  examSubjectInfo: document.getElementById("examSubjectInfo"),
  timerBadge: document.getElementById("timerBadge"),
  securityBadge: document.getElementById("securityBadge"),
  openQuestionListBtn: document.getElementById("openQuestionListBtn"),
  lockBanner: document.getElementById("lockBanner"),
  securityEventBanner: document.getElementById("securityEventBanner"),
  questionText: document.getElementById("questionText"),
  questionTypeHint: document.getElementById("questionTypeHint"),
  questionImageWrap: document.getElementById("questionImageWrap"),
  questionImage: document.getElementById("questionImage"),
  optionList: document.getElementById("optionList"),
  prevQuestionBtn: document.getElementById("prevQuestionBtn"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),
  markDoubtCheckbox: document.getElementById("markDoubtCheckbox"),
  finishExamBtn: document.getElementById("finishExamBtn"),
  questionProgressText: document.getElementById("questionProgressText"),
  questionListModal: document.getElementById("questionListModal"),
  closeQuestionListBtn: document.getElementById("closeQuestionListBtn"),
  questionGrid: document.getElementById("questionGrid"),
  finishReason: document.getElementById("finishReason"),
  correctCountText: document.getElementById("correctCountText"),
  wrongCountText: document.getElementById("wrongCountText"),
  penaltyText: document.getElementById("penaltyText"),
  finalScoreText: document.getElementById("finalScoreText"),
  resultSaveStatus: document.getElementById("resultSaveStatus"),
  resultHistoryStatus: document.getElementById("resultHistoryStatus"),
  resultHistoryList: document.getElementById("resultHistoryList"),
  reviewList: document.getElementById("reviewList"),
  restartBtn: document.getElementById("restartBtn"),
  toast: document.getElementById("toast"),
};

init();

function init() {
  initBirthSelectors();
  bindEvents();
  hydrateAuthFromStorage();
  hydrateAdminFromStorage();
  updateAuthUI();
  updateAdminUI();
  renderAdminQuestionBuilder();
  showView("view-setup");
  void syncSessionFromServer();
  void syncAdminSession();
}

function bindEvents() {
  dom.setupForm.addEventListener("submit", handleSetupSubmit);
  dom.openCredentialsBtn.addEventListener("click", () => {
    showView("view-credentials");
    if (isAuthenticated()) {
      void loadAndRenderHistory("credentials");
    }
  });
  dom.openAdminBtn.addEventListener("click", handleOpenAdmin);
  dom.logoutBtn.addEventListener("click", handleLogout);
  dom.registerForm.addEventListener("submit", handleRegisterSubmit);
  dom.loginForm.addEventListener("submit", handleLoginSubmit);
  dom.toConfirmBtn.addEventListener("click", handleToConfirm);
  dom.refreshCredentialsHistoryBtn.addEventListener("click", () => {
    void loadAndRenderHistory("credentials");
  });
  dom.logoutFromCredentialsBtn.addEventListener("click", handleLogout);
  dom.backToSetupFromCredentialsBtn.addEventListener("click", () => showView("view-setup"));
  dom.refreshTokenBtn.addEventListener("click", refreshToken);
  dom.confirmForm.addEventListener("submit", handleConfirmSubmit);
  dom.backToSetupFromConfirmBtn.addEventListener("click", resetToSetup);

  dom.adminLoginForm.addEventListener("submit", handleAdminLoginSubmit);
  dom.backFromAdminLoginBtn.addEventListener("click", () => showView("view-setup"));
  dom.adminLogoutBtn.addEventListener("click", handleAdminLogout);
  dom.adminExamForm.addEventListener("submit", handleAdminSaveDraftSubmit);
  dom.adminAddQuestionBtn.addEventListener("click", () => {
    addAdminDraftQuestion();
  });
  dom.adminQuestionCountInput.addEventListener("input", () => {
    renderAdminQuestionBuilderStatus();
  });
  dom.adminGenerateQuestionsBtn.addEventListener("click", () => {
    void handleAdminGenerateQuestions();
  });
  dom.adminStartExamBtn.addEventListener("click", () => {
    void handleAdminStartExam();
  });
  dom.adminStopExamBtn.addEventListener("click", () => {
    void handleAdminStopExam();
  });
  dom.adminRefreshStateBtn.addEventListener("click", () => {
    void loadAdminDashboardData();
  });
  dom.adminRefreshMonitorBtn.addEventListener("click", () => {
    void loadAdminMonitor();
  });
  dom.adminRefreshResultsBtn.addEventListener("click", () => {
    void loadAdminResults();
  });

  dom.prevQuestionBtn.addEventListener("click", () => moveQuestion(-1));
  dom.nextQuestionBtn.addEventListener("click", () => moveQuestion(1));
  dom.openQuestionListBtn.addEventListener("click", openQuestionListModal);
  dom.closeQuestionListBtn.addEventListener("click", closeQuestionListModal);
  dom.finishExamBtn.addEventListener("click", () => {
    if (state.finished) {
      return;
    }
    const confirmed = window.confirm("Selesaikan ujian sekarang?");
    if (confirmed) {
      void finishExam("Ujian diselesaikan oleh peserta.");
    }
  });
  dom.markDoubtCheckbox.addEventListener("change", handleFlagToggle);

  dom.questionListModal.addEventListener("click", (event) => {
    if (event.target === dom.questionListModal) {
      closeQuestionListModal();
    }
  });

  dom.restartBtn.addEventListener("click", resetToSetup);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      registerSecurityViolation("visibilitychange");
    }
  });

  window.addEventListener("blur", () => {
    if (document.hidden) {
      return;
    }
    registerSecurityViolation("window-blur");
  });

  window.addEventListener("beforeunload", (event) => {
    if (!isExamInProgress()) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });
}

function initBirthSelectors() {
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  for (let day = 1; day <= 31; day += 1) {
    const option = document.createElement("option");
    option.value = String(day).padStart(2, "0");
    option.textContent = option.value;
    dom.birthDay.append(option);
  }

  monthNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1).padStart(2, "0");
    option.textContent = name;
    dom.birthMonth.append(option);
  });

  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 20; year <= currentYear - 8; year += 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    dom.birthYear.append(option);
  }
}

function handleSetupSubmit(event) {
  event.preventDefault();
  state.setup.subject = dom.subjectSelect.value;
  state.setup.duration = Number(dom.durationSelect.value);
  state.setup.totalQuestions = Number(dom.questionCountSelect.value);

  if (!isAuthenticated()) {
    showView("view-credentials");
    showToast("Login akun peserta terlebih dahulu.");
    return;
  }

  prepareConfirmationView();
  showView("view-confirm");
}

function refreshToken() {
  if (!isAuthenticated()) {
    showToast("Sesi login tidak ditemukan.");
    return;
  }
  state.token = generateToken();
  updateTokenUI();
  showToast("Token baru sudah dibuat.");
}

function updateTokenUI() {
  dom.tokenDisplay.textContent = state.token;
}

function isAuthenticated() {
  return Boolean(state.auth.token && state.auth.user && state.auth.user.userId);
}

function hydrateAuthFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string" && parsed.user) {
      state.auth.token = parsed.token;
      state.auth.user = parsed.user;
    }
  } catch (_error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function persistAuthToStorage() {
  if (!isAuthenticated()) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      token: state.auth.token,
      user: state.auth.user,
    })
  );
}

function setAuthSession(token, user) {
  state.auth.token = String(token || "");
  state.auth.user = user || null;
  persistAuthToStorage();
  updateAuthUI();
}

function clearAuthSession() {
  state.auth.token = "";
  state.auth.user = null;
  persistAuthToStorage();
  updateAuthUI();
}

async function syncSessionFromServer() {
  if (!isAuthenticated()) {
    return;
  }
  try {
    const payload = await apiRequest("/api/auth/me", { auth: true });
    if (!payload || !payload.user || !payload.user.userId) {
      throw new Error("Sesi tidak valid.");
    }
    setAuthSession(state.auth.token, payload.user);
  } catch (_error) {
    clearAuthSession();
    showToast("Sesi login berakhir. Silakan login ulang.");
  }
}

function updateAuthUI() {
  const authenticated = isAuthenticated();
  const user = state.auth.user || {};
  const displayText = authenticated
    ? `${user.displayName || user.username} (@${user.username})`
    : "";

  updateHeaderUser(authenticated ? `Akun: ${displayText}` : "");
  dom.setupAuthStatus.textContent = authenticated
    ? `Status akun: login sebagai ${displayText}.`
    : "Status akun: belum login.";
  dom.authStatusText.textContent = authenticated
    ? `Akun aktif: ${displayText}`
    : "Belum login. Daftar akun baru atau login akun yang sudah ada.";

  dom.logoutBtn.classList.toggle("hidden", !authenticated);
  dom.toConfirmBtn.disabled = !authenticated;
  dom.refreshCredentialsHistoryBtn.classList.toggle("hidden", !authenticated);
  dom.logoutFromCredentialsBtn.classList.toggle("hidden", !authenticated);
  dom.credentialsHistoryPanel.classList.toggle("hidden", !authenticated);

  if (!authenticated) {
    dom.credentialsHistoryStatus.textContent = "Login dulu untuk melihat riwayat hasil.";
    dom.credentialsHistoryList.innerHTML = "";
  }
}

function isAdminAuthenticated() {
  return Boolean(state.admin.token);
}

function hydrateAdminFromStorage() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") {
      state.admin.token = parsed.token;
    }
  } catch (_error) {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }
}

function persistAdminToStorage() {
  if (!isAdminAuthenticated()) {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify({
      token: state.admin.token,
    })
  );
}

function setAdminSession(token) {
  state.admin.token = String(token || "");
  persistAdminToStorage();
  updateAdminUI();
}

function clearAdminSession() {
  state.admin.token = "";
  persistAdminToStorage();
  stopAdminEventStream();
  updateAdminUI();
}

function updateAdminUI() {
  if (isAdminAuthenticated()) {
    dom.adminSessionText.textContent = "Admin aktif. Anda bisa memantau peserta realtime.";
  } else {
    dom.adminSessionText.textContent = "Belum login admin.";
  }
}

async function syncAdminSession() {
  if (!isAdminAuthenticated()) {
    return;
  }
  try {
    await adminApiRequest("/api/admin/exam/current");
  } catch (_error) {
    clearAdminSession();
  }
}

function handleOpenAdmin() {
  if (isAdminAuthenticated()) {
    showView("view-admin-dashboard");
    void loadAdminDashboardData();
    startAdminEventStream();
    return;
  }
  showView("view-admin-login");
}

async function handleAdminLoginSubmit(event) {
  event.preventDefault();
  const password = dom.adminPassword.value;
  if (!password) {
    showToast("Password admin wajib diisi.");
    return;
  }

  try {
    const payload = await apiRequest("/api/admin/login", {
      method: "POST",
      body: { password },
    });
    setAdminSession(payload.token);
    dom.adminLoginForm.reset();
    showView("view-admin-dashboard");
    showToast("Login admin berhasil.");
    await loadAdminDashboardData();
    startAdminEventStream();
  } catch (error) {
    showToast(error.message || "Gagal login admin.");
  }
}

function handleAdminLogout() {
  if (!isAdminAuthenticated()) {
    showView("view-setup");
    return;
  }
  clearAdminSession();
  showView("view-setup");
  showToast("Admin logout.");
}

async function adminApiRequest(url, options = {}) {
  if (!isAdminAuthenticated()) {
    throw new Error("Sesi admin tidak aktif.");
  }
  const headers = options.headers || {};
  headers.Authorization = `Bearer ${state.admin.token}`;
  try {
    return await apiRequest(url, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error && error.status === 401) {
      clearAdminSession();
      showToast("Sesi admin berakhir. Silakan login ulang.");
      showView("view-admin-login");
    }
    throw error;
  }
}

async function loadAdminDashboardData() {
  if (!isAdminAuthenticated()) {
    return;
  }
  await Promise.all([loadAdminCurrentExam(), loadAdminMonitor(), loadAdminResults()]);
}

async function loadAdminCurrentExam() {
  try {
    const payload = await adminApiRequest("/api/admin/exam/current");
    const exam = payload.exam || null;
    if (!exam) {
      dom.adminExamTokenInput.value = "";
      setAdminDraftQuestions([]);
      dom.adminExamStateText.textContent = "Belum ada draft ujian resmi.";
      return;
    }

    dom.adminSubjectSelect.value = exam.subject || "Matematika";
    dom.adminDurationInput.value = String(Number(exam.durationMinutes || 60));
    dom.adminQuestionCountInput.value = String(Number(exam.totalQuestions || 20));
    dom.adminExamTokenInput.value = exam.token || "";
    setAdminDraftQuestions(exam.questions || []);

    const status = exam.status || "draft";
    const startedAt = exam.startedAt ? formatHistoryTime(exam.startedAt) : "-";
    dom.adminExamStateText.textContent = `Status: ${status} | Mulai: ${startedAt} | Session: ${exam.sessionId || "-"}`;
  } catch (error) {
    dom.adminExamStateText.textContent = error.message || "Gagal memuat status ujian resmi.";
  }
}

function createAdminDraftQuestion(overrides = {}) {
  const options = Array.isArray(overrides.options) ? overrides.options.slice(0, 8) : [];
  const normalizedOptions = options.map((item) => String(item || ""));
  while (normalizedOptions.length < 4) {
    normalizedOptions.push("");
  }

  const initialAnswerIndexes = normalizeAnswerIndexesInput(overrides, normalizedOptions.length);
  const questionType = normalizeQuestionType(overrides.questionType, initialAnswerIndexes);
  const answerIndexes =
    questionType === "multiple"
      ? initialAnswerIndexes.filter((idx) => idx >= 0 && idx < normalizedOptions.length)
      : initialAnswerIndexes.length > 0
      ? [initialAnswerIndexes[0]]
      : [];

  return {
    localId: String(overrides.localId || `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    question: String(overrides.question || ""),
    questionType,
    options: normalizedOptions,
    answerIndexes,
    explanation: String(overrides.explanation || ""),
    imageUrl: String(overrides.imageUrl || ""),
  };
}

function normalizeAdminDraftQuestion(rawQuestion) {
  if (!rawQuestion || typeof rawQuestion.question !== "string") {
    return null;
  }
  return createAdminDraftQuestion({
    question: rawQuestion.question.trim(),
    questionType: rawQuestion.questionType,
    options: Array.isArray(rawQuestion.options) ? rawQuestion.options : [],
    answerIndexes: rawQuestion.answerIndexes,
    answerIndex: rawQuestion.answerIndex,
    answer: rawQuestion.answer,
    explanation: rawQuestion.explanation,
    imageUrl: rawQuestion.imageUrl,
  });
}

function setAdminDraftQuestions(rawQuestions) {
  const list = Array.isArray(rawQuestions)
    ? rawQuestions.map((item) => normalizeAdminDraftQuestion(item)).filter((item) => Boolean(item))
    : [];
  state.admin.draftQuestions = list;
  renderAdminQuestionBuilder();
}

function renderAdminQuestionBuilderStatus() {
  const count = state.admin.draftQuestions.length;
  const target = Number(dom.adminQuestionCountInput.value) || 0;
  if (!count) {
    dom.adminQuestionBuilderStatus.textContent = target > 0 ? `Belum ada soal. Target: ${target} soal.` : "Belum ada soal.";
    return;
  }
  dom.adminQuestionBuilderStatus.textContent =
    target > 0
      ? `Total soal tersusun: ${count}/${target}.`
      : `Total soal tersusun: ${count}.`;
}

function renderAdminQuestionBuilder() {
  const container = dom.adminQuestionBuilderList;
  container.innerHTML = "";
  renderAdminQuestionBuilderStatus();

  if (!state.admin.draftQuestions.length) {
    const empty = document.createElement("div");
    empty.className = "admin-question-empty";
    empty.textContent = "Belum ada soal. Klik tombol \"Tambah Soal\" untuk membuat soal pertama.";
    container.append(empty);
    return;
  }

  state.admin.draftQuestions.forEach((question, questionIndex) => {
    const card = document.createElement("article");
    card.className = "admin-question-card";

    const head = document.createElement("div");
    head.className = "admin-question-head";

    const headInfo = document.createElement("div");
    const heading = document.createElement("h4");
    heading.textContent = `Soal ${questionIndex + 1}`;
    const headHint = document.createElement("p");
    headHint.className = "small muted";
    headHint.textContent =
      question.questionType === "multiple"
        ? "Tipe: PG kompleks (pilih 2 jawaban atau lebih)."
        : "Tipe: PG biasa (pilih 1 jawaban).";
    headInfo.append(heading, headHint);

    const headActions = document.createElement("div");
    headActions.className = "admin-question-actions";

    const duplicateBtn = document.createElement("button");
    duplicateBtn.type = "button";
    duplicateBtn.className = "btn btn-light btn-sm";
    duplicateBtn.textContent = "Duplikat";
    duplicateBtn.addEventListener("click", () => {
      duplicateAdminDraftQuestion(questionIndex);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-danger btn-sm";
    removeBtn.textContent = "Hapus";
    removeBtn.addEventListener("click", () => {
      removeAdminDraftQuestion(questionIndex);
    });

    headActions.append(duplicateBtn, removeBtn);
    head.append(headInfo, headActions);

    const questionField = document.createElement("label");
    questionField.className = "field";
    const questionLabel = document.createElement("span");
    questionLabel.textContent = "Pertanyaan";
    const questionInput = document.createElement("textarea");
    questionInput.rows = 3;
    questionInput.placeholder = "Tulis soal di sini...";
    questionInput.value = question.question;
    questionInput.addEventListener("input", (event) => {
      updateAdminQuestionField(questionIndex, "question", event.target.value);
    });
    questionField.append(questionLabel, questionInput);

    const typeField = document.createElement("label");
    typeField.className = "field";
    const typeLabel = document.createElement("span");
    typeLabel.textContent = "Tipe Soal";
    const typeSelect = document.createElement("select");
    const singleOption = document.createElement("option");
    singleOption.value = "single";
    singleOption.textContent = "PG biasa (1 jawaban benar)";
    const multipleOption = document.createElement("option");
    multipleOption.value = "multiple";
    multipleOption.textContent = "PG kompleks (2+ jawaban benar)";
    typeSelect.append(singleOption, multipleOption);
    typeSelect.value = question.questionType;
    typeSelect.addEventListener("change", (event) => {
      updateAdminQuestionType(questionIndex, event.target.value);
    });
    typeField.append(typeLabel, typeSelect);

    const imageField = document.createElement("label");
    imageField.className = "field";
    const imageLabel = document.createElement("span");
    imageLabel.textContent = "URL Foto (opsional)";
    const imageInput = document.createElement("input");
    imageInput.type = "text";
    imageInput.placeholder = "Contoh: https://... atau /uploads/questions/....png";
    imageInput.value = question.imageUrl;
    imageInput.addEventListener("input", (event) => {
      updateAdminQuestionField(questionIndex, "imageUrl", event.target.value);
    });
    imageField.append(imageLabel, imageInput);

    const uploadRow = document.createElement("div");
    uploadRow.className = "admin-upload-row";
    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = "image/*";
    uploadInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if (file) {
        void uploadAdminQuestionImage(questionIndex, file);
      }
      event.target.value = "";
    });
    const uploadHint = document.createElement("span");
    uploadHint.className = "small muted";
    uploadHint.textContent = "Upload JPG/PNG/WebP maksimal 2MB.";
    uploadRow.append(uploadInput, uploadHint);

    const imagePreviewWrap = document.createElement("div");
    if (sanitizeQuestionImageUrl(question.imageUrl)) {
      const imagePreview = document.createElement("img");
      imagePreview.className = "admin-question-image-preview";
      imagePreview.src = sanitizeQuestionImageUrl(question.imageUrl);
      imagePreview.alt = `Gambar soal ${questionIndex + 1}`;
      imagePreviewWrap.append(imagePreview);

      const clearImageBtn = document.createElement("button");
      clearImageBtn.type = "button";
      clearImageBtn.className = "btn btn-light btn-sm";
      clearImageBtn.textContent = "Hapus Foto";
      clearImageBtn.addEventListener("click", () => {
        updateAdminQuestionField(questionIndex, "imageUrl", "", true);
      });
      imagePreviewWrap.append(clearImageBtn);
    }

    const optionsField = document.createElement("div");
    optionsField.className = "field";
    const optionsLabel = document.createElement("span");
    optionsLabel.textContent = "Pilihan Jawaban";
    const optionsList = document.createElement("div");
    optionsList.className = "admin-question-options";

    question.options.forEach((optionText, optionIndex) => {
      const row = document.createElement("div");
      row.className = "admin-option-row";

      const letter = document.createElement("strong");
      letter.textContent = `${toOptionLetter(optionIndex)}.`;

      const optionInput = document.createElement("input");
      optionInput.type = "text";
      optionInput.placeholder = `Pilihan ${toOptionLetter(optionIndex)}`;
      optionInput.value = optionText;
      optionInput.addEventListener("input", (event) => {
        updateAdminOptionText(questionIndex, optionIndex, event.target.value);
      });

      const keyInput = document.createElement("input");
      keyInput.type = question.questionType === "multiple" ? "checkbox" : "radio";
      keyInput.name = `admin-answer-${question.localId}`;
      keyInput.checked = question.answerIndexes.includes(optionIndex);
      keyInput.title = "Tandai sebagai jawaban benar";
      keyInput.addEventListener("change", (event) => {
        toggleAdminAnswer(questionIndex, optionIndex, event.target.checked);
      });

      const removeOptionBtn = document.createElement("button");
      removeOptionBtn.type = "button";
      removeOptionBtn.className = "btn btn-light btn-sm";
      removeOptionBtn.textContent = "Hapus";
      removeOptionBtn.disabled = question.options.length <= 4;
      removeOptionBtn.addEventListener("click", () => {
        removeAdminOption(questionIndex, optionIndex);
      });

      row.append(letter, optionInput, keyInput, removeOptionBtn);
      optionsList.append(row);
    });

    const addOptionBtn = document.createElement("button");
    addOptionBtn.type = "button";
    addOptionBtn.className = "btn btn-light btn-sm";
    addOptionBtn.textContent = "Tambah Opsi";
    addOptionBtn.addEventListener("click", () => {
      addAdminOption(questionIndex);
    });

    optionsField.append(optionsLabel, optionsList, addOptionBtn);

    const explanationField = document.createElement("label");
    explanationField.className = "field";
    const explanationLabel = document.createElement("span");
    explanationLabel.textContent = "Pembahasan Singkat (opsional)";
    const explanationInput = document.createElement("textarea");
    explanationInput.rows = 2;
    explanationInput.placeholder = "Contoh: Karena ...";
    explanationInput.value = question.explanation;
    explanationInput.addEventListener("input", (event) => {
      updateAdminQuestionField(questionIndex, "explanation", event.target.value);
    });
    explanationField.append(explanationLabel, explanationInput);

    card.append(head, questionField, typeField, imageField, uploadRow, imagePreviewWrap, optionsField, explanationField);
    container.append(card);
  });
}

function addAdminDraftQuestion() {
  state.admin.draftQuestions.push(createAdminDraftQuestion());
  renderAdminQuestionBuilder();
}

function duplicateAdminDraftQuestion(questionIndex) {
  const source = state.admin.draftQuestions[questionIndex];
  if (!source) {
    return;
  }
  const clone = createAdminDraftQuestion({
    question: source.question,
    questionType: source.questionType,
    options: source.options,
    answerIndexes: source.answerIndexes,
    explanation: source.explanation,
    imageUrl: source.imageUrl,
  });
  state.admin.draftQuestions.splice(questionIndex + 1, 0, clone);
  renderAdminQuestionBuilder();
}

function removeAdminDraftQuestion(questionIndex) {
  state.admin.draftQuestions.splice(questionIndex, 1);
  renderAdminQuestionBuilder();
}

function updateAdminQuestionField(questionIndex, field, value, rerender = false) {
  const question = state.admin.draftQuestions[questionIndex];
  if (!question) {
    return;
  }
  question[field] = String(value || "");
  if (rerender) {
    renderAdminQuestionBuilder();
  } else {
    renderAdminQuestionBuilderStatus();
  }
}

function updateAdminQuestionType(questionIndex, nextType) {
  const question = state.admin.draftQuestions[questionIndex];
  if (!question) {
    return;
  }
  question.questionType = normalizeQuestionType(nextType, question.answerIndexes);
  if (question.questionType === "single") {
    question.answerIndexes = question.answerIndexes.length > 0 ? [question.answerIndexes[0]] : [];
  }
  renderAdminQuestionBuilder();
}

function updateAdminOptionText(questionIndex, optionIndex, value) {
  const question = state.admin.draftQuestions[questionIndex];
  if (!question || optionIndex < 0 || optionIndex >= question.options.length) {
    return;
  }
  question.options[optionIndex] = String(value || "");
}

function toggleAdminAnswer(questionIndex, optionIndex, checked) {
  const question = state.admin.draftQuestions[questionIndex];
  if (!question) {
    return;
  }
  if (question.questionType === "multiple") {
    const answerSet = new Set(question.answerIndexes);
    if (checked) {
      answerSet.add(optionIndex);
    } else {
      answerSet.delete(optionIndex);
    }
    question.answerIndexes = [...answerSet].sort((a, b) => a - b);
  } else {
    question.answerIndexes = checked ? [optionIndex] : [];
  }
  renderAdminQuestionBuilder();
}

function addAdminOption(questionIndex) {
  const question = state.admin.draftQuestions[questionIndex];
  if (!question) {
    return;
  }
  if (question.options.length >= 8) {
    showToast("Maksimal 8 opsi per soal.");
    return;
  }
  question.options.push("");
  renderAdminQuestionBuilder();
}

function removeAdminOption(questionIndex, optionIndex) {
  const question = state.admin.draftQuestions[questionIndex];
  if (!question) {
    return;
  }
  if (question.options.length <= 4) {
    showToast("Minimal 4 opsi per soal.");
    return;
  }
  question.options.splice(optionIndex, 1);
  question.answerIndexes = question.answerIndexes
    .filter((idx) => idx !== optionIndex)
    .map((idx) => (idx > optionIndex ? idx - 1 : idx));
  if (question.questionType === "single" && question.answerIndexes.length > 1) {
    question.answerIndexes = [question.answerIndexes[0]];
  }
  renderAdminQuestionBuilder();
}

async function uploadAdminQuestionImage(questionIndex, file) {
  if (!file) {
    return;
  }
  if (!String(file.type || "").startsWith("image/")) {
    showToast("File harus berupa gambar.");
    return;
  }
  if (Number(file.size || 0) > 2 * 1024 * 1024) {
    showToast("Ukuran gambar maksimal 2MB.");
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const payload = await adminApiRequest("/api/admin/question-image", {
      method: "POST",
      body: {
        dataUrl,
        fileName: file.name,
      },
    });
    const imageUrl = sanitizeQuestionImageUrl(payload && payload.url ? payload.url : "");
    if (!imageUrl) {
      throw new Error("URL gambar hasil upload tidak valid.");
    }
    updateAdminQuestionField(questionIndex, "imageUrl", imageUrl, true);
    showToast("Foto soal berhasil diupload.");
  } catch (error) {
    showToast(error.message || "Gagal upload foto soal.");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result || ""));
    };
    reader.onerror = () => {
      reject(new Error("Gagal membaca file gambar."));
    };
    reader.readAsDataURL(file);
  });
}

function collectAdminDraftQuestions() {
  if (!state.admin.draftQuestions.length) {
    throw new Error("Belum ada soal. Tambahkan soal terlebih dahulu.");
  }

  const output = state.admin.draftQuestions.map((draft, index) => {
    const questionText = String(draft.question || "").trim();
    if (!questionText) {
      throw new Error(`Teks soal nomor ${index + 1} belum diisi.`);
    }

    const options = Array.isArray(draft.options) ? draft.options.map((item) => String(item || "").trim()) : [];
    if (options.length < 4) {
      throw new Error(`Soal nomor ${index + 1} minimal punya 4 opsi.`);
    }
    if (options.some((option) => option.length === 0)) {
      throw new Error(`Semua opsi pada soal nomor ${index + 1} wajib diisi.`);
    }

    const questionType = normalizeQuestionType(draft.questionType, draft.answerIndexes);
    const answerIndexes = [...new Set((Array.isArray(draft.answerIndexes) ? draft.answerIndexes : []).map((item) => Number(item)))]
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length)
      .sort((a, b) => a - b);

    if (questionType === "multiple" && answerIndexes.length < 2) {
      throw new Error(`Soal nomor ${index + 1} bertipe PG kompleks, jadi jawaban benar minimal 2 opsi.`);
    }
    if (questionType === "single" && answerIndexes.length !== 1) {
      throw new Error(`Soal nomor ${index + 1} bertipe PG biasa, jadi jawaban benar harus tepat 1 opsi.`);
    }

    const explanationText =
      typeof draft.explanation === "string" && draft.explanation.trim().length > 0
        ? draft.explanation.trim()
        : "Pembahasan singkat tidak tersedia.";

    const imageUrl = sanitizeQuestionImageUrl(draft.imageUrl);

    return {
      question: questionText,
      questionType,
      options,
      answerIndexes,
      answerIndex: answerIndexes[0],
      imageUrl,
      explanation: explanationText,
    };
  });

  const requiredCount = Number(dom.adminQuestionCountInput.value) || 0;
  if (requiredCount > 0 && output.length < requiredCount) {
    throw new Error(`Jumlah soal masih ${output.length}. Target minimal ${requiredCount} soal.`);
  }

  return output;
}

async function handleAdminGenerateQuestions() {
  if (!isAdminAuthenticated()) {
    showToast("Login admin terlebih dahulu.");
    return;
  }

  try {
    const payload = await adminApiRequest("/api/admin/exam/generate", {
      method: "POST",
      body: {
        subject: dom.adminSubjectSelect.value,
        totalQuestions: Number(dom.adminQuestionCountInput.value),
      },
    });
    setAdminDraftQuestions(payload.questions || []);
    showToast("Soal AI berhasil dibuat untuk draft admin.");
  } catch (error) {
    showToast(error.message || "Gagal generate soal.");
  }
}

async function handleAdminSaveDraftSubmit(event) {
  event.preventDefault();
  if (!isAdminAuthenticated()) {
    showToast("Login admin terlebih dahulu.");
    return;
  }

  let questions;
  try {
    questions = collectAdminDraftQuestions();
  } catch (error) {
    showToast(error.message);
    return;
  }

  try {
    await adminApiRequest("/api/admin/exam/draft", {
      method: "POST",
      body: {
        subject: dom.adminSubjectSelect.value,
        durationMinutes: Number(dom.adminDurationInput.value),
        totalQuestions: Number(dom.adminQuestionCountInput.value),
        token: dom.adminExamTokenInput.value.trim(),
        questions,
      },
    });
    showToast("Draft ujian resmi berhasil disimpan.");
    await loadAdminCurrentExam();
  } catch (error) {
    showToast(error.message || "Gagal menyimpan draft.");
  }
}

async function handleAdminStartExam() {
  if (!isAdminAuthenticated()) {
    showToast("Login admin terlebih dahulu.");
    return;
  }
  const confirmed = window.confirm("Mulai ujian resmi sekarang untuk semua peserta?");
  if (!confirmed) {
    return;
  }

  try {
    await adminApiRequest("/api/admin/exam/start", {
      method: "POST",
    });
    showToast("Ujian resmi dimulai serentak.");
    await loadAdminCurrentExam();
    await loadAdminMonitor();
  } catch (error) {
    showToast(error.message || "Gagal memulai ujian.");
  }
}

async function handleAdminStopExam() {
  if (!isAdminAuthenticated()) {
    showToast("Login admin terlebih dahulu.");
    return;
  }
  const confirmed = window.confirm("Akhiri ujian resmi sekarang?");
  if (!confirmed) {
    return;
  }

  try {
    await adminApiRequest("/api/admin/exam/stop", {
      method: "POST",
    });
    showToast("Ujian resmi diakhiri.");
    await loadAdminCurrentExam();
    await loadAdminMonitor();
  } catch (error) {
    showToast(error.message || "Gagal mengakhiri ujian.");
  }
}

async function loadAdminMonitor() {
  if (!isAdminAuthenticated()) {
    return;
  }

  dom.adminMonitorStatus.textContent = "Memuat monitor realtime...";
  try {
    const payload = await adminApiRequest("/api/admin/monitor");
    const exam = payload.exam || null;
    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    dom.adminMonitorList.innerHTML = "";

    if (!exam) {
      dom.adminMonitorStatus.textContent = "Belum ada ujian resmi.";
      return;
    }

    dom.adminMonitorStatus.textContent = `Ujian ${exam.status} | Session ${exam.sessionId || "-"} | Peserta aktif ${sessions.length}`;
    if (!sessions.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Belum ada peserta masuk pada sesi ujian ini.";
      dom.adminMonitorList.append(empty);
      return;
    }

    sessions.forEach((session, index) => {
      const card = document.createElement("article");
      card.className = "history-item";

      const title = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${index + 1}. ${session.username} (${session.participantName || "-"})`;
      title.append(strong);

      const info = document.createElement("p");
      info.className = "small";
      info.textContent = `Status: ${session.status} | Soal: ${session.currentQuestion}/${session.totalQuestions} | Sisa: ${formatTime(
        Number(session.remainingSeconds || 0)
      )}`;

      const meta = document.createElement("div");
      meta.className = "history-meta";
      const violations = document.createElement("span");
      violations.textContent = `Pelanggaran: ${Number(session.violations || 0)}`;
      const penalty = document.createElement("span");
      penalty.textContent = `Penalti: -${Number(session.penaltyPoints || 0)}`;
      const updated = document.createElement("span");
      updated.textContent = `Update: ${formatHistoryTime(session.updatedAt)}`;
      meta.append(violations, penalty, updated);

      card.append(title, info, meta);
      dom.adminMonitorList.append(card);
    });
  } catch (error) {
    dom.adminMonitorStatus.textContent = error.message || "Gagal memuat monitor.";
    dom.adminMonitorList.innerHTML = "";
  }
}

async function loadAdminResults() {
  if (!isAdminAuthenticated()) {
    return;
  }

  dom.adminResultsStatus.textContent = "Memuat seluruh hasil peserta...";
  try {
    const payload = await adminApiRequest("/api/admin/results?limit=200");
    const results = Array.isArray(payload.results) ? payload.results : [];
    dom.adminResultsList.innerHTML = "";

    if (!results.length) {
      dom.adminResultsStatus.textContent = "Belum ada hasil ujian tersimpan.";
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Data hasil peserta masih kosong.";
      dom.adminResultsList.append(empty);
      return;
    }

    dom.adminResultsStatus.textContent = `Menampilkan ${results.length} hasil terbaru seluruh peserta.`;
    results.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "history-item";

      const title = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${index + 1}. ${item.username} | ${item.subject}`;
      title.append(strong);

      const info = document.createElement("p");
      info.className = "small";
      info.textContent = `Nilai: ${Number(item.metrics?.finalScore || 0)} | Benar: ${Number(
        item.metrics?.correctCount || 0
      )}/${Number(item.totalQuestions || 0)} | Pelanggaran: ${Number(item.security?.violations || 0)}`;

      const meta = document.createElement("div");
      meta.className = "history-meta";
      const status = document.createElement("span");
      status.textContent = item.finishReason || "-";
      const created = document.createElement("span");
      created.textContent = formatHistoryTime(item.createdAt || item.completedAtClient);
      meta.append(status, created);

      card.append(title, info, meta);
      dom.adminResultsList.append(card);
    });
  } catch (error) {
    dom.adminResultsStatus.textContent = error.message || "Gagal memuat hasil peserta.";
    dom.adminResultsList.innerHTML = "";
  }
}

function startAdminEventStream() {
  if (!isAdminAuthenticated() || state.admin.eventSource) {
    return;
  }

  const streamUrl = `/api/admin/monitor-stream?token=${encodeURIComponent(state.admin.token)}`;
  const eventSource = new EventSource(streamUrl);
  state.admin.eventSource = eventSource;

  eventSource.addEventListener("monitor-refresh", () => {
    void loadAdminMonitor();
  });
  eventSource.addEventListener("result-refresh", () => {
    void loadAdminResults();
  });
  eventSource.addEventListener("exam-refresh", () => {
    void loadAdminCurrentExam();
    void loadAdminMonitor();
  });
  eventSource.addEventListener("error", () => {
    stopAdminEventStream();
  });
}

function stopAdminEventStream() {
  if (!state.admin.eventSource) {
    return;
  }
  state.admin.eventSource.close();
  state.admin.eventSource = null;
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const username = dom.registerUsername.value.trim();
  const password = dom.registerPassword.value;
  const displayName = dom.registerDisplayName.value.trim();

  try {
    const payload = await apiRequest("/api/auth/register", {
      method: "POST",
      body: { username, password, displayName },
    });
    setAuthSession(payload.token, payload.user);
    dom.loginUsername.value = payload.user.username || username;
    dom.loginPassword.value = "";
    showToast("Akun berhasil dibuat. Anda sudah login.");
    await loadAndRenderHistory("credentials");
  } catch (error) {
    showToast(error.message || "Gagal membuat akun.");
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = dom.loginUsername.value.trim();
  const password = dom.loginPassword.value;

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setAuthSession(payload.token, payload.user);
    showToast("Login berhasil.");
    await loadAndRenderHistory("credentials");
  } catch (error) {
    showToast(error.message || "Gagal login.");
  }
}

function handleLogout() {
  if (!isAuthenticated()) {
    return;
  }
  const confirmed = window.confirm("Keluar dari akun peserta saat ini?");
  if (!confirmed) {
    return;
  }
  clearAuthSession();
  resetToSetup({ keepToast: true });
  showToast("Akun berhasil logout.");
}

function handleToConfirm() {
  if (!isAuthenticated()) {
    showToast("Login akun peserta terlebih dahulu.");
    return;
  }
  prepareConfirmationView();
  showView("view-confirm");
}

function prepareConfirmationView() {
  if (!isAuthenticated()) {
    return;
  }
  const user = state.auth.user;
  state.token = "";
  dom.confirmNik.value = user.username || "";
  dom.confirmDisplayName.value = user.displayName || user.username || "";
  dom.confirmExamSubject.value = state.setup.subject;
  dom.confirmFullName.value = user.displayName || "";
  dom.confirmGender.value = "Laki-Laki";
  dom.confirmToken.value = "";
  dom.tokenDisplay.textContent = "-";
}

async function handleConfirmSubmit(event) {
  event.preventDefault();
  if (!isAuthenticated()) {
    showToast("Sesi login tidak ditemukan. Silakan login kembali.");
    showView("view-credentials");
    return;
  }

  const tokenInput = dom.confirmToken.value.trim().toUpperCase();
  if (!tokenInput) {
    showToast("Token wajib diisi.");
    return;
  }

  if (!dom.birthDay.value || !dom.birthMonth.value || !dom.birthYear.value) {
    showToast("Tanggal lahir belum lengkap.");
    return;
  }

  const user = state.auth.user;
  state.participant = {
    nik: user.username,
    displayName: dom.confirmDisplayName.value.trim() || user.displayName || user.username,
    fullName: dom.confirmFullName.value.trim(),
    gender: dom.confirmGender.value,
    birthDate: `${dom.birthYear.value}-${dom.birthMonth.value}-${dom.birthDay.value}`,
  };

  try {
    const officialSession = await requestOfficialExamSession(tokenInput);
    await prepareExamSession(officialSession);
  } catch (error) {
    showToast(error.message || "Gagal memulai ujian resmi.");
  }
}

async function requestOfficialExamSession(tokenInput) {
  return apiRequest("/api/exam/enter", {
    method: "POST",
    auth: true,
    body: {
      token: tokenInput,
      participant: state.participant,
    },
  });
}

async function prepareExamSession(officialSession = null) {
  showView("view-loading");
  dom.loadingText.textContent = "Memuat soal ujian resmi dari server...";

  let questions;
  if (officialSession) {
    state.setup.subject = officialSession.subject || state.setup.subject;
    state.setup.duration = Number(officialSession.durationMinutes) || state.setup.duration;
    state.setup.totalQuestions = Number(officialSession.totalQuestions) || state.setup.totalQuestions;
    state.officialSessionId = String(officialSession.sessionId || "");
    state.questionSource = officialSession.source || "official-admin";
    questions = sanitizeQuestions(officialSession.questions, state.setup.totalQuestions);
  } else {
    state.officialSessionId = "";
    try {
      questions = await requestQuestionsFromServer();
    } catch (error) {
      console.error(error);
      state.questionSource = "fallback-client";
      questions = sanitizeQuestions(
        buildClientFallbackQuestions(state.setup.subject, state.setup.totalQuestions),
        state.setup.totalQuestions
      );
      showToast("Gagal memuat soal dari server. Beralih ke soal fallback lokal.");
    }
  }

  state.questions = questions;
  state.answers = state.questions.map((question) => (isMultipleChoiceQuestion(question) ? [] : null));
  state.flags = new Array(state.questions.length).fill(false);
  state.currentQuestion = 0;
  state.remainingSeconds = Number(officialSession?.remainingSeconds || state.setup.duration * 60);
  state.finished = false;
  state.finishReason = "";
  state.security = {
    violations: 0,
    penaltyCount: 0,
    penaltyPoints: 0,
    lockUntil: 0,
    lastEventAt: 0,
  };
  if (!Number.isFinite(state.remainingSeconds) || state.remainingSeconds <= 0) {
    state.remainingSeconds = state.setup.duration * 60;
  }

  dom.securityEventBanner.classList.add("hidden");
  dom.securityEventBanner.textContent = "";
  dom.resultSaveStatus.textContent = "";
  dom.resultHistoryStatus.textContent = "Belum ada data.";
  dom.resultHistoryList.innerHTML = "";

  showView("view-exam");
  startTimer();
  startProgressSync();
  void syncExamProgress(false);
  renderExam();
  showToast(`Soal siap dikerjakan (sumber: ${state.questionSource}).`);
}

function startProgressSync() {
  stopProgressSync();
  state.progressSyncId = setInterval(() => {
    void syncExamProgress(false);
  }, 5000);
}

function stopProgressSync() {
  clearInterval(state.progressSyncId);
  state.progressSyncId = null;
}

async function syncExamProgress(finished, metrics = null) {
  if (!isAuthenticated() || !state.officialSessionId) {
    return;
  }
  try {
    await apiRequest("/api/exam/progress", {
      method: "POST",
      auth: true,
      body: {
        sessionId: state.officialSessionId,
        subject: state.setup.subject,
        currentQuestion: state.currentQuestion + 1,
        totalQuestions: state.questions.length,
        remainingSeconds: state.remainingSeconds,
        violations: state.security.violations,
        penaltyCount: state.security.penaltyCount,
        penaltyPoints: state.security.penaltyPoints,
        finished: Boolean(finished),
        finalScore: metrics ? Number(metrics.finalScore || 0) : null,
      },
    });
  } catch (_error) {
    // Silent failure to avoid interrupting exam flow.
  }
}

async function apiRequest(url, options = {}) {
  const { method = "GET", body, auth = false, headers: extraHeaders = {} } = options;
  const headers = { ...extraHeaders };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && state.auth.token) {
    headers.Authorization = `Bearer ${state.auth.token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = String(response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    let message = payload && payload.message ? payload.message : `Request gagal (${response.status})`;
    if (response.status === 405) {
      message = "API tidak berjalan di host ini. Jalankan `npm start` lalu buka http://localhost:3000";
    }
    if (response.status === 401 && auth) {
      clearAuthSession();
    }
    const requestError = new Error(message);
    requestError.status = response.status;
    throw requestError;
  }

  return payload;
}

async function loadAndRenderHistory(target) {
  if (!isAuthenticated()) {
    return;
  }

  const statusEl = target === "credentials" ? dom.credentialsHistoryStatus : dom.resultHistoryStatus;
  statusEl.textContent = "Memuat riwayat...";

  try {
    const payload = await apiRequest(`/api/results?limit=${HISTORY_LIMIT}`, { auth: true });
    const items = Array.isArray(payload && payload.results) ? payload.results : [];
    renderHistoryList(target, items);
  } catch (error) {
    statusEl.textContent = error.message || "Gagal memuat riwayat.";
    if (target === "credentials") {
      dom.credentialsHistoryList.innerHTML = "";
    } else {
      dom.resultHistoryList.innerHTML = "";
    }
  }
}

function renderHistoryList(target, items) {
  const isCredentials = target === "credentials";
  const container = isCredentials ? dom.credentialsHistoryList : dom.resultHistoryList;
  const statusEl = isCredentials ? dom.credentialsHistoryStatus : dom.resultHistoryStatus;

  container.innerHTML = "";

  if (!items.length) {
    statusEl.textContent = "Belum ada riwayat hasil.";
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Belum ada data hasil untuk akun ini.";
    container.append(empty);
    return;
  }

  statusEl.textContent = `Menampilkan ${items.length} hasil terbaru.`;
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "history-item";

    const title = document.createElement("p");
    const titleStrong = document.createElement("strong");
    titleStrong.textContent = `${index + 1}. ${item.subject || "-"}`;
    title.append(titleStrong);

    const score = document.createElement("p");
    score.className = "small";
    score.textContent = `Nilai akhir: ${Number(item.metrics?.finalScore || 0)} | Benar: ${Number(
      item.metrics?.correctCount || 0
    )}/${Number(item.totalQuestions || 0)}`;

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const source = document.createElement("span");
    source.textContent = `Sumber: ${item.questionSource || "-"}`;
    const duration = document.createElement("span");
    duration.textContent = `Durasi: ${Number(item.durationMinutes || 0)} menit`;
    const time = document.createElement("span");
    time.textContent = formatHistoryTime(item.createdAt || item.completedAtClient);

    meta.append(source, duration, time);
    card.append(title, score, meta);
    container.append(card);
  });
}

function formatHistoryTime(value) {
  if (!value) {
    return "Waktu tidak tersedia";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak valid";
  }
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function requestQuestionsFromServer() {
  const response = await fetch("/api/generate-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: state.setup.subject,
      totalQuestions: state.setup.totalQuestions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server error ${response.status}`);
  }

  const payload = await response.json();
  state.questionSource = payload.source || "gemini";
  return sanitizeQuestions(payload.questions, state.setup.totalQuestions);
}

function sanitizeQuestions(inputQuestions, neededCount) {
  const cleaned = [];
  const list = Array.isArray(inputQuestions) ? inputQuestions : [];

  list.forEach((item) => {
    const sanitized = sanitizeQuestionItem(item);
    if (sanitized) {
      cleaned.push(sanitized);
    }
  });

  if (cleaned.length < neededCount) {
    const fallbackExtra = buildClientFallbackQuestions(state.setup.subject, neededCount - cleaned.length);
    fallbackExtra.forEach((item) => {
      const sanitized = sanitizeQuestionItem(item);
      if (sanitized) {
        cleaned.push(sanitized);
      }
    });
  }

  return cleaned.slice(0, neededCount).map((item, index) => ({
    id: index + 1,
    question: item.question,
    options: item.options,
    questionType: item.questionType,
    answerIndexes: item.answerIndexes,
    answerIndex: item.answerIndex,
    imageUrl: item.imageUrl,
    explanation: item.explanation,
  }));
}

function normalizeQuestionType(rawType, answerIndexes = []) {
  const text = String(rawType || "").trim().toLowerCase();
  if (text === "multiple" || text === "pg-kompleks" || text === "complex") {
    return "multiple";
  }
  if (text === "single" || text === "pg" || text === "biasa") {
    return "single";
  }
  return Array.isArray(answerIndexes) && answerIndexes.length > 1 ? "multiple" : "single";
}

function sanitizeQuestionImageUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/")) {
    return value;
  }
  return "";
}

function normalizeAnswerIndexesInput(item, optionCount) {
  const output = [];

  if (Array.isArray(item?.answerIndexes)) {
    item.answerIndexes.forEach((value) => {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) {
        output.push(parsed);
      }
    });
  }

  const answerIndex = Number(item?.answerIndex);
  if (Number.isInteger(answerIndex)) {
    output.push(answerIndex);
  }

  if (typeof item?.answer === "string") {
    const answerText = item.answer.trim();
    let tokens = [];
    if (/^[A-Za-z](\s+[A-Za-z])+$/.test(answerText)) {
      tokens = answerText.split(/\s+/);
    } else if (/[,;/|]/.test(answerText)) {
      tokens = answerText.split(/[,;/|]+/);
    } else {
      tokens = [answerText];
    }
    tokens = tokens.map((token) => token.trim()).filter((token) => token.length > 0);
    const options = Array.isArray(item.options)
      ? item.options.map((option) => String(option || "").trim())
      : [];

    tokens.forEach((token) => {
      const letter = token.toUpperCase();
      const letterIndex = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(letter);
      if (letterIndex >= 0) {
        output.push(letterIndex);
        return;
      }
      const optionIndex = options.findIndex((option) => option.toLowerCase() === token.toLowerCase());
      if (optionIndex >= 0) {
        output.push(optionIndex);
      }
    });
  }

  return [...new Set(output)]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < optionCount)
    .sort((a, b) => a - b);
}

function sanitizeQuestionItem(item) {
  if (!item || typeof item.question !== "string") {
    return null;
  }

  const options = Array.isArray(item.options)
    ? item.options
        .map((option) => String(option).trim())
        .filter((option) => option.length > 0)
    : [];

  if (options.length < 4) {
    return null;
  }

  const limitedOptions = options.slice(0, 8);
  const answerIndexes = normalizeAnswerIndexesInput(item, limitedOptions.length);
  if (!answerIndexes.length) {
    return null;
  }

  const typeCandidate = normalizeQuestionType(item.questionType, answerIndexes);
  const questionType = typeCandidate === "multiple" && answerIndexes.length > 1 ? "multiple" : "single";
  const normalizedAnswers = questionType === "multiple" ? answerIndexes : [answerIndexes[0]];

  const explanationText =
    typeof item.explanation === "string" && item.explanation.trim().length > 0
      ? item.explanation.trim()
      : "Pembahasan singkat tidak tersedia.";

  return {
    question: item.question.trim(),
    options: limitedOptions,
    questionType,
    answerIndexes: normalizedAnswers,
    answerIndex: normalizedAnswers[0],
    imageUrl: sanitizeQuestionImageUrl(item.imageUrl),
    explanation: explanationText,
  };
}

function getCorrectAnswerIndexes(question) {
  const optionCount = Array.isArray(question?.options) ? question.options.length : 0;
  const indexes = normalizeAnswerIndexesInput(question, optionCount);
  if (indexes.length > 0) {
    return indexes;
  }
  return [];
}

function getSelectedAnswerIndexes(question, userAnswer) {
  const optionCount = Array.isArray(question?.options) ? question.options.length : 0;
  if (Array.isArray(userAnswer)) {
    return [...new Set(userAnswer.map((value) => Number(value)))]
      .filter((value) => Number.isInteger(value) && value >= 0 && value < optionCount)
      .sort((a, b) => a - b);
  }
  if (Number.isInteger(userAnswer) && userAnswer >= 0 && userAnswer < optionCount) {
    return [userAnswer];
  }
  return [];
}

function isMultipleChoiceQuestion(question) {
  const correctIndexes = getCorrectAnswerIndexes(question);
  return normalizeQuestionType(question?.questionType, correctIndexes) === "multiple" && correctIndexes.length > 1;
}

function isQuestionAnswered(question, userAnswer) {
  return getSelectedAnswerIndexes(question, userAnswer).length > 0;
}

function isQuestionCorrect(question, userAnswer) {
  const correctIndexes = getCorrectAnswerIndexes(question);
  const selectedIndexes = getSelectedAnswerIndexes(question, userAnswer);
  if (!correctIndexes.length) {
    return false;
  }
  if (correctIndexes.length !== selectedIndexes.length) {
    return false;
  }
  return correctIndexes.every((value, index) => value === selectedIndexes[index]);
}

function isOptionSelected(question, userAnswer, optionIndex) {
  return getSelectedAnswerIndexes(question, userAnswer).includes(optionIndex);
}

function formatAnswerIndexes(indexes) {
  if (!Array.isArray(indexes) || indexes.length === 0) {
    return "-";
  }
  return indexes.map((index) => toOptionLetter(index)).join(", ");
}

function showView(viewId) {
  state.currentView = viewId;
  if (viewId !== "view-admin-dashboard") {
    stopAdminEventStream();
  }
  dom.views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
}

function updateHeaderUser(text) {
  dom.headerUserBadge.textContent = text;
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (state.finished) {
      return;
    }

    if (state.remainingSeconds > 0) {
      state.remainingSeconds -= 1;
    }

    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      renderExam();
      void finishExam("Waktu habis. Ujian otomatis diselesaikan.");
      return;
    }

    renderExam();
  }, 1000);
}

function renderExam() {
  renderExamHeader();
  renderQuestion();
  renderQuestionGrid();
}

function renderExamHeader() {
  const questionNumber = state.currentQuestion + 1;
  dom.examQuestionHeading.textContent = `Soal nomor ${questionNumber}`;
  dom.examSubjectInfo.textContent = `${state.setup.subject} | Sumber soal: ${state.questionSource}`;
  dom.timerBadge.textContent = `Sisa Waktu: ${formatTime(state.remainingSeconds)}`;

  const usedWarnings = Math.min(state.security.violations, 2);
  dom.securityBadge.textContent = `Peringatan ${usedWarnings}/2 | Penalti ${state.security.penaltyCount} (-${state.security.penaltyPoints} poin)`;
  dom.questionProgressText.textContent = `Progress: ${questionNumber}/${state.questions.length}`;

  const lockSeconds = getLockRemainingSeconds();
  if (lockSeconds > 0 && !state.finished) {
    dom.lockBanner.textContent = `Sistem keamanan aktif. Pengerjaan dikunci ${formatTime(
      lockSeconds
    )} dan waktu ujian tetap berjalan.`;
    dom.lockBanner.classList.remove("hidden");
  } else {
    dom.lockBanner.classList.add("hidden");
    dom.lockBanner.textContent = "";
  }
}

function renderQuestion() {
  const question = state.questions[state.currentQuestion];
  if (!question) {
    return;
  }

  dom.questionText.textContent = question.question;
  dom.questionTypeHint.textContent = isMultipleChoiceQuestion(question)
    ? "PG kompleks: pilih 2 jawaban atau lebih."
    : "PG biasa: pilih 1 jawaban.";
  const safeImageUrl = sanitizeQuestionImageUrl(question.imageUrl);
  if (safeImageUrl) {
    dom.questionImage.src = safeImageUrl;
    dom.questionImageWrap.classList.remove("hidden");
  } else {
    dom.questionImage.removeAttribute("src");
    dom.questionImageWrap.classList.add("hidden");
  }
  dom.optionList.innerHTML = "";

  const selectedAnswer = state.answers[state.currentQuestion];
  const interactionLocked = isInteractionLocked();
  const isMultiple = isMultipleChoiceQuestion(question);
  const inputName = isMultiple ? `question-option-${state.currentQuestion}` : "question-option";

  question.options.forEach((optionText, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "option-item";

    const input = document.createElement("input");
    input.type = isMultiple ? "checkbox" : "radio";
    input.name = inputName;
    input.value = String(index);
    input.checked = isOptionSelected(question, selectedAnswer, index);
    input.disabled = interactionLocked;
    input.addEventListener("change", (event) => {
      saveAnswer(index, event.target.checked);
    });

    if (input.checked) {
      wrapper.classList.add("selected");
    }

    const letter = document.createElement("strong");
    letter.textContent = `${toOptionLetter(index)}.`;

    const text = document.createElement("span");
    text.textContent = optionText;

    wrapper.append(input, letter, text);
    dom.optionList.append(wrapper);
  });

  dom.prevQuestionBtn.disabled = state.currentQuestion === 0;
  dom.nextQuestionBtn.disabled = state.currentQuestion === state.questions.length - 1;
  dom.markDoubtCheckbox.checked = Boolean(state.flags[state.currentQuestion]);
  dom.markDoubtCheckbox.disabled = interactionLocked;
  dom.finishExamBtn.disabled = state.finished;
}

function saveAnswer(optionIndex, checked = true) {
  if (isInteractionLocked()) {
    showToast("Jawaban tidak bisa disimpan karena sesi sedang dikunci.");
    return;
  }
  const question = state.questions[state.currentQuestion];
  if (!question) {
    return;
  }
  if (isMultipleChoiceQuestion(question)) {
    const current = getSelectedAnswerIndexes(question, state.answers[state.currentQuestion]);
    const nextSet = new Set(current);
    if (checked) {
      nextSet.add(optionIndex);
    } else {
      nextSet.delete(optionIndex);
    }
    state.answers[state.currentQuestion] = [...nextSet].sort((a, b) => a - b);
  } else {
    state.answers[state.currentQuestion] = optionIndex;
  }
  renderExam();
  void syncExamProgress(false);
}

function handleFlagToggle(event) {
  if (isInteractionLocked()) {
    dom.markDoubtCheckbox.checked = Boolean(state.flags[state.currentQuestion]);
    showToast("Tidak bisa mengubah status ragu-ragu saat sesi terkunci.");
    return;
  }
  state.flags[state.currentQuestion] = event.target.checked;
  renderQuestionGrid();
  void syncExamProgress(false);
}

function moveQuestion(step) {
  const nextIndex = state.currentQuestion + step;
  if (nextIndex < 0 || nextIndex >= state.questions.length) {
    return;
  }
  state.currentQuestion = nextIndex;
  renderExam();
  void syncExamProgress(false);
}

function openQuestionListModal() {
  dom.questionListModal.classList.remove("hidden");
}

function closeQuestionListModal() {
  dom.questionListModal.classList.add("hidden");
}

function renderQuestionGrid() {
  dom.questionGrid.innerHTML = "";
  state.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-grid-btn";
    button.textContent = String(index + 1);

    if (index === state.currentQuestion) {
      button.classList.add("current");
    }
    if (isQuestionAnswered(question, state.answers[index])) {
      button.classList.add("answered");
    }
    if (state.flags[index]) {
      button.classList.add("flagged");
    }

    button.addEventListener("click", () => {
      state.currentQuestion = index;
      renderExam();
      closeQuestionListModal();
    });

    dom.questionGrid.append(button);
  });
}

function registerSecurityViolation(reason) {
  if (!isExamInProgress()) {
    return;
  }

  const now = Date.now();
  if (now - state.security.lastEventAt < 1800) {
    return;
  }
  state.security.lastEventAt = now;
  state.security.violations += 1;

  if (state.security.violations <= 2) {
    const remainingWarning = 2 - state.security.violations;
    setSecurityEventText(
      `Peringatan ${state.security.violations}/2: Anda terdeteksi keluar dari halaman ujian (${reason}). ${
        remainingWarning > 0
          ? `Sisa peringatan ${remainingWarning}.`
          : "Pelanggaran berikutnya akan dikunci 5 menit."
      }`
    );
  } else {
    state.security.penaltyCount += 1;
    state.security.penaltyPoints += 5;

    const lockUntil = now + 5 * 60 * 1000;
    state.security.lockUntil = Math.max(state.security.lockUntil, lockUntil);

    setSecurityEventText(
      `Pelanggaran keamanan terdeteksi. Ujian dikunci 5 menit dan skor dikurangi 5 poin (total penalti: ${state.security.penaltyPoints} poin).`
    );
  }

  renderExam();
  void syncExamProgress(false);
}

function setSecurityEventText(text) {
  dom.securityEventBanner.textContent = text;
  dom.securityEventBanner.classList.remove("hidden");
  showToast(text);
}

function isExamInProgress() {
  return state.currentView === "view-exam" && state.questions.length > 0 && !state.finished;
}

function getLockRemainingSeconds() {
  return Math.max(0, Math.ceil((state.security.lockUntil - Date.now()) / 1000));
}

function isInteractionLocked() {
  return state.finished || getLockRemainingSeconds() > 0 || state.remainingSeconds <= 0;
}

async function finishExam(reason) {
  if (state.finished) {
    return;
  }

  state.finished = true;
  state.finishReason = reason;
  clearInterval(state.timerId);
  stopProgressSync();
  closeQuestionListModal();
  const metrics = calculateResultMetrics();
  renderResult(metrics);
  showView("view-result");
  await syncExamProgress(true, metrics);
  await persistCurrentResult(metrics);
  await loadAndRenderHistory("result");
}

async function persistCurrentResult(metrics) {
  if (!isAuthenticated()) {
    dom.resultSaveStatus.textContent = "Hasil tidak tersimpan karena sesi login tidak aktif.";
    return;
  }

  dom.resultSaveStatus.textContent = "Menyimpan hasil ke server...";
  const payload = {
    sessionId: state.officialSessionId,
    subject: state.setup.subject,
    durationMinutes: state.setup.duration,
    totalQuestions: state.questions.length,
    questionSource: state.questionSource,
    finishReason: state.finishReason,
    completedAtClient: new Date().toISOString(),
    participant: state.participant,
    metrics,
    security: {
      violations: state.security.violations,
      penaltyCount: state.security.penaltyCount,
      penaltyPoints: state.security.penaltyPoints,
    },
  };

  try {
    await apiRequest("/api/results", {
      method: "POST",
      auth: true,
      body: payload,
    });
    dom.resultSaveStatus.textContent = "Hasil berhasil tersimpan.";
  } catch (error) {
    dom.resultSaveStatus.textContent = `Gagal menyimpan hasil: ${error.message || "unknown error"}`;
  }
}

function renderResult(metrics = calculateResultMetrics()) {
  dom.finishReason.textContent = `${state.finishReason} (Sumber soal: ${state.questionSource})`;
  dom.correctCountText.textContent = String(metrics.correctCount);
  dom.wrongCountText.textContent = String(metrics.wrongCount);
  dom.penaltyText.textContent = `-${metrics.penaltyPoints}`;
  dom.finalScoreText.textContent = String(metrics.finalScore);

  dom.reviewList.innerHTML = "";

  state.questions.forEach((question, index) => {
    const userAnswer = state.answers[index];
    const isCorrect = isQuestionCorrect(question, userAnswer);
    const selectedIndexes = getSelectedAnswerIndexes(question, userAnswer);
    const correctIndexes = getCorrectAnswerIndexes(question);
    const card = document.createElement("article");
    card.className = `review-item ${isCorrect ? "correct" : "wrong"}`;

    const title = document.createElement("h4");
    title.textContent = `Soal ${index + 1}`;

    const statement = document.createElement("p");
    statement.textContent = question.question;

    const safeImageUrl = sanitizeQuestionImageUrl(question.imageUrl);
    let imagePreview = null;
    if (safeImageUrl) {
      imagePreview = document.createElement("img");
      imagePreview.className = "review-question-image";
      imagePreview.src = safeImageUrl;
      imagePreview.alt = `Gambar soal ${index + 1}`;
    }

    const optionList = document.createElement("ul");
    question.options.forEach((option, optionIndex) => {
      const li = document.createElement("li");
      li.textContent = `${toOptionLetter(optionIndex)}. ${option}`;
      if (correctIndexes.includes(optionIndex)) {
        li.classList.add("correct-option");
      }
      if (selectedIndexes.includes(optionIndex) && !correctIndexes.includes(optionIndex)) {
        li.classList.add("user-wrong");
      }
      optionList.append(li);
    });

    const userInfo = document.createElement("p");
    userInfo.className = "small";
    userInfo.textContent =
      selectedIndexes.length === 0
        ? "Jawaban Anda: belum dijawab"
        : `Jawaban Anda: ${formatAnswerIndexes(selectedIndexes)}`;

    const keyInfo = document.createElement("p");
    keyInfo.className = "small";
    keyInfo.textContent = `Kunci: ${formatAnswerIndexes(correctIndexes)}`;

    const explanation = document.createElement("p");
    explanation.className = "small";
    explanation.textContent = `Pembahasan: ${question.explanation}`;

    if (imagePreview) {
      card.append(title, statement, imagePreview, optionList, userInfo, keyInfo, explanation);
    } else {
      card.append(title, statement, optionList, userInfo, keyInfo, explanation);
    }
    dom.reviewList.append(card);
  });
}

function calculateResultMetrics() {
  const totalQuestions = state.questions.length;
  let correctCount = 0;

  state.questions.forEach((question, index) => {
    if (isQuestionCorrect(question, state.answers[index])) {
      correctCount += 1;
    }
  });

  const wrongCount = totalQuestions - correctCount;
  const rawScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const penaltyPoints = state.security.penaltyPoints;
  const finalScore = Math.max(0, rawScore - penaltyPoints);

  return {
    totalQuestions,
    correctCount,
    wrongCount,
    rawScore,
    penaltyPoints,
    finalScore,
  };
}

function resetToSetup(options = {}) {
  const keepToast = Boolean(options.keepToast);
  clearInterval(state.timerId);
  stopProgressSync();
  closeQuestionListModal();

  state.currentView = "view-setup";
  state.setup = { ...DEFAULT_SETUP };
  state.participant = null;
  state.token = "";
  state.questions = [];
  state.answers = [];
  state.flags = [];
  state.currentQuestion = 0;
  state.remainingSeconds = 0;
  state.timerId = null;
  state.finished = false;
  state.finishReason = "";
  state.questionSource = "-";
  state.security = {
    violations: 0,
    penaltyCount: 0,
    penaltyPoints: 0,
    lockUntil: 0,
    lastEventAt: 0,
  };
  state.officialSessionId = "";

  dom.setupForm.reset();
  dom.subjectSelect.value = DEFAULT_SETUP.subject;
  dom.durationSelect.value = String(DEFAULT_SETUP.duration);
  dom.questionCountSelect.value = String(DEFAULT_SETUP.totalQuestions);
  dom.confirmForm.reset();
  dom.tokenDisplay.textContent = "-";
  dom.securityEventBanner.classList.add("hidden");
  dom.securityEventBanner.textContent = "";
  dom.resultSaveStatus.textContent = "";
  dom.resultHistoryStatus.textContent = "Belum ada data.";
  dom.resultHistoryList.innerHTML = "";
  updateAuthUI();
  showView("view-setup");
  if (!keepToast) {
    showToast("Sesi selesai. Silakan mulai simulasi baru.");
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toOptionLetter(index) {
  return String.fromCharCode(65 + index);
}

function generateToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i += 1) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function showToast(text) {
  dom.toast.textContent = text;
  dom.toast.classList.remove("hidden");
  clearTimeout(state.toastTimerId);
  state.toastTimerId = setTimeout(() => {
    dom.toast.classList.add("hidden");
  }, 4400);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function buildClientFallbackQuestions(subject, count) {
  if (subject === "Matematika") {
    return Array.from({ length: count }, (_, index) => buildMathFallbackQuestion(index + 1));
  }

  const pools = {
    IPA: [
      {
        question: "Organ yang bertugas memompa darah pada manusia adalah ...",
        options: ["Paru-paru", "Jantung", "Hati", "Ginjal", "Lambung"],
        answerIndex: 1,
        explanation: "Jantung berfungsi memompa darah ke seluruh tubuh.",
      },
      {
        question: "Perubahan wujud dari cair menjadi gas disebut ...",
        options: ["Membeku", "Menyublim", "Menguap", "Mengembun", "Melebur"],
        answerIndex: 2,
        explanation: "Cair ke gas adalah proses penguapan.",
      },
      {
        question: "Planet yang dikenal sebagai planet merah adalah ...",
        options: ["Venus", "Jupiter", "Mars", "Saturnus", "Merkurius"],
        answerIndex: 2,
        explanation: "Mars tampak merah karena permukaan kaya oksida besi.",
      },
      {
        question: "Gaya yang menarik benda ke pusat bumi disebut ...",
        options: ["Gaya gesek", "Gaya gravitasi", "Gaya magnet", "Gaya otot", "Gaya listrik"],
        answerIndex: 1,
        explanation: "Gravitasi membuat benda jatuh ke bawah.",
      },
      {
        question: "Satuan SI untuk massa adalah ...",
        options: ["Newton", "Liter", "Kilogram", "Joule", "Meter"],
        answerIndex: 2,
        explanation: "Satuan baku massa adalah kilogram (kg).",
      },
    ],
    "Bahasa Indonesia": [
      {
        question: "Kalimat utama biasanya terdapat pada ... paragraf.",
        options: ["Awal atau akhir", "Tengah", "Seluruh bagian", "Awal saja", "Akhir saja"],
        answerIndex: 0,
        explanation: "Kalimat utama umumnya ada di awal atau akhir paragraf.",
      },
      {
        question: "Lawan kata dari 'hemat' adalah ...",
        options: ["Bijak", "Boros", "Rajin", "Santun", "Cermat"],
        answerIndex: 1,
        explanation: "Antonim hemat adalah boros.",
      },
      {
        question: "Teks yang bertujuan menjelaskan proses terjadinya sesuatu disebut teks ...",
        options: ["Narasi", "Deskripsi", "Eksplanasi", "Prosedur", "Persuasi"],
        answerIndex: 2,
        explanation: "Teks eksplanasi menjelaskan fenomena dan prosesnya.",
      },
      {
        question: "Kata baku yang benar adalah ...",
        options: ["Resiko", "Aktifitas", "Kualitas", "Analisa", "Ijin"],
        answerIndex: 2,
        explanation: "Bentuk baku: kualitas. Yang lain tidak baku.",
      },
      {
        question: "Gagasan pendukung dalam paragraf disebut ...",
        options: ["Kalimat utama", "Kalimat penjelas", "Judul", "Kesimpulan", "Amanat"],
        answerIndex: 1,
        explanation: "Kalimat penjelas mendukung gagasan utama.",
      },
    ],
    "Bahasa Inggris": [
      {
        question: "Choose the correct sentence:",
        options: [
          "She go to school every day.",
          "She goes to school every day.",
          "She going to school every day.",
          "She gone to school every day.",
          "She is go to school every day.",
        ],
        answerIndex: 1,
        explanation: "Subject 'She' in simple present uses verb + s.",
      },
      {
        question: "The antonym of 'difficult' is ...",
        options: ["Hard", "Easy", "Complex", "Heavy", "Strong"],
        answerIndex: 1,
        explanation: "'Easy' is the opposite of 'difficult'.",
      },
      {
        question: "We ... football yesterday.",
        options: ["play", "plays", "played", "playing", "to play"],
        answerIndex: 2,
        explanation: "Past time marker 'yesterday' requires past form: played.",
      },
      {
        question: "What is the correct meaning of 'library'?",
        options: ["Laboratorium", "Perpustakaan", "Ruang makan", "Kantin", "Lapangan"],
        answerIndex: 1,
        explanation: "Library means perpustakaan.",
      },
      {
        question: "They are ... than us in running.",
        options: ["fast", "faster", "fastest", "more fast", "most fast"],
        answerIndex: 1,
        explanation: "Comparative form of fast is faster.",
      },
    ],
    IPS: [
      {
        question: "Kegiatan menyalurkan barang dari produsen ke konsumen disebut ...",
        options: ["Konsumsi", "Produksi", "Distribusi", "Investasi", "Transportasi"],
        answerIndex: 2,
        explanation: "Distribusi adalah proses penyaluran barang.",
      },
      {
        question: "Negara ASEAN yang terkenal dengan candi Angkor Wat adalah ...",
        options: ["Thailand", "Kamboja", "Vietnam", "Myanmar", "Laos"],
        answerIndex: 1,
        explanation: "Angkor Wat berada di Kamboja.",
      },
      {
        question: "Skala pada peta digunakan untuk menunjukkan ...",
        options: [
          "Arah mata angin",
          "Jarak sebenarnya dengan jarak pada peta",
          "Luas wilayah",
          "Bentuk wilayah",
          "Jenis tanah",
        ],
        answerIndex: 1,
        explanation: "Skala membandingkan jarak peta dan jarak sebenarnya.",
      },
      {
        question: "Interaksi sosial yang mengarah pada kerja sama disebut proses ...",
        options: ["Disosiatif", "Asosiatif", "Persaingan", "Konflik", "Kontravensi"],
        answerIndex: 1,
        explanation: "Asosiatif mencakup kerja sama dan akomodasi.",
      },
      {
        question: "Contoh sumber daya alam yang dapat diperbarui adalah ...",
        options: ["Batu bara", "Minyak bumi", "Hutan", "Gas alam", "Emas"],
        answerIndex: 2,
        explanation: "Hutan bisa diperbarui dengan pengelolaan yang tepat.",
      },
    ],
  };

  const selectedPool = pools[subject] || pools["Bahasa Indonesia"];
  const output = [];
  while (output.length < count) {
    const question = selectedPool[output.length % selectedPool.length];
    const options = shuffle(question.options);
    const answerText = question.options[question.answerIndex];
    output.push({
      question: question.question,
      options,
      answerIndex: options.indexOf(answerText),
      explanation: question.explanation,
    });
  }
  return output;
}

function buildMathFallbackQuestion() {
  const questionType = randomInt(1, 4);
  if (questionType === 1) {
    const a = randomInt(2, 9);
    const x = randomInt(3, 12);
    const b = randomInt(4, 30);
    const rightSide = a * x + b;
    const question = `Nilai x pada persamaan ${a}x + ${b} = ${rightSide} adalah ...`;
    return buildNumericQuestion(question, x, "Pindahkan konstanta ke kanan, lalu bagi dengan koefisien x.");
  }

  if (questionType === 2) {
    const length = randomInt(8, 20);
    const width = randomInt(4, 12);
    const area = length * width;
    const question = `Sebuah persegi panjang memiliki panjang ${length} cm dan lebar ${width} cm. Luasnya adalah ... cm2`;
    return buildNumericQuestion(question, area, "Luas persegi panjang = panjang x lebar.");
  }

  if (questionType === 3) {
    const first = randomInt(55, 85);
    const second = randomInt(60, 90);
    const third = randomInt(65, 95);
    const average = Math.round((first + second + third) / 3);
    const question = `Rata-rata dari tiga nilai ${first}, ${second}, dan ${third} adalah ...`;
    return buildNumericQuestion(question, average, "Jumlahkan semua nilai lalu bagi 3.");
  }

  const ratioA = randomInt(2, 7);
  const ratioB = randomInt(2, 7);
  const knownB = ratioB * randomInt(3, 8);
  const answer = (knownB / ratioB) * ratioA;
  const question = `Perbandingan A : B = ${ratioA} : ${ratioB}. Jika nilai B = ${knownB}, maka nilai A adalah ...`;
  return buildNumericQuestion(question, answer, "Samakan faktor pengali pada rasio lalu hitung nilai A.");
}

function buildNumericQuestion(question, answer, explanation) {
  const optionsSet = new Set([answer]);
  while (optionsSet.size < 5) {
    const candidate = answer + randomInt(-18, 18);
    if (candidate > 0) {
      optionsSet.add(candidate);
    }
  }
  const options = shuffle(Array.from(optionsSet).map((value) => String(value)));
  return {
    question,
    options,
    answerIndex: options.indexOf(String(answer)),
    explanation,
  };
}

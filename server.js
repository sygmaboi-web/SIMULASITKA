const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Firestore, FieldValue } = require("@google-cloud/firestore");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GCP_PROJECT_ID =
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "";
const JWT_SECRET = String(process.env.JWT_SECRET || "");
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || "14d";
const GOOGLE_APPLICATION_CREDENTIALS = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
const USERNAME_REGEX = /^[A-Za-z0-9._-]{4,24}$/;
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "VINOGANTENG");
const participantsCollection = "participants";
const usernameMapCollection = "participant_usernames";
const officialExamCollection = "official_exam";
const officialExamDocId = "current";
const liveSessionsCollection = "live_exam_sessions";
const allResultsCollection = "all_exam_results";
const adminMonitorClients = new Set();
const questionUploadDir = path.join(__dirname, "uploads", "questions");
const MAX_QUESTION_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_QUESTION_IMAGE_MIME = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const persistenceIssues = [];
if (!GCP_PROJECT_ID) {
  persistenceIssues.push("GCP_PROJECT_ID belum diisi.");
}
if (!GOOGLE_APPLICATION_CREDENTIALS) {
  persistenceIssues.push("GOOGLE_APPLICATION_CREDENTIALS belum diisi.");
} else {
  const keyPath = path.resolve(process.cwd(), GOOGLE_APPLICATION_CREDENTIALS);
  if (!fs.existsSync(keyPath)) {
    persistenceIssues.push(`File service account tidak ditemukan: ${keyPath}`);
  } else {
    const stats = fs.statSync(keyPath);
    if (!stats.isFile() || stats.size === 0) {
      persistenceIssues.push("File service account kosong atau tidak valid.");
    }
  }
}
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  persistenceIssues.push("JWT_SECRET wajib minimal 32 karakter.");
}

let firestore = null;
if (persistenceIssues.length === 0) {
  try {
    firestore = new Firestore({ projectId: GCP_PROJECT_ID });
  } catch (error) {
    persistenceIssues.push(`Gagal inisialisasi Firestore: ${error.message}`);
  }
}

const persistenceReady = persistenceIssues.length === 0 && Boolean(firestore);
if (!persistenceReady) {
  console.warn(`[persistence] ${persistenceIssues.join(" ")}`);
}

app.use(express.json({ limit: "8mb" }));
app.use(express.static(__dirname));

const SUBJECT_ALIASES = new Map([
  ["matematika", "Matematika"],
  ["ipa", "IPA"],
  ["bahasa indonesia", "Bahasa Indonesia"],
  ["bahasa inggris", "Bahasa Inggris"],
  ["ips", "IPS"],
]);

function normalizeSubject(subjectInput) {
  const key = String(subjectInput || "Matematika").trim().toLowerCase();
  return SUBJECT_ALIASES.get(key) || "Matematika";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function ensurePersistence(_req, res, next) {
  if (persistenceReady) {
    next();
    return;
  }
  res.status(503).json({
    message: "Penyimpanan akun/hasil belum aktif di server.",
    details: persistenceIssues,
  });
}

function parseBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return authHeader.slice(7).trim();
}

function requireAuth(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Token login tidak ditemukan." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload.sub !== "string" || payload.role === "admin") {
      throw new Error("Token tidak valid.");
    }
    req.authUser = {
      userId: payload.sub,
      username: String(payload.username || ""),
      displayName: String(payload.displayName || payload.username || ""),
    };
    next();
  } catch (_error) {
    res.status(401).json({ message: "Sesi login tidak valid atau kedaluwarsa." });
  }
}

function requireAdmin(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    res.status(401).json({ message: "Token admin tidak ditemukan." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      throw new Error("Bukan token admin.");
    }
    req.adminUser = {
      role: "admin",
    };
    next();
  } catch (_error) {
    res.status(401).json({ message: "Sesi admin tidak valid." });
  }
}

function normalizeUsername(raw) {
  const username = String(raw || "").trim();
  if (!USERNAME_REGEX.test(username)) {
    return "";
  }
  return username;
}

function normalizePassword(raw) {
  return String(raw || "");
}

function normalizeDisplayName(raw, fallback = "") {
  const value = String(raw || "").trim();
  const cleaned = value.replace(/\s+/g, " ").slice(0, 80);
  return cleaned || fallback;
}

function normalizeBirthDate(raw) {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return "";
}

function normalizeGender(raw) {
  const gender = String(raw || "").trim();
  if (gender === "Laki-Laki" || gender === "Perempuan") {
    return gender;
  }
  return "Laki-Laki";
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      username: user.username,
      displayName: user.displayName,
    },
    JWT_SECRET,
    { expiresIn: AUTH_TOKEN_TTL }
  );
}

function signAdminToken() {
  return jwt.sign(
    {
      sub: "admin",
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: AUTH_TOKEN_TTL }
  );
}

function getCurrentOfficialExamRef() {
  return firestore.collection(officialExamCollection).doc(officialExamDocId);
}

function verifyAdminTokenFromQuery(req) {
  const token = String(req.query.token || "");
  if (!token) {
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.role === "admin";
  } catch (_error) {
    return false;
  }
}

function sendSseEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastAdminEvent(eventName, payload = {}) {
  adminMonitorClients.forEach((client) => {
    sendSseEvent(client, eventName, {
      ...payload,
      at: new Date().toISOString(),
    });
  });
}

function buildServerErrorMessage(error, fallbackMessage) {
  const errorText = String(error?.message || "");
  if (errorText.includes("Cloud Firestore API has not been used")) {
    return "Firestore API belum aktif. Enable Firestore API di Google Cloud, tunggu 1-3 menit, lalu coba lagi.";
  }
  if (errorText.includes("NOT_FOUND")) {
    return "Database Firestore belum tersedia di project ini. Buka Firestore lalu Create database (Native mode).";
  }
  if (errorText.includes("PERMISSION_DENIED")) {
    return "Akses Firestore ditolak. Cek Firestore API aktif dan service account memiliki role Cloud Datastore User.";
  }
  return fallbackMessage;
}

function toPublicUser(docId, data) {
  return {
    userId: docId,
    username: String(data.username || ""),
    displayName: String(data.displayName || data.username || ""),
    createdAt: toIsoString(data.createdAt),
  };
}

function toIsoString(value) {
  if (!value) {
    return "";
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

async function findParticipantByUsername(usernameLower) {
  const mapRef = firestore.collection(usernameMapCollection).doc(usernameLower);
  const mapSnap = await mapRef.get();
  if (!mapSnap.exists) {
    return null;
  }

  const participantId = String(mapSnap.get("participantId") || "");
  if (!participantId) {
    return null;
  }

  const participantRef = firestore.collection(participantsCollection).doc(participantId);
  const participantSnap = await participantRef.get();
  if (!participantSnap.exists) {
    return null;
  }

  return {
    ref: participantRef,
    snap: participantSnap,
    data: participantSnap.data() || {},
  };
}

async function findParticipantById(participantId) {
  const participantRef = firestore.collection(participantsCollection).doc(participantId);
  const participantSnap = await participantRef.get();
  if (!participantSnap.exists) {
    return null;
  }
  return {
    ref: participantRef,
    snap: participantSnap,
    data: participantSnap.data() || {},
  };
}

function sanitizeResultPayload(body) {
  const sessionId = String(body?.sessionId || "").trim().slice(0, 64);
  const subject = normalizeSubject(body?.subject);
  const totalQuestions = clamp(Number(body?.totalQuestions) || 0, 1, 100);
  const durationMinutes = clamp(Number(body?.durationMinutes) || 0, 1, 240);
  const questionSource = String(body?.questionSource || "-").trim().slice(0, 40);
  const finishReason = String(body?.finishReason || "-").trim().slice(0, 240);
  const completedAtClient = toIsoString(body?.completedAtClient) || new Date().toISOString();

  const inputMetrics = body?.metrics || {};
  const correctCount = clamp(Number(inputMetrics.correctCount) || 0, 0, totalQuestions);
  const wrongCount = clamp(Number(inputMetrics.wrongCount) || 0, 0, totalQuestions);
  const rawScore = clamp(Number(inputMetrics.rawScore) || 0, 0, 100);
  const penaltyPoints = clamp(Number(inputMetrics.penaltyPoints) || 0, 0, 100);
  const finalScore = clamp(Number(inputMetrics.finalScore) || 0, 0, 100);

  const participantInput = body?.participant || {};
  const participant = {
    nik: String(participantInput.nik || "").trim().slice(0, 40),
    displayName: normalizeDisplayName(participantInput.displayName, ""),
    fullName: normalizeDisplayName(participantInput.fullName, ""),
    gender: normalizeGender(participantInput.gender),
    birthDate: normalizeBirthDate(participantInput.birthDate),
  };

  const securityInput = body?.security || {};
  const security = {
    violations: clamp(Number(securityInput.violations) || 0, 0, 100),
    penaltyCount: clamp(Number(securityInput.penaltyCount) || 0, 0, 100),
    penaltyPoints: clamp(Number(securityInput.penaltyPoints) || 0, 0, 100),
  };

  return {
    sessionId,
    subject,
    totalQuestions,
    durationMinutes,
    questionSource,
    finishReason,
    completedAtClient,
    participant,
    metrics: {
      correctCount,
      wrongCount,
      rawScore,
      penaltyPoints,
      finalScore,
    },
    security,
  };
}

function sanitizeOfficialToken(rawToken) {
  return String(rawToken || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 24);
}

function sanitizeQuestionImageUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }
  if (/^\/uploads\/questions\/[A-Za-z0-9._-]+$/.test(value)) {
    return value;
  }
  return "";
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

function normalizeAnswerIndexesInput(item, optionCount, options = []) {
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

function parseImageDataUrl(dataUrl) {
  const text = String(dataUrl || "").trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(text);
  if (!match) {
    return null;
  }
  const mime = match[1].toLowerCase();
  const extension = ALLOWED_QUESTION_IMAGE_MIME.get(mime);
  if (!extension) {
    return null;
  }

  try {
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length) {
      return null;
    }
    return { mime, extension, buffer };
  } catch (_error) {
    return null;
  }
}

function sanitizeOfficialExamPayload(body) {
  const subject = normalizeSubject(body?.subject);
  const durationMinutes = clamp(Number(body?.durationMinutes) || 60, 30, 240);
  const totalQuestions = clamp(Number(body?.totalQuestions) || 20, 5, 60);
  const token = sanitizeOfficialToken(body?.token);
  const rawQuestions = Array.isArray(body?.questions) ? body.questions : [];
  const questions = sanitizeGeneratedQuestions(rawQuestions, subject, totalQuestions);
  return {
    subject,
    durationMinutes,
    totalQuestions,
    token,
    questions,
  };
}

function serializeOfficialExam(examData) {
  if (!examData) {
    return null;
  }
  return {
    status: String(examData.status || "draft"),
    token: String(examData.token || ""),
    subject: String(examData.subject || "Matematika"),
    durationMinutes: Number(examData.durationMinutes) || 60,
    totalQuestions: Number(examData.totalQuestions) || 20,
    sessionId: String(examData.sessionId || ""),
    startedAt: toIsoString(examData.startedAt),
    endedAt: toIsoString(examData.endedAt),
    updatedAt: toIsoString(examData.updatedAt),
    questions: Array.isArray(examData.questions) ? examData.questions : [],
  };
}

async function buildAdminMonitorSnapshot() {
  const examSnap = await getCurrentOfficialExamRef().get();
  const examData = examSnap.exists ? examSnap.data() : null;
  const exam = serializeOfficialExam(examData);
  if (!examData || !examData.sessionId) {
    return { exam, sessions: [] };
  }

  const sessionSnap = await firestore
    .collection(liveSessionsCollection)
    .where("sessionId", "==", String(examData.sessionId))
    .limit(400)
    .get();

  const sessions = sessionSnap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      userId: doc.id,
      username: String(data.username || ""),
      participantName: String(data.participantName || ""),
      status: String(data.status || "unknown"),
      currentQuestion: Number(data.currentQuestion) || 0,
      totalQuestions: Number(data.totalQuestions) || 0,
      remainingSeconds: Number(data.remainingSeconds) || 0,
      violations: Number(data.violations) || 0,
      penaltyCount: Number(data.penaltyCount) || 0,
      penaltyPoints: Number(data.penaltyPoints) || 0,
      updatedAt: toIsoString(data.updatedAt),
    };
  });

  return { exam, sessions };
}

function buildPrompt({ subject, totalQuestions }) {
  return [
    "Anda adalah pembuat soal khusus latihan TKA SMP.",
    `Buat ${totalQuestions} soal baru untuk mata pelajaran ${subject}.`,
    "",
    "Aturan wajib:",
    "- Soal level SMP, bervariasi dari mudah ke menengah.",
    "- Pilihan ganda 5 opsi (A-E).",
    "- Hanya satu jawaban benar.",
    "- Sertakan pembahasan singkat 1-2 kalimat.",
    "- Soal harus orisinal dan tidak menyalin soal yang umum beredar.",
    "- Gunakan bahasa Indonesia baku (kecuali mapel Bahasa Inggris).",
    "",
    "Contoh 1:",
    "question: Sebuah taman berbentuk persegi dengan sisi 14 m. Keliling taman adalah ...",
    "options: [42 m, 56 m, 28 m, 196 m2, 70 m]",
    "answerIndex: 1",
    "explanation: Keliling persegi = 4 x sisi = 4 x 14 = 56 m.",
    "",
    "Contoh 2:",
    "question: Planet yang paling dekat dengan Matahari adalah ...",
    "options: [Venus, Bumi, Merkurius, Mars, Saturnus]",
    "answerIndex: 2",
    "explanation: Merkurius adalah planet terdekat dari Matahari.",
    "",
    "Keluarkan JSON valid tanpa markdown code block dengan format PERSIS berikut:",
    '{',
    '  "questions": [',
    "    {",
    '      "question": "teks soal",',
    '      "options": ["opsi A", "opsi B", "opsi C", "opsi D", "opsi E"],',
    '      "answerIndex": 0,',
    '      "explanation": "pembahasan singkat"',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

async function generateFromGemini({ subject, totalQuestions }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum disetel.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const prompt = buildPrompt({ subject, totalQuestions });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.95,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const payload = await response.json();
  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();

  if (!rawText) {
    throw new Error("Gemini mengembalikan respons kosong.");
  }

  return rawText;
}

function extractJsonText(rawText) {
  const cleaned = String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    return cleaned;
  }

  const firstObjectStart = cleaned.indexOf("{");
  const lastObjectEnd = cleaned.lastIndexOf("}");
  if (firstObjectStart >= 0 && lastObjectEnd > firstObjectStart) {
    return cleaned.slice(firstObjectStart, lastObjectEnd + 1);
  }

  throw new Error("Tidak menemukan JSON pada respons model.");
}

function parseModelQuestions(rawText) {
  const jsonText = extractJsonText(rawText);
  const parsed = JSON.parse(jsonText);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.questions)) {
    return parsed.questions;
  }
  throw new Error("Format JSON tidak memiliki array questions.");
}

function sanitizeGeneratedQuestions(rawQuestions, subject, totalQuestions) {
  const sanitized = [];
  const list = Array.isArray(rawQuestions) ? rawQuestions : [];

  for (const item of list) {
    if (!item || typeof item.question !== "string") {
      continue;
    }

    const options = Array.isArray(item.options)
      ? item.options
          .map((option) => String(option).trim())
          .filter((option) => option.length > 0)
      : [];

    if (options.length < 4) {
      continue;
    }

    const limitedOptions = options.slice(0, 8);
    const answerIndexes = normalizeAnswerIndexesInput(item, limitedOptions.length, limitedOptions);
    if (!answerIndexes.length) {
      continue;
    }

    const typeCandidate = normalizeQuestionType(item.questionType, answerIndexes);
    const questionType = typeCandidate === "multiple" && answerIndexes.length > 1 ? "multiple" : "single";
    const normalizedAnswers = questionType === "multiple" ? answerIndexes : [answerIndexes[0]];

    const explanation =
      typeof item.explanation === "string" && item.explanation.trim().length > 0
        ? item.explanation.trim()
        : "Pembahasan singkat tidak tersedia.";

    sanitized.push({
      question: item.question.trim(),
      options: limitedOptions,
      questionType,
      answerIndexes: normalizedAnswers,
      answerIndex: normalizedAnswers[0],
      imageUrl: sanitizeQuestionImageUrl(item.imageUrl),
      explanation,
    });
  }

  if (sanitized.length < totalQuestions) {
    const fallback = buildFallbackQuestions(subject, totalQuestions - sanitized.length);
    sanitized.push(...fallback);
  }

  return sanitized.slice(0, totalQuestions).map((question, index) => ({
    id: index + 1,
    ...question,
  }));
}

function buildFallbackQuestions(subject, count) {
  if (subject === "Matematika") {
    return Array.from({ length: count }, () => buildMathFallbackQuestion());
  }

  const pools = {
    IPA: [
      {
        question: "Bagian tumbuhan yang berfungsi menyerap air dan mineral dari tanah adalah ...",
        options: ["Daun", "Bunga", "Akar", "Batang", "Buah"],
        answerIndex: 2,
        explanation: "Akar menyerap air dan mineral dari tanah.",
      },
      {
        question: "Satuan gaya dalam SI adalah ...",
        options: ["Joule", "Newton", "Watt", "Pascal", "Kelvin"],
        answerIndex: 1,
        explanation: "Satuan gaya dalam SI adalah Newton (N).",
      },
      {
        question: "Hewan yang berkembang biak dengan cara bertelur disebut ...",
        options: ["Vivipar", "Ovovivipar", "Ovipar", "Metamorfosis", "Mamalia"],
        answerIndex: 2,
        explanation: "Ovipar berarti berkembang biak dengan bertelur.",
      },
      {
        question: "Perubahan energi pada lampu senter adalah ...",
        options: [
          "Kimia menjadi cahaya",
          "Cahaya menjadi kimia",
          "Panas menjadi listrik",
          "Listrik menjadi kimia",
          "Gerak menjadi panas",
        ],
        answerIndex: 0,
        explanation: "Energi kimia pada baterai diubah menjadi energi cahaya.",
      },
      {
        question: "Benda langit yang memancarkan cahayanya sendiri adalah ...",
        options: ["Bulan", "Komet", "Meteoroid", "Matahari", "Planet"],
        answerIndex: 3,
        explanation: "Matahari memancarkan cahaya sendiri sebagai bintang.",
      },
    ],
    "Bahasa Indonesia": [
      {
        question: "Kalimat efektif harus memiliki ...",
        options: ["Makna ganda", "Struktur jelas", "Kata berulang", "Kalimat sangat panjang", "Bahasa gaul"],
        answerIndex: 1,
        explanation: "Kalimat efektif menggunakan struktur yang jelas dan tidak bertele-tele.",
      },
      {
        question: "Kata baku yang tepat adalah ...",
        options: ["Nasehat", "Aktifitas", "Kreativitas", "Praktek", "Resiko"],
        answerIndex: 2,
        explanation: "Bentuk baku: kreativitas.",
      },
      {
        question: "Tujuan teks persuasi adalah ...",
        options: ["Menghibur pembaca", "Menceritakan masa lalu", "Meyakinkan pembaca", "Menjelaskan langkah", "Mendeskripsikan tempat"],
        answerIndex: 2,
        explanation: "Teks persuasi bertujuan memengaruhi pembaca agar setuju/melakukan sesuatu.",
      },
      {
        question: "Antonim kata 'optimis' adalah ...",
        options: ["Semangat", "Pesimis", "Aktif", "Stabil", "Tenang"],
        answerIndex: 1,
        explanation: "Antonim optimis adalah pesimis.",
      },
      {
        question: "Informasi penting dalam paragraf dapat ditemukan melalui ...",
        options: ["Kalimat acak", "Gagasan utama", "Ilustrasi", "Anekdot", "Dialog"],
        answerIndex: 1,
        explanation: "Gagasan utama menjadi inti informasi dalam paragraf.",
      },
    ],
    "Bahasa Inggris": [
      {
        question: "Choose the correct form: My brother ... a new bicycle last week.",
        options: ["buy", "buys", "bought", "buying", "to buy"],
        answerIndex: 2,
        explanation: "Last week indicates past tense, so use bought.",
      },
      {
        question: "The opposite of 'high' is ...",
        options: ["tall", "short", "big", "wide", "long"],
        answerIndex: 1,
        explanation: "The antonym of high is low/short based on context; short fits this option set.",
      },
      {
        question: "She ... to the library every Saturday.",
        options: ["go", "goes", "went", "gone", "going"],
        answerIndex: 1,
        explanation: "Simple present with she uses goes.",
      },
      {
        question: "What is the Indonesian meaning of 'careful'?",
        options: ["Cepat", "Kuat", "Hati-hati", "Lemah", "Murah"],
        answerIndex: 2,
        explanation: "'Careful' means hati-hati.",
      },
      {
        question: "They are ... than me in mathematics.",
        options: ["good", "better", "best", "more good", "the best"],
        answerIndex: 1,
        explanation: "Comparative form of good is better.",
      },
    ],
    IPS: [
      {
        question: "Pelaku ekonomi yang menghasilkan barang atau jasa disebut ...",
        options: ["Konsumen", "Produsen", "Distributor", "Importir", "Eksportir"],
        answerIndex: 1,
        explanation: "Produsen adalah pelaku yang menghasilkan barang/jasa.",
      },
      {
        question: "Garis khatulistiwa membagi bumi menjadi ...",
        options: ["Timur dan Barat", "Utara dan Selatan", "Daratan dan lautan", "Zona panas dan dingin", "Asia dan Eropa"],
        answerIndex: 1,
        explanation: "Khatulistiwa membagi bumi menjadi belahan utara dan selatan.",
      },
      {
        question: "Fungsi utama pajak bagi negara adalah ...",
        options: ["Pendapatan negara", "Biaya pribadi", "Hadiah masyarakat", "Pinjaman luar negeri", "Tabungan perusahaan"],
        answerIndex: 0,
        explanation: "Pajak menjadi sumber utama penerimaan negara.",
      },
      {
        question: "Bentuk interaksi sosial yang ditandai persaingan sehat disebut ...",
        options: ["Konflik", "Persaingan", "Akomodasi", "Asimilasi", "Koersi"],
        answerIndex: 1,
        explanation: "Persaingan adalah proses sosial untuk mencapai tujuan tertentu.",
      },
      {
        question: "ASEAN didirikan pada tahun ...",
        options: ["1965", "1967", "1971", "1975", "1980"],
        answerIndex: 1,
        explanation: "ASEAN didirikan pada 8 Agustus 1967.",
      },
    ],
  };

  const pool = pools[subject] || pools["Bahasa Indonesia"];
  const output = [];
  while (output.length < count) {
    const template = pool[output.length % pool.length];
    const answerText = template.options[template.answerIndex];
    const shuffledOptions = shuffle(template.options);
    output.push({
      question: template.question,
      options: shuffledOptions,
      answerIndex: shuffledOptions.indexOf(answerText),
      explanation: template.explanation,
    });
  }

  return output;
}

function buildMathFallbackQuestion() {
  const type = randomInt(1, 4);
  if (type === 1) {
    const a = randomInt(2, 9);
    const x = randomInt(2, 13);
    const b = randomInt(5, 30);
    const right = a * x + b;
    return buildNumericQuestion(
      `Nilai x pada persamaan ${a}x + ${b} = ${right} adalah ...`,
      x,
      "Pindahkan konstanta ke kanan lalu bagi dengan koefisien x."
    );
  }

  if (type === 2) {
    const p = randomInt(8, 24);
    const l = randomInt(5, 14);
    return buildNumericQuestion(
      `Luas persegi panjang dengan panjang ${p} cm dan lebar ${l} cm adalah ... cm2`,
      p * l,
      "Gunakan rumus luas persegi panjang: panjang x lebar."
    );
  }

  if (type === 3) {
    const x = randomInt(6, 18);
    const y = randomInt(4, 15);
    return buildNumericQuestion(
      `Hasil dari 3(${x} + ${y}) - 2${y} adalah ...`,
      3 * (x + y) - 2 * y,
      "Sederhanakan ekspresi dengan operasi hitung berurutan."
    );
  }

  const ratioA = randomInt(2, 7);
  const ratioB = randomInt(2, 7);
  const multiplier = randomInt(3, 9);
  const valueB = ratioB * multiplier;
  const valueA = ratioA * multiplier;
  return buildNumericQuestion(
    `Perbandingan A:B = ${ratioA}:${ratioB}. Jika B = ${valueB}, nilai A adalah ...`,
    valueA,
    "Gunakan faktor pengali yang sama pada perbandingan."
  );
}

function buildNumericQuestion(question, answer, explanation) {
  const set = new Set([answer]);
  while (set.size < 5) {
    const candidate = answer + randomInt(-18, 18);
    if (candidate > 0) {
      set.add(candidate);
    }
  }
  const options = shuffle(Array.from(set).map((value) => String(value)));
  return {
    question,
    options,
    answerIndex: options.indexOf(String(answer)),
    explanation,
  };
}

app.get("/api/health", async (_req, res) => {
  let persistenceOperational = false;
  let persistenceRuntimeIssue = "";

  if (persistenceReady) {
    try {
      await getCurrentOfficialExamRef().get();
      persistenceOperational = true;
    } catch (error) {
      persistenceRuntimeIssue = buildServerErrorMessage(
        error,
        "Storage terkonfigurasi tetapi gagal diakses saat runtime."
      );
    }
  }

  res.json({
    status: "ok",
    model: GEMINI_MODEL,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    persistenceReady,
    persistenceOperational,
    persistenceIssues,
    persistenceRuntimeIssue,
  });
});

app.get("/api/prompt-template", (req, res) => {
  const subject = normalizeSubject(req.query.subject || "Matematika");
  const totalQuestions = clamp(Number(req.query.totalQuestions) || 10, 5, 40);
  res.json({
    subject,
    totalQuestions,
    prompt: buildPrompt({ subject, totalQuestions }),
  });
});

app.post("/api/generate-questions", async (req, res) => {
  const subject = normalizeSubject(req.body?.subject);
  const totalQuestions = clamp(Number(req.body?.totalQuestions) || 20, 5, 60);

  let questions = [];
  let source = "gemini";

  try {
    const modelRawText = await generateFromGemini({ subject, totalQuestions });
    const parsedQuestions = parseModelQuestions(modelRawText);
    questions = sanitizeGeneratedQuestions(parsedQuestions, subject, totalQuestions);
  } catch (error) {
    source = "fallback-local";
    questions = sanitizeGeneratedQuestions(buildFallbackQuestions(subject, totalQuestions), subject, totalQuestions);
    console.error(`[generate-questions] ${error.message}`);
  }

  res.json({
    source,
    subject,
    totalQuestions,
    questions,
  });
});

app.post("/api/admin/login", ensurePersistence, (req, res) => {
  const password = String(req.body?.password || "");
  if (!password) {
    res.status(400).json({ message: "Password admin wajib diisi." });
    return;
  }
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ message: "Password admin salah." });
    return;
  }
  res.json({
    message: "Login admin berhasil.",
    token: signAdminToken(),
  });
});

app.post("/api/admin/question-image", ensurePersistence, requireAdmin, async (req, res) => {
  const parsedDataUrl = parseImageDataUrl(req.body?.dataUrl);
  if (!parsedDataUrl) {
    res.status(400).json({ message: "Format data gambar tidak valid. Gunakan JPG/PNG/WebP." });
    return;
  }
  if (parsedDataUrl.buffer.length > MAX_QUESTION_IMAGE_BYTES) {
    res.status(400).json({ message: "Ukuran gambar maksimal 2MB." });
    return;
  }

  try {
    await fs.promises.mkdir(questionUploadDir, { recursive: true });
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${parsedDataUrl.extension}`;
    const outputPath = path.join(questionUploadDir, fileName);
    await fs.promises.writeFile(outputPath, parsedDataUrl.buffer);
    res.json({
      url: `/uploads/questions/${fileName}`,
    });
  } catch (error) {
    console.error(`[admin-upload-question-image] ${error.message}`);
    res.status(500).json({ message: "Gagal menyimpan gambar soal ke server." });
  }
});

app.post("/api/admin/exam/generate", ensurePersistence, requireAdmin, async (req, res) => {
  const subject = normalizeSubject(req.body?.subject);
  const totalQuestions = clamp(Number(req.body?.totalQuestions) || 20, 5, 60);

  let questions = [];
  let source = "gemini";

  try {
    const modelRawText = await generateFromGemini({ subject, totalQuestions });
    const parsedQuestions = parseModelQuestions(modelRawText);
    questions = sanitizeGeneratedQuestions(parsedQuestions, subject, totalQuestions);
  } catch (error) {
    source = "fallback-local";
    questions = sanitizeGeneratedQuestions(buildFallbackQuestions(subject, totalQuestions), subject, totalQuestions);
    console.error(`[admin-generate-questions] ${error.message}`);
  }

  res.json({
    source,
    subject,
    totalQuestions,
    questions,
  });
});

app.post("/api/admin/exam/draft", ensurePersistence, requireAdmin, async (req, res) => {
  const payload = sanitizeOfficialExamPayload(req.body);
  if (!payload.token || payload.token.length < 4) {
    res.status(400).json({ message: "Token ujian resmi minimal 4 karakter." });
    return;
  }
  if (!Array.isArray(payload.questions) || payload.questions.length < payload.totalQuestions) {
    res.status(400).json({ message: "Jumlah soal draft belum mencukupi." });
    return;
  }

  const examRef = getCurrentOfficialExamRef();

  try {
    const existingSnap = await examRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : {};
    if (String(existingData.status || "") === "active") {
      res.status(400).json({ message: "Ujian resmi sedang aktif. Akhiri dulu sebelum ubah draft." });
      return;
    }
    await examRef.set(
      {
        status: "draft",
        sessionId: String(existingData.sessionId || ""),
        token: payload.token,
        subject: payload.subject,
        durationMinutes: payload.durationMinutes,
        totalQuestions: payload.totalQuestions,
        questions: payload.questions,
        createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    broadcastAdminEvent("exam-refresh", { reason: "draft-updated" });
  } catch (error) {
    console.error(`[admin-save-draft] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal menyimpan draft ujian resmi.") });
    return;
  }

  res.json({ message: "Draft ujian resmi berhasil disimpan." });
});

app.get("/api/admin/exam/current", ensurePersistence, requireAdmin, async (_req, res) => {
  try {
    const examSnap = await getCurrentOfficialExamRef().get();
    if (!examSnap.exists) {
      res.json({ exam: null });
      return;
    }
    res.json({
      exam: serializeOfficialExam(examSnap.data() || {}),
    });
  } catch (error) {
    console.error(`[admin-current-exam] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memuat data ujian resmi.") });
  }
});

app.post("/api/admin/exam/start", ensurePersistence, requireAdmin, async (_req, res) => {
  const examRef = getCurrentOfficialExamRef();
  try {
    const examSnap = await examRef.get();
    if (!examSnap.exists) {
      res.status(400).json({ message: "Draft ujian belum dibuat." });
      return;
    }
    const examData = examSnap.data() || {};
    if (String(examData.status || "") === "active") {
      res.status(400).json({ message: "Ujian resmi sudah aktif." });
      return;
    }
    if (!Array.isArray(examData.questions) || examData.questions.length < 5) {
      res.status(400).json({ message: "Soal ujian resmi belum valid." });
      return;
    }
    if (!sanitizeOfficialToken(examData.token)) {
      res.status(400).json({ message: "Token ujian resmi belum valid." });
      return;
    }

    const sessionId = `SESI-${Date.now()}`;
    await examRef.set(
      {
        status: "active",
        sessionId,
        startedAt: FieldValue.serverTimestamp(),
        endedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    broadcastAdminEvent("exam-refresh", { reason: "exam-started", sessionId });
    res.json({
      message: "Ujian resmi dimulai.",
      sessionId,
    });
  } catch (error) {
    console.error(`[admin-start-exam] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memulai ujian resmi.") });
  }
});

app.post("/api/admin/exam/stop", ensurePersistence, requireAdmin, async (_req, res) => {
  const examRef = getCurrentOfficialExamRef();
  try {
    const examSnap = await examRef.get();
    if (!examSnap.exists) {
      res.status(400).json({ message: "Data ujian resmi tidak ditemukan." });
      return;
    }
    await examRef.set(
      {
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    broadcastAdminEvent("exam-refresh", { reason: "exam-stopped" });
    res.json({ message: "Ujian resmi diakhiri." });
  } catch (error) {
    console.error(`[admin-stop-exam] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal mengakhiri ujian resmi.") });
  }
});

app.get("/api/admin/monitor", ensurePersistence, requireAdmin, async (_req, res) => {
  try {
    const snapshot = await buildAdminMonitorSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error(`[admin-monitor] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memuat data monitor realtime.") });
  }
});

app.get("/api/admin/results", ensurePersistence, requireAdmin, async (req, res) => {
  const limit = clamp(Number(req.query.limit) || 100, 1, 400);
  try {
    const resultSnap = await firestore
      .collection(allResultsCollection)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const results = resultSnap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        userId: String(data.userId || ""),
        username: String(data.username || ""),
        subject: String(data.subject || "-"),
        totalQuestions: Number(data.totalQuestions) || 0,
        durationMinutes: Number(data.durationMinutes) || 0,
        questionSource: String(data.questionSource || "-"),
        finishReason: String(data.finishReason || "-"),
        completedAtClient: toIsoString(data.completedAtClient),
        createdAt: toIsoString(data.createdAt),
        participant: {
          displayName: String(data.participant?.displayName || ""),
          fullName: String(data.participant?.fullName || ""),
          gender: String(data.participant?.gender || ""),
          birthDate: String(data.participant?.birthDate || ""),
        },
        metrics: {
          correctCount: Number(data.metrics?.correctCount) || 0,
          wrongCount: Number(data.metrics?.wrongCount) || 0,
          rawScore: Number(data.metrics?.rawScore) || 0,
          penaltyPoints: Number(data.metrics?.penaltyPoints) || 0,
          finalScore: Number(data.metrics?.finalScore) || 0,
        },
        security: {
          violations: Number(data.security?.violations) || 0,
          penaltyCount: Number(data.security?.penaltyCount) || 0,
          penaltyPoints: Number(data.security?.penaltyPoints) || 0,
        },
      };
    });
    res.json({ results });
  } catch (error) {
    console.error(`[admin-results] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memuat hasil seluruh peserta.") });
  }
});

app.get("/api/admin/monitor-stream", ensurePersistence, (req, res) => {
  if (!verifyAdminTokenFromQuery(req)) {
    res.status(401).json({ message: "Token admin untuk stream tidak valid." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  adminMonitorClients.add(res);
  sendSseEvent(res, "exam-refresh", { reason: "connected", at: new Date().toISOString() });

  const heartbeatId = setInterval(() => {
    sendSseEvent(res, "ping", { at: new Date().toISOString() });
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    adminMonitorClients.delete(res);
    res.end();
  });
});

app.post("/api/exam/enter", ensurePersistence, requireAuth, async (req, res) => {
  const token = sanitizeOfficialToken(req.body?.token);
  if (!token) {
    res.status(400).json({ message: "Token ujian resmi wajib diisi." });
    return;
  }

  try {
    const examSnap = await getCurrentOfficialExamRef().get();
    if (!examSnap.exists) {
      res.status(400).json({ message: "Ujian resmi belum disiapkan admin." });
      return;
    }

    const examData = examSnap.data() || {};
    if (String(examData.status || "") !== "active") {
      res.status(400).json({ message: "Ujian resmi belum dimulai atau sudah berakhir." });
      return;
    }
    const examToken = sanitizeOfficialToken(examData.token);
    if (token !== examToken) {
      res.status(401).json({ message: "Token ujian resmi tidak valid." });
      return;
    }

    const totalQuestions = Number(examData.totalQuestions) || 0;
    const durationMinutes = Number(examData.durationMinutes) || 0;
    const startedAtDate =
      typeof examData.startedAt?.toDate === "function" ? examData.startedAt.toDate() : new Date(Date.now());
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtDate.getTime()) / 1000));
    const remainingSeconds = Math.max(0, durationMinutes * 60 - elapsedSeconds);

    if (remainingSeconds <= 0) {
      res.status(400).json({ message: "Waktu ujian resmi sudah habis." });
      return;
    }

    const participantInput = req.body?.participant || {};
    const participantName =
      normalizeDisplayName(participantInput.fullName, "") ||
      normalizeDisplayName(participantInput.displayName, "") ||
      req.authUser.displayName ||
      req.authUser.username;

    await firestore
      .collection(liveSessionsCollection)
      .doc(req.authUser.userId)
      .set(
        {
          sessionId: String(examData.sessionId || ""),
          userId: req.authUser.userId,
          username: req.authUser.username,
          participantName,
          status: "in_progress",
          subject: String(examData.subject || "Matematika"),
          totalQuestions,
          currentQuestion: 1,
          remainingSeconds,
          violations: 0,
          penaltyCount: 0,
          penaltyPoints: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    broadcastAdminEvent("monitor-refresh", { reason: "participant-entered" });
    res.json({
      source: "official-admin",
      sessionId: String(examData.sessionId || ""),
      subject: String(examData.subject || "Matematika"),
      durationMinutes,
      totalQuestions,
      remainingSeconds,
      questions: Array.isArray(examData.questions) ? examData.questions : [],
    });
  } catch (error) {
    console.error(`[exam-enter] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memulai sesi ujian resmi.") });
  }
});

app.post("/api/exam/progress", ensurePersistence, requireAuth, async (req, res) => {
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) {
    res.status(400).json({ message: "Session ujian tidak ditemukan." });
    return;
  }

  const data = {
    sessionId,
    userId: req.authUser.userId,
    username: req.authUser.username,
    status: Boolean(req.body?.finished) ? "finished" : "in_progress",
    subject: String(req.body?.subject || "-"),
    currentQuestion: clamp(Number(req.body?.currentQuestion) || 1, 1, 200),
    totalQuestions: clamp(Number(req.body?.totalQuestions) || 1, 1, 200),
    remainingSeconds: clamp(Number(req.body?.remainingSeconds) || 0, 0, 14400),
    violations: clamp(Number(req.body?.violations) || 0, 0, 200),
    penaltyCount: clamp(Number(req.body?.penaltyCount) || 0, 0, 200),
    penaltyPoints: clamp(Number(req.body?.penaltyPoints) || 0, 0, 300),
    finalScore: clamp(Number(req.body?.finalScore) || 0, 0, 100),
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    await firestore.collection(liveSessionsCollection).doc(req.authUser.userId).set(data, { merge: true });
    broadcastAdminEvent("monitor-refresh", { reason: "participant-progress" });
    if (data.status === "finished") {
      broadcastAdminEvent("result-refresh", { reason: "participant-finished" });
    }
    res.json({ message: "Progress tersimpan." });
  } catch (error) {
    console.error(`[exam-progress] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal menyimpan progress ujian.") });
  }
});

app.post("/api/auth/register", ensurePersistence, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = normalizePassword(req.body?.password);
  const displayName = normalizeDisplayName(req.body?.displayName, username);

  if (!username) {
    res.status(400).json({
      message: "Username harus 4-24 karakter (huruf/angka/.-_).",
    });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "Password minimal 6 karakter." });
    return;
  }

  const usernameLower = username.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const participantRef = firestore.collection(participantsCollection).doc();
  const usernameRef = firestore.collection(usernameMapCollection).doc(usernameLower);

  try {
    await firestore.runTransaction(async (transaction) => {
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists) {
        throw new Error("USERNAME_EXISTS");
      }

      transaction.set(usernameRef, {
        participantId: participantRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(participantRef, {
        username,
        usernameLower,
        displayName,
        passwordHash,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error.message === "USERNAME_EXISTS") {
      res.status(409).json({ message: "Username sudah dipakai peserta lain." });
      return;
    }
    console.error(`[auth-register] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal membuat akun peserta.") });
    return;
  }

  const user = {
    userId: participantRef.id,
    username,
    displayName,
  };

  res.status(201).json({
    message: "Akun peserta berhasil dibuat.",
    token: signAuthToken(user),
    user,
  });
});

app.post("/api/auth/login", ensurePersistence, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = normalizePassword(req.body?.password);
  if (!username || !password) {
    res.status(400).json({ message: "Username dan password wajib diisi." });
    return;
  }

  try {
    const participant = await findParticipantByUsername(username.toLowerCase());
    if (!participant) {
      res.status(401).json({ message: "Username atau password salah." });
      return;
    }

    const validPassword = await bcrypt.compare(password, String(participant.data.passwordHash || ""));
    if (!validPassword) {
      res.status(401).json({ message: "Username atau password salah." });
      return;
    }

    const user = toPublicUser(participant.snap.id, participant.data);
    await participant.ref.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({
      message: "Login berhasil.",
      token: signAuthToken(user),
      user,
    });
  } catch (error) {
    console.error(`[auth-login] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal login akun peserta.") });
  }
});

app.get("/api/auth/me", ensurePersistence, requireAuth, async (req, res) => {
  try {
    const participant = await findParticipantById(req.authUser.userId);
    if (!participant) {
      res.status(401).json({ message: "Akun tidak ditemukan." });
      return;
    }
    res.json({
      user: toPublicUser(participant.snap.id, participant.data),
    });
  } catch (error) {
    console.error(`[auth-me] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memuat data akun.") });
  }
});

app.post("/api/results", ensurePersistence, requireAuth, async (req, res) => {
  try {
    const payload = sanitizeResultPayload(req.body);
    const participant = await findParticipantById(req.authUser.userId);

    if (!participant) {
      res.status(401).json({ message: "Akun peserta tidak ditemukan." });
      return;
    }

    const participantRef = firestore.collection(participantsCollection).doc(req.authUser.userId);
    const resultRef = participantRef.collection("exam_results").doc();
    const effectiveDisplayName =
      payload.participant.fullName ||
      payload.participant.displayName ||
      req.authUser.displayName ||
      req.authUser.username;

    await resultRef.set({
      ...payload,
      account: {
        userId: req.authUser.userId,
        username: req.authUser.username,
        displayName: effectiveDisplayName,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    await firestore.collection(allResultsCollection).doc(resultRef.id).set({
      ...payload,
      userId: req.authUser.userId,
      username: req.authUser.username,
      createdAt: FieldValue.serverTimestamp(),
    });

    await participantRef.set(
      {
        displayName: effectiveDisplayName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (payload.sessionId) {
      await firestore.collection(liveSessionsCollection).doc(req.authUser.userId).set(
        {
          sessionId: payload.sessionId,
          userId: req.authUser.userId,
          username: req.authUser.username,
          status: "finished",
          subject: payload.subject,
          currentQuestion: payload.totalQuestions,
          totalQuestions: payload.totalQuestions,
          remainingSeconds: 0,
          violations: payload.security.violations,
          penaltyCount: payload.security.penaltyCount,
          penaltyPoints: payload.security.penaltyPoints,
          finalScore: payload.metrics.finalScore,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    broadcastAdminEvent("monitor-refresh", { reason: "result-saved" });
    broadcastAdminEvent("result-refresh", { reason: "result-saved" });

    res.status(201).json({
      message: "Hasil berhasil disimpan.",
      resultId: resultRef.id,
    });
  } catch (error) {
    console.error(`[save-result] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal menyimpan hasil ujian.") });
  }
});

app.get("/api/results", ensurePersistence, requireAuth, async (req, res) => {
  const limit = clamp(Number(req.query.limit) || 15, 1, 50);

  try {
    const resultSnap = await firestore
      .collection(participantsCollection)
      .doc(req.authUser.userId)
      .collection("exam_results")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const results = resultSnap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        subject: data.subject || "-",
        durationMinutes: Number(data.durationMinutes) || 0,
        totalQuestions: Number(data.totalQuestions) || 0,
        questionSource: String(data.questionSource || "-"),
        finishReason: String(data.finishReason || "-"),
        completedAtClient: toIsoString(data.completedAtClient),
        createdAt: toIsoString(data.createdAt),
        participant: {
          displayName: String(data.participant?.displayName || ""),
          fullName: String(data.participant?.fullName || ""),
          gender: String(data.participant?.gender || ""),
          birthDate: String(data.participant?.birthDate || ""),
        },
        metrics: {
          correctCount: Number(data.metrics?.correctCount) || 0,
          wrongCount: Number(data.metrics?.wrongCount) || 0,
          rawScore: Number(data.metrics?.rawScore) || 0,
          penaltyPoints: Number(data.metrics?.penaltyPoints) || 0,
          finalScore: Number(data.metrics?.finalScore) || 0,
        },
      };
    });

    res.json({ results });
  } catch (error) {
    console.error(`[list-result] ${error.message}`);
    res.status(500).json({ message: buildServerErrorMessage(error, "Gagal memuat riwayat hasil.") });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Simulasi TKA SMP berjalan di http://localhost:${PORT}`);
});

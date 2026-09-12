const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(QUESTIONS_FILE)) fs.writeFileSync(QUESTIONS_FILE, '[]', 'utf8');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const example = path.join(__dirname, 'config.example.json');
  if (fs.existsSync(example)) return JSON.parse(fs.readFileSync(example, 'utf8'));
  return {};
}

const config = loadConfig();
const JWT_SECRET = process.env.QA_JWT_SECRET || config.jwtSecret || 'dev-secret-change-this';

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Banned words filter
const BANNED_WORDS = [
  'spam', 'viagra', 'casino', 'bitcoin', 'crypto', 'forex',
  'nigger', 'faggot', 'cunt', 'slut', 'whore', 'retard',
  'porn', 'xxx', 'sex', 'retard',
  'genocide', 'terrorist', 'bomb', 'kill yourself',
  'hate crime', 'death threat'
];

function containsBannedWords(text) {
  const lower = String(text).toLowerCase();
  return BANNED_WORDS.some(word => lower.includes(word.toLowerCase()));
}

// Rate limiter: 1 ask per 30 seconds per IP (use X-Forwarded-For for nginx proxy)
const askLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 1,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  },
  message: { error: 'Rate limit: only 1 question per 30 seconds allowed from this IP' }
});

app.post('/api/ask', askLimiter, (req, res) => {
  const { name, question } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required' });
  }
  if (containsBannedWords(question)) {
    return res.status(400).json({ error: 'Question contains prohibited content' });
  }
  const q = {
    id: uuidv4(),
    name: name ? String(name).slice(0, 100) : 'Anonymous',
    question: String(question).slice(0, 2000),
    timestamp: Date.now(),
    answered: false,
    answer: null,
    answeredBy: null,
  };
  const arr = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
  arr.unshift(q);
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  res.json({ ok: true, id: q.id });
});

app.get('/api/questions', (req, res) => {
  const arr = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
  res.json(arr);
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const cfg = loadConfig();
  if (!cfg.username || !cfg.passwordHash) return res.status(500).json({ error: 'Auth not configured. Run setup.' });
  if (String(username) !== String(cfg.username)) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(String(password), cfg.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ username: cfg.username }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/answer', authMiddleware, (req, res) => {
  const { id, answer } = req.body || {};
  if (!id || !answer) return res.status(400).json({ error: 'id and answer required' });
  if (containsBannedWords(answer)) {
    return res.status(400).json({ error: 'Answer contains prohibited content' });
  }
  const arr = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
  const idx = arr.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });
  arr[idx].answered = true;
  arr[idx].answer = String(answer).slice(0, 2000);
  arr[idx].answeredBy = req.user && req.user.username ? req.user.username : 'admin';
  arr[idx].answeredAt = Date.now();
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  res.json({ ok: true });
});

// Serve static files (QA frontend included) and fallback
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => console.log(`Q&A server running on http://localhost:${PORT}`));

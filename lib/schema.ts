export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE(subject, name)
);

-- 來源使用條件檢查表（每個發布單位一筆）
CREATE TABLE IF NOT EXISTS source_checks (
  id INTEGER PRIMARY KEY,
  issuer TEXT NOT NULL UNIQUE,
  announcement_url TEXT,
  papers_public TEXT NOT NULL DEFAULT 'UNKNOWN',
  answers_public TEXT NOT NULL DEFAULT 'UNKNOWN',
  copyright_note TEXT,
  reuse_permission TEXT NOT NULL DEFAULT 'UNKNOWN',
  confirm_method TEXT,
  checked_on TEXT,
  checked_by TEXT,
  note TEXT
);

-- 試卷（一份公告試卷一筆）
CREATE TABLE IF NOT EXISTS exam_papers (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,
  bank TEXT,
  year INTEGER,
  exam_name TEXT NOT NULL,
  position TEXT,
  subject_label TEXT,
  exam_date TEXT,
  paper_url TEXT,
  answer_url TEXT,
  announcement_url TEXT,
  paper_file TEXT,
  answer_file TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id INTEGER PRIMARY KEY,
  detect_method TEXT NOT NULL,           -- EXACT_TEXT 系統偵測文字相同 / MANUAL 人工標記
  confirmed INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

-- 題目：每份試卷中的每一題一筆；重複題各自保留來源與答案，以 duplicate_group_id 連結
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES exam_papers(id),
  number_in_paper INTEGER,
  subject TEXT NOT NULL,
  subject_source TEXT NOT NULL DEFAULT 'MANUAL',
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  option_style TEXT NOT NULL DEFAULT 'ALPHA',
  stem TEXT NOT NULL,
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  official_answer TEXT,
  answer_status TEXT NOT NULL,
  answer_note TEXT,
  verify_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  verified_at TEXT,
  explanation TEXT,
  explanation_status TEXT NOT NULL DEFAULT 'NONE',
  explanation_reviewed_at TEXT,
  duplicate_group_id INTEGER REFERENCES duplicate_groups(id) ON DELETE SET NULL,
  stem_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  law_at_exam TEXT,
  law_recheck TEXT,
  law_recheck_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions(stem_hash);

CREATE TABLE IF NOT EXISTS law_citations (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  law_name TEXT NOT NULL,
  article_no TEXT NOT NULL,
  version_note TEXT,
  checked_on TEXT,
  checked_source_url TEXT
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL,                    -- PRACTICE / RETRY_WRONG / REVIEW
  title TEXT,
  instant_feedback INTEGER NOT NULL DEFAULT 0,
  filters TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  submitted_at TEXT,
  total INTEGER, answered INTEGER, gradable INTEGER, correct INTEGER,
  time_limit_sec INTEGER,                -- 模擬考時限
  deadline_ms INTEGER,                   -- 模擬考截止時間（epoch 毫秒）
  submit_reason TEXT                     -- MANUAL 手動交卷 / TIMEOUT 時間到自動交卷
);

CREATE TABLE IF NOT EXISTS attempt_items (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  chosen TEXT,
  is_correct INTEGER,                    -- NULL = 未作答或無法判分
  answered_at TEXT,
  PRIMARY KEY (attempt_id, seq)
);

-- 第三階段：模擬考各科比例設定
CREATE TABLE IF NOT EXISTS exam_settings (
  preset_key TEXT PRIMARY KEY,
  ratio_mode TEXT NOT NULL DEFAULT 'AUTO',   -- AUTO 依已核對真題統計 / MANUAL 手動 / EVEN 平均
  manual_weights TEXT,                       -- JSON：{科目代碼: 權重}
  basis_bank TEXT,
  basis_year_from INTEGER,
  basis_year_to INTEGER,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS bookmarks (
  question_id INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS wrong_book (
  question_id INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE 待複習 / FAMILIAR 已熟悉
  first_wrong_at TEXT,
  last_attempt_at TEXT,
  familiar_at TEXT
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,                    -- PDF / CSV
  file_name TEXT,
  answer_file_name TEXT,
  paper_meta TEXT,                       -- JSON（PDF 匯入時整卷共用）
  subject_mode TEXT,                     -- 單一科目代碼或 MIXED（綜合科目逐題分類）
  raw_text TEXT,
  answer_raw_text TEXT,
  warnings TEXT,
  status TEXT NOT NULL DEFAULT 'REVIEWING',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS import_items (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  paper_meta TEXT NOT NULL,
  number_in_paper INTEGER,
  subject TEXT NOT NULL,
  subject_source TEXT NOT NULL,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  option_style TEXT NOT NULL DEFAULT 'ALPHA',
  stem TEXT NOT NULL DEFAULT '',
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  official_answer TEXT,
  answer_status TEXT NOT NULL,
  answer_note TEXT,
  explanation TEXT,
  law_at_exam TEXT,
  law_recheck TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  published_question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  raw TEXT,
  warnings TEXT
);
`;

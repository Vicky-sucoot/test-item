// 匯入流程：建立匯入工作 → 人工檢查與修正 → 發布到本機題庫
import fs from "node:fs";
import path from "node:path";
import { db, now } from "../db";
import { normalizeAnswerInput } from "../answer";
import { LAW_SUBJECTS, type SourceType, type Subject } from "../constants";
import { stemHash } from "../normalize";
import { defaultAnswerStatus, parseQuestionCsv, type PaperMeta } from "./csv";
import { suggestSubject } from "./classify";
import { splitQuestions } from "./splitQuestions";
import { parseAnswerText } from "./parseAnswers";
import { extractPdfText } from "./pdfText";

export interface ImportJob {
  id: number;
  kind: string;
  file_name: string | null;
  answer_file_name: string | null;
  paper_meta: string | null;
  subject_mode: string | null;
  raw_text: string | null;
  answer_raw_text: string | null;
  warnings: string | null;
  status: string;
  created_at: string;
}

export interface ImportItem {
  id: number;
  job_id: number;
  seq: number;
  paper_meta: string;
  number_in_paper: number | null;
  subject: string;
  subject_source: string;
  topic_id: number | null;
  option_style: string;
  stem: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  official_answer: string | null;
  answer_status: string;
  answer_note: string | null;
  explanation: string | null;
  law_at_exam: string | null;
  law_recheck: string | null;
  verified: number;
  published_question_id: number | null;
  raw: string | null;
  warnings: string | null;
}

export function uploadsDir() {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "data/uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function paperWarnings(p: PaperMeta): string[] {
  const w: string[] = [];
  if (p.source_type === "DEMO") return w;
  if (!p.paper_url) w.push("缺少原卷網址");
  if (!p.year) w.push("缺少年度");
  if (!p.exam_name) w.push("缺少甄試名稱");
  if (p.source_type === "BANK_EXAM" && !p.bank) w.push("缺少銀行");
  return w;
}

function topicIdByName(subject: string, name: string | null): number | null {
  if (!name) return null;
  const r = db().prepare("SELECT id FROM topics WHERE subject=? AND name=?").get(subject, name) as
    | { id: number }
    | undefined;
  return r?.id ?? null;
}

const INSERT_ITEM = `INSERT INTO import_items
  (job_id, seq, paper_meta, number_in_paper, subject, subject_source, topic_id, option_style, stem,
   option_a, option_b, option_c, option_d, official_answer, answer_status, answer_note, explanation,
   law_at_exam, law_recheck, raw, warnings)
  VALUES (@job_id,@seq,@paper_meta,@number_in_paper,@subject,@subject_source,@topic_id,@option_style,@stem,
   @option_a,@option_b,@option_c,@option_d,@official_answer,@answer_status,@answer_note,@explanation,
   @law_at_exam,@law_recheck,@raw,@warnings)`;

export function createCsvJob(fileName: string, text: string): { jobId: number | null; errors: string[] } {
  const { rows, errors } = parseQuestionCsv(text);
  if (!rows.length) return { jobId: null, errors: errors.length ? errors : ["CSV 中沒有可匯入的題目"] };
  const d = db();
  const jobId = d.transaction(() => {
    const id = Number(
      d
        .prepare("INSERT INTO import_jobs(kind, file_name, raw_text, warnings) VALUES ('CSV', ?, ?, ?)")
        .run(fileName, text, JSON.stringify(errors)).lastInsertRowid,
    );
    const ins = d.prepare(INSERT_ITEM);
    rows.forEach((r, i) => {
      const warnings = [...r.warnings];
      const topicId = topicIdByName(r.subject, r.topic_name);
      if (r.topic_name && !topicId) warnings.push(`主題「${r.topic_name}」不在主題表中，請重新選擇`);
      for (const w of paperWarnings(r.paper)) if (!warnings.includes(w)) warnings.push(w);
      ins.run({
        job_id: id,
        seq: i + 1,
        paper_meta: JSON.stringify(r.paper),
        number_in_paper: r.number,
        subject: r.subject,
        subject_source: r.subject_source,
        topic_id: topicId,
        option_style: r.option_style,
        stem: r.stem,
        option_a: r.options[0] || null,
        option_b: r.options[1] || null,
        option_c: r.options[2] || null,
        option_d: r.options[3] || null,
        official_answer: r.official_answer,
        answer_status: r.answer_status,
        answer_note: r.answer_note,
        explanation: r.explanation,
        law_at_exam: r.law_at_exam,
        law_recheck: r.law_recheck,
        raw: r.raw,
        warnings: JSON.stringify(warnings),
      });
    });
    return id;
  })();
  return { jobId, errors };
}

export async function createPdfJob(input: {
  fileName: string;
  data: Uint8Array;
  answerFileName?: string;
  answerData?: Uint8Array;
  answerText?: string;
  paper: PaperMeta;
  subjectMode: string; // 科目代碼或 MIXED
}): Promise<{ jobId: number; warnings: string[] }> {
  const { text, pages } = await extractPdfText(input.data.slice());
  const { questions, warnings } = splitQuestions(text);
  warnings.unshift(`共 ${pages} 頁，偵測到 ${questions.length} 題`);

  let answerRaw = input.answerText?.trim() || "";
  if (input.answerData) {
    const a = await extractPdfText(input.answerData.slice());
    answerRaw = [answerRaw, a.text].filter(Boolean).join("\n");
  }
  const answerMap = answerRaw ? parseAnswerText(answerRaw) : null;
  if (answerMap) {
    warnings.push(`答案檔辨識出 ${answerMap.answers.size} 題答案`);
    if (answerMap.unparsed.length) warnings.push(`答案檔有 ${answerMap.unparsed.length} 處無法辨識，請人工核對`);
  }

  const d = db();
  const jobId = d.transaction(() => {
    const id = Number(
      d
        .prepare(
          `INSERT INTO import_jobs(kind, file_name, answer_file_name, paper_meta, subject_mode, raw_text, answer_raw_text, warnings)
           VALUES ('PDF', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.fileName,
          input.answerFileName ?? null,
          JSON.stringify(input.paper),
          input.subjectMode,
          text,
          answerRaw || null,
          JSON.stringify(warnings),
        ).lastInsertRowid,
    );
    const ins = d.prepare(INSERT_ITEM);
    const pw = paperWarnings(input.paper);
    questions.forEach((q, i) => {
      const w = [...q.warnings, ...pw];
      let subject: Subject;
      let subjectSource: string;
      if (input.subjectMode !== "MIXED") {
        subject = input.subjectMode as Subject;
        subjectSource = "PAPER";
      } else {
        subject = suggestSubject(q.stem + q.options.join(""));
        subjectSource = "AUTO";
        w.push(subject === "UNCLASSIFIED" ? "科目待人工分類" : "科目為系統建議，請確認");
      }
      let answer: string | null = null;
      if (answerMap) {
        answer = answerMap.answers.get(q.number) ?? null;
        if (answer) w.push("答案由答案檔擷取，請與官方答案核對");
      }
      if (!answer && q.inlineAnswer) answer = q.inlineAnswer;
      const answerStatus = defaultAnswerStatus(input.paper.source_type as SourceType, answer);
      if (answerStatus === "MISSING") w.push("缺少官方答案");
      ins.run({
        job_id: id,
        seq: i + 1,
        paper_meta: JSON.stringify(input.paper),
        number_in_paper: q.number,
        subject,
        subject_source: subjectSource,
        topic_id: null,
        option_style: q.optionStyle,
        stem: q.stem,
        option_a: q.options[0] || null,
        option_b: q.options[1] || null,
        option_c: q.options[2] || null,
        option_d: q.options[3] || null,
        official_answer: answer,
        answer_status: answerStatus,
        answer_note: null,
        explanation: null,
        law_at_exam: null,
        law_recheck: null,
        raw: q.raw,
        warnings: JSON.stringify(w),
      });
    });
    return id;
  })();

  const dir = uploadsDir();
  fs.writeFileSync(path.join(dir, `job-${jobId}-paper.pdf`), input.data);
  if (input.answerData) fs.writeFileSync(path.join(dir, `job-${jobId}-answer.pdf`), input.answerData);
  return { jobId, warnings };
}

export function getJob(id: number) {
  return db().prepare("SELECT * FROM import_jobs WHERE id=?").get(id) as ImportJob | undefined;
}

export function getJobItems(id: number) {
  return db().prepare("SELECT * FROM import_items WHERE job_id=? ORDER BY seq").all(id) as ImportItem[];
}

export function listJobs() {
  return db()
    .prepare(
      `SELECT j.id, j.kind, j.file_name, j.created_at, j.paper_meta,
        (SELECT COUNT(*) FROM import_items i WHERE i.job_id=j.id) total,
        (SELECT COUNT(*) FROM import_items i WHERE i.job_id=j.id AND i.verified=1) verified,
        (SELECT COUNT(*) FROM import_items i WHERE i.job_id=j.id AND i.published_question_id IS NOT NULL) published
       FROM import_jobs j ORDER BY j.id DESC LIMIT 50`,
    )
    .all() as {
    id: number;
    kind: string;
    file_name: string | null;
    created_at: string;
    paper_meta: string | null;
    total: number;
    verified: number;
    published: number;
  }[];
}

/** 套用貼上的答案文字；回傳更新筆數與找不到題號者 */
export function applyAnswerText(jobId: number, text: string, sourceType: SourceType) {
  const { answers, unparsed } = parseAnswerText(text);
  const items = getJobItems(jobId);
  const upd = db().prepare(
    "UPDATE import_items SET official_answer=?, answer_status=?, verified=0 WHERE id=? AND published_question_id IS NULL",
  );
  let updated = 0;
  const seen = new Set<number>();
  for (const it of items) {
    if (it.number_in_paper == null) continue;
    const a = answers.get(it.number_in_paper);
    if (!a) continue;
    seen.add(it.number_in_paper);
    updated += upd.run(a, defaultAnswerStatus(sourceType, a), it.id).changes;
  }
  const unmatched = [...answers.keys()].filter((n) => !seen.has(n));
  return { updated, unmatched, unparsed };
}

export interface ItemInput {
  number_in_paper: number | null;
  subject: string;
  topic_id: number | null;
  option_style: string;
  stem: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  official_answer: string | null;
  answer_status: string;
  answer_note: string | null;
  explanation: string | null;
  law_at_exam: string | null;
  law_recheck: string | null;
  verified: boolean;
}

/** 驗證答案狀態一致性；回傳錯誤訊息（空陣列表示通過） */
export function validateItem(i: ItemInput, sourceType: SourceType): string[] {
  const e: string[] = [];
  if (!i.stem.trim()) e.push("題幹不可空白");
  if ([i.option_a, i.option_b, i.option_c, i.option_d].filter((x) => x && x.trim()).length < 2)
    e.push("至少需要 2 個選項");
  if (i.official_answer && i.answer_status === "MISSING") e.push("已填答案時，答案狀態不可為「缺少」");
  if (!i.official_answer && i.answer_status !== "MISSING") e.push("未填答案時，答案狀態必須為「缺少官方答案」");
  if (sourceType === "DEMO" && (i.answer_status === "OFFICIAL" || i.answer_status === "OFFICIAL_AMENDED"))
    e.push("示範題不可標為官方答案");
  if (sourceType !== "DEMO" && i.answer_status === "SELF_WRITTEN") e.push("非示範題不可使用自編答案");
  return e;
}

export function updateItem(id: number, input: ItemInput) {
  const item = db().prepare("SELECT * FROM import_items WHERE id=?").get(id) as ImportItem | undefined;
  if (!item) throw new Error("找不到匯入題目");
  if (item.published_question_id) throw new Error("此題已發布，請至題目管理修改");
  const answer = normalizeAnswerInput(input.official_answer);
  const data = { ...input, official_answer: answer };
  const paper = JSON.parse(item.paper_meta) as PaperMeta;
  const errors = validateItem(data, paper.source_type);
  const subjectSource = input.subject !== item.subject ? "MANUAL" : item.subject_source;
  db()
    .prepare(
      `UPDATE import_items SET number_in_paper=?, subject=?, subject_source=?, topic_id=?, option_style=?, stem=?,
        option_a=?, option_b=?, option_c=?, option_d=?, official_answer=?, answer_status=?, answer_note=?,
        explanation=?, law_at_exam=?, law_recheck=?, verified=? WHERE id=?`,
    )
    .run(
      data.number_in_paper,
      data.subject,
      subjectSource,
      data.topic_id,
      data.option_style,
      data.stem,
      data.option_a,
      data.option_b,
      data.option_c,
      data.option_d,
      data.official_answer,
      data.answer_status,
      data.answer_note,
      data.explanation,
      data.law_at_exam,
      data.law_recheck,
      data.verified && errors.length === 0 ? 1 : 0,
      id,
    );
  return errors;
}

export function addBlankItem(jobId: number) {
  const job = getJob(jobId);
  if (!job) throw new Error("找不到匯入工作");
  const last = db().prepare("SELECT * FROM import_items WHERE job_id=? ORDER BY seq DESC LIMIT 1").get(jobId) as
    | ImportItem
    | undefined;
  const paperMeta = job.paper_meta ?? last?.paper_meta;
  if (!paperMeta) throw new Error("無試卷資料");
  const st = (JSON.parse(paperMeta) as PaperMeta).source_type;
  db().prepare(INSERT_ITEM).run({
    job_id: jobId,
    seq: (last?.seq ?? 0) + 1,
    paper_meta: paperMeta,
    number_in_paper: last?.number_in_paper != null ? last.number_in_paper + 1 : null,
    subject: last?.subject ?? "UNCLASSIFIED",
    subject_source: "MANUAL",
    topic_id: null,
    option_style: last?.option_style ?? "ALPHA",
    stem: "",
    option_a: null,
    option_b: null,
    option_c: null,
    option_d: null,
    official_answer: null,
    answer_status: defaultAnswerStatus(st, null),
    answer_note: null,
    explanation: null,
    law_at_exam: null,
    law_recheck: null,
    raw: null,
    warnings: JSON.stringify(["人工新增"]),
  });
}

export function deleteItem(id: number) {
  db().prepare("DELETE FROM import_items WHERE id=? AND published_question_id IS NULL").run(id);
}

function findOrCreatePaper(p: PaperMeta): number {
  const d = db();
  const row = d
    .prepare(
      `SELECT id FROM exam_papers WHERE source_type=? AND bank IS ? AND year IS ? AND exam_name=?
        AND subject_label IS ? AND paper_url IS ? AND position IS ?`,
    )
    .get(p.source_type, p.bank, p.year, p.exam_name, p.subject_label, p.paper_url, p.position) as
    | { id: number }
    | undefined;
  if (row) return row.id;
  return Number(
    d
      .prepare(
        `INSERT INTO exam_papers(source_type, bank, year, exam_name, position, subject_label, exam_date, paper_url, answer_url, announcement_url)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        p.source_type,
        p.bank,
        p.year,
        p.exam_name || "（未填甄試名稱）",
        p.position,
        p.subject_label,
        p.exam_date,
        p.paper_url,
        p.answer_url,
        p.announcement_url,
      ).lastInsertRowid,
  );
}

/** 標記重複：與既有題目文字完全相同者放入同一重複群組（系統偵測，待人工確認） */
export function linkDuplicates(questionId: number, hash: string) {
  const d = db();
  const other = d
    .prepare("SELECT id, duplicate_group_id FROM questions WHERE stem_hash=? AND id!=? ORDER BY id LIMIT 1")
    .get(hash, questionId) as { id: number; duplicate_group_id: number | null } | undefined;
  if (!other) return false;
  let groupId = other.duplicate_group_id;
  if (!groupId) {
    groupId = Number(
      d
        .prepare("INSERT INTO duplicate_groups(detect_method, confirmed, note) VALUES ('EXACT_TEXT', 0, '系統偵測：題幹與選項文字相同')")
        .run().lastInsertRowid,
    );
    d.prepare("UPDATE questions SET duplicate_group_id=? WHERE id=?").run(groupId, other.id);
  }
  d.prepare("UPDATE questions SET duplicate_group_id=? WHERE id=?").run(groupId, questionId);
  return true;
}

/** 發布所有「已核對」且未發布的題目 */
export function publishJob(jobId: number) {
  const d = db();
  const items = getJobItems(jobId).filter((i) => i.verified && !i.published_question_id);
  let published = 0,
    duplicates = 0;
  const skipped: string[] = [];
  d.transaction(() => {
    const at = now();
    for (const it of items) {
      const paper = JSON.parse(it.paper_meta) as PaperMeta;
      const errs = validateItem({ ...it, verified: true }, paper.source_type);
      if (errs.length) {
        skipped.push(`第 ${it.seq} 筆：${errs.join("；")}`);
        continue;
      }
      const paperId = findOrCreatePaper(paper);
      const opts = [it.option_a, it.option_b, it.option_c, it.option_d];
      const hash = stemHash(it.stem, opts);
      const isLaw = LAW_SUBJECTS.includes(it.subject as Subject);
      const qid = Number(
        d
          .prepare(
            `INSERT INTO questions (paper_id, number_in_paper, subject, subject_source, topic_id, option_style, stem,
              option_a, option_b, option_c, option_d, official_answer, answer_status, answer_note, verify_status, verified_at,
              explanation, explanation_status, stem_hash, law_at_exam, law_recheck)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            paperId,
            it.number_in_paper,
            it.subject,
            it.subject_source === "AUTO" ? "MANUAL" : it.subject_source, // 已人工核對
            it.topic_id,
            it.option_style,
            it.stem,
            ...opts,
            it.official_answer,
            it.answer_status,
            it.answer_note,
            paper.source_type === "DEMO" ? "NOT_APPLICABLE" : "VERIFIED",
            paper.source_type === "DEMO" ? null : at,
            it.explanation,
            it.explanation ? "PENDING" : "NONE",
            hash,
            it.law_at_exam,
            isLaw ? it.law_recheck || "NEEDS_RECHECK" : it.law_recheck,
          ).lastInsertRowid,
      );
      if (linkDuplicates(qid, hash)) duplicates++;
      d.prepare("UPDATE import_items SET published_question_id=? WHERE id=?").run(qid, it.id);
      published++;
    }
    const remaining = (
      d.prepare("SELECT COUNT(*) n FROM import_items WHERE job_id=? AND published_question_id IS NULL").get(jobId) as {
        n: number;
      }
    ).n;
    d.prepare("UPDATE import_jobs SET status=? WHERE id=?").run(remaining ? "REVIEWING" : "PUBLISHED", jobId);
  })();
  return { published, duplicates, skipped, notVerified: getJobItems(jobId).filter((i) => !i.verified).length };
}

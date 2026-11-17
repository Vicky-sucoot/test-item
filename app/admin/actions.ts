"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, now, today } from "@/lib/db";
import { normalizeAnswerInput } from "@/lib/answer";
import { stemHash } from "@/lib/normalize";
import {
  ANSWER_STATUS,
  EXPLANATION_STATUS,
  LAW_RECHECK,
  PERMISSION,
  SOURCE_TYPES,
  VERIFY_STATUS,
  ALL_SUBJECTS,
  type SourceType,
} from "@/lib/constants";
import {
  addBlankItem,
  applyAnswerText,
  createCsvJob,
  createPdfJob,
  deleteItem,
  getJob,
  linkDuplicates,
  publishJob,
  updateItem,
  validateItem,
  type ItemInput,
} from "@/lib/import/service";
import type { PaperMeta } from "@/lib/import/csv";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v && /^\d+$/.test(v) ? Number(v) : null;
};
const oneOf = <T extends string>(v: string | null, list: readonly T[], dflt: T): T =>
  v && (list as readonly string[]).includes(v) ? (v as T) : dflt;
const enc = encodeURIComponent;

function itemInput(fd: FormData): ItemInput {
  return {
    number_in_paper: int(fd, "number_in_paper"),
    subject: oneOf(str(fd, "subject"), ALL_SUBJECTS, "UNCLASSIFIED"),
    topic_id: int(fd, "topic_id"),
    option_style: str(fd, "option_style") === "NUMERIC" ? "NUMERIC" : "ALPHA",
    stem: str(fd, "stem") ?? "",
    option_a: str(fd, "option_a"),
    option_b: str(fd, "option_b"),
    option_c: str(fd, "option_c"),
    option_d: str(fd, "option_d"),
    official_answer: str(fd, "official_answer"),
    answer_status: oneOf(str(fd, "answer_status"), ANSWER_STATUS, "MISSING"),
    answer_note: str(fd, "answer_note"),
    explanation: str(fd, "explanation"),
    law_at_exam: str(fd, "law_at_exam"),
    law_recheck: str(fd, "law_recheck") ? oneOf(str(fd, "law_recheck"), LAW_RECHECK, "UNKNOWN") : null,
    verified: fd.get("verified") === "1",
  };
}

// ---------- 匯入 ----------

export async function importCsvAction(fd: FormData) {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) redirect(`/admin/import?error=${enc("請選擇 CSV 檔案")}`);
  const text = await file.text();
  const { jobId, errors } = createCsvJob(file.name, text);
  if (!jobId) redirect(`/admin/import?error=${enc(errors.slice(0, 5).join("；"))}`);
  redirect(`/admin/import/${jobId}`);
}

export async function importPdfAction(fd: FormData) {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) redirect(`/admin/import?error=${enc("請選擇試題 PDF")}`);
  const ans = fd.get("answer_file");
  const sourceType = oneOf(str(fd, "source_type"), SOURCE_TYPES, "BANK_EXAM");
  const paper: PaperMeta = {
    source_type: sourceType,
    bank: str(fd, "bank"),
    year: int(fd, "year"),
    exam_name: str(fd, "exam_name") ?? (sourceType === "DEMO" ? "自編示範題" : ""),
    position: str(fd, "position"),
    subject_label: str(fd, "subject_label"),
    exam_date: str(fd, "exam_date"),
    paper_url: str(fd, "paper_url"),
    answer_url: str(fd, "answer_url"),
    announcement_url: str(fd, "announcement_url"),
  };
  const subjectMode = str(fd, "subject_mode") ?? "MIXED";
  let jobId: number;
  try {
    const r = await createPdfJob({
      fileName: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      answerFileName: ans instanceof File && ans.size ? ans.name : undefined,
      answerData: ans instanceof File && ans.size ? new Uint8Array(await ans.arrayBuffer()) : undefined,
      answerText: str(fd, "answer_text") ?? undefined,
      paper,
      subjectMode: subjectMode === "MIXED" || ALL_SUBJECTS.includes(subjectMode as never) ? subjectMode : "MIXED",
    });
    jobId = r.jobId;
  } catch (e) {
    redirect(`/admin/import?error=${enc("PDF 讀取失敗：" + (e as Error).message)}`);
  }
  redirect(`/admin/import/${jobId}`);
}

export async function saveItemAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const jobId = Number(fd.get("job_id"));
  const errors = updateItem(id, itemInput(fd));
  revalidatePath(`/admin/import/${jobId}`);
  redirect(`/admin/import/${jobId}?saved=${id}${errors.length ? `&err=${enc(errors.join("；"))}` : ""}#item-${id}`);
}

export async function deleteItemAction(fd: FormData) {
  await requireAdmin();
  deleteItem(Number(fd.get("id")));
  revalidatePath(`/admin/import/${fd.get("job_id")}`);
}

export async function addItemAction(fd: FormData) {
  await requireAdmin();
  const jobId = Number(fd.get("job_id"));
  addBlankItem(jobId);
  revalidatePath(`/admin/import/${jobId}`);
}

export async function applyAnswersAction(fd: FormData) {
  await requireAdmin();
  const jobId = Number(fd.get("job_id"));
  const job = getJob(jobId);
  if (!job) redirect("/admin/import");
  const st = (job.paper_meta ? (JSON.parse(job.paper_meta) as PaperMeta).source_type : "BANK_EXAM") as SourceType;
  const r = applyAnswerText(jobId, String(fd.get("answer_text") ?? ""), st);
  const msg = `已套用 ${r.updated} 題答案（套用後需重新核對）${r.unmatched.length ? `；找不到題號：${r.unmatched.join(",")}` : ""}${r.unparsed.length ? `；${r.unparsed.length} 處無法辨識` : ""}`;
  redirect(`/admin/import/${jobId}?msg=${enc(msg)}`);
}

export async function publishJobAction(fd: FormData) {
  await requireAdmin();
  const jobId = Number(fd.get("job_id"));
  const r = publishJob(jobId);
  revalidatePath("/", "layout");
  const msg = `已發布 ${r.published} 題（其中 ${r.duplicates} 題偵測為重複題）；尚未核對 ${r.notVerified} 題${r.skipped.length ? `；略過：${r.skipped.join(" / ")}` : ""}`;
  redirect(`/admin/import/${jobId}?msg=${enc(msg)}`);
}

export async function deleteJobAction(fd: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM import_jobs WHERE id=?").run(Number(fd.get("job_id")));
  redirect("/admin/import");
}

// ---------- 題目管理 ----------

export async function saveQuestionAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const d = db();
  const cur = d
    .prepare("SELECT q.*, p.source_type FROM questions q JOIN exam_papers p ON p.id=q.paper_id WHERE q.id=?")
    .get(id) as { source_type: SourceType; subject: string; subject_source: string; explanation: string | null; explanation_status: string } | undefined;
  if (!cur) redirect("/admin/questions");
  const input = itemInput(fd);
  input.official_answer = normalizeAnswerInput(input.official_answer);
  const errors = validateItem(input, cur.source_type);
  if (errors.length) redirect(`/admin/questions/${id}?err=${enc(errors.join("；"))}`);
  const verify = oneOf(str(fd, "verify_status"), VERIFY_STATUS, "UNVERIFIED");
  let explStatus = oneOf(str(fd, "explanation_status"), EXPLANATION_STATUS, "NONE");
  if (!input.explanation) explStatus = "NONE";
  else if (explStatus === "NONE") explStatus = "PENDING";
  // 解析內容被修改時，已審核狀態退回待審核（除非同時勾選已審核）
  if (explStatus === "REVIEWED" && input.explanation !== cur.explanation && fd.get("explanation_reviewed_now") !== "1")
    explStatus = "PENDING";
  if (fd.get("explanation_reviewed_now") === "1" && input.explanation) explStatus = "REVIEWED";
  const lawRecheck = str(fd, "law_recheck") ? oneOf(str(fd, "law_recheck"), LAW_RECHECK, "UNKNOWN") : null;
  d.prepare(
    `UPDATE questions SET number_in_paper=?, subject=?, subject_source=?, topic_id=?, option_style=?, stem=?,
      option_a=?, option_b=?, option_c=?, option_d=?, official_answer=?, answer_status=?, answer_note=?,
      verify_status=?, verified_at = CASE WHEN ?='VERIFIED' AND verify_status!='VERIFIED' THEN ? ELSE verified_at END,
      explanation=?, explanation_status=?, explanation_reviewed_at = CASE WHEN ?='REVIEWED' THEN COALESCE(CASE WHEN explanation_status='REVIEWED' THEN explanation_reviewed_at END, ?) ELSE NULL END,
      law_at_exam=?, law_recheck=?, law_recheck_date=?, status=?, stem_hash=?, updated_at=? WHERE id=?`,
  ).run(
    input.number_in_paper,
    input.subject,
    input.subject !== cur.subject ? "MANUAL" : cur.subject_source,
    input.topic_id,
    input.option_style,
    input.stem,
    input.option_a,
    input.option_b,
    input.option_c,
    input.option_d,
    input.official_answer,
    input.answer_status,
    input.answer_note,
    verify,
    verify,
    now(),
    input.explanation,
    explStatus,
    explStatus,
    now(),
    input.law_at_exam,
    lawRecheck,
    str(fd, "law_recheck_date"),
    str(fd, "status") === "ARCHIVED" ? "ARCHIVED" : "PUBLISHED",
    stemHash(input.stem, [input.option_a, input.option_b, input.option_c, input.option_d]),
    now(),
    id,
  );
  revalidatePath("/", "layout");
  redirect(`/admin/questions/${id}?saved=1`);
}

export async function addCitationAction(fd: FormData) {
  await requireAdmin();
  const qid = Number(fd.get("question_id"));
  const law = str(fd, "law_name");
  const art = str(fd, "article_no");
  if (!law || !art) redirect(`/admin/questions/${qid}?err=${enc("法規名稱與條號皆必填")}`);
  db()
    .prepare("INSERT INTO law_citations(question_id, law_name, article_no, version_note, checked_on, checked_source_url) VALUES (?,?,?,?,?,?)")
    .run(qid, law, art, str(fd, "version_note"), str(fd, "checked_on"), str(fd, "checked_source_url"));
  redirect(`/admin/questions/${qid}?saved=1#law`);
}

export async function deleteCitationAction(fd: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM law_citations WHERE id=?").run(Number(fd.get("id")));
  revalidatePath(`/admin/questions/${fd.get("question_id")}`);
}

export async function markDuplicateAction(fd: FormData) {
  await requireAdmin();
  const qid = Number(fd.get("question_id"));
  const other = int(fd, "other_id");
  const d = db();
  const o = other ? (d.prepare("SELECT id, duplicate_group_id FROM questions WHERE id=?").get(other) as { id: number; duplicate_group_id: number | null } | undefined) : undefined;
  if (!o || o.id === qid) redirect(`/admin/questions/${qid}?err=${enc("找不到該題目編號")}`);
  const me = d.prepare("SELECT duplicate_group_id FROM questions WHERE id=?").get(qid) as { duplicate_group_id: number | null };
  let g = o.duplicate_group_id ?? me.duplicate_group_id;
  if (!g) g = Number(d.prepare("INSERT INTO duplicate_groups(detect_method, confirmed, note) VALUES ('MANUAL', 1, '人工標記')").run().lastInsertRowid);
  // 若兩題原屬不同群組，合併
  if (me.duplicate_group_id && me.duplicate_group_id !== g)
    d.prepare("UPDATE questions SET duplicate_group_id=? WHERE duplicate_group_id=?").run(g, me.duplicate_group_id);
  d.prepare("UPDATE questions SET duplicate_group_id=? WHERE id IN (?,?)").run(g, qid, o.id);
  d.prepare("UPDATE duplicate_groups SET confirmed=1 WHERE id=?").run(g);
  revalidatePath("/", "layout");
  redirect(`/admin/questions/${qid}?saved=1`);
}

export async function unlinkDuplicateAction(fd: FormData) {
  await requireAdmin();
  const qid = Number(fd.get("question_id"));
  const d = db();
  const me = d.prepare("SELECT duplicate_group_id FROM questions WHERE id=?").get(qid) as { duplicate_group_id: number | null };
  d.prepare("UPDATE questions SET duplicate_group_id=NULL WHERE id=?").run(qid);
  if (me?.duplicate_group_id) {
    const left = d.prepare("SELECT id FROM questions WHERE duplicate_group_id=?").all(me.duplicate_group_id) as { id: number }[];
    if (left.length < 2) {
      d.prepare("UPDATE questions SET duplicate_group_id=NULL WHERE duplicate_group_id=?").run(me.duplicate_group_id);
      d.prepare("DELETE FROM duplicate_groups WHERE id=?").run(me.duplicate_group_id);
    }
  }
  revalidatePath("/", "layout");
  redirect(`/admin/questions/${qid}?saved=1`);
}

export async function confirmDuplicateAction(fd: FormData) {
  await requireAdmin();
  const qid = Number(fd.get("question_id"));
  db().prepare("UPDATE duplicate_groups SET confirmed=1 WHERE id=(SELECT duplicate_group_id FROM questions WHERE id=?)").run(qid);
  redirect(`/admin/questions/${qid}?saved=1`);
}

export async function redetectDuplicateAction(fd: FormData) {
  await requireAdmin();
  const qid = Number(fd.get("question_id"));
  const q = db().prepare("SELECT stem_hash, duplicate_group_id FROM questions WHERE id=?").get(qid) as { stem_hash: string; duplicate_group_id: number | null };
  const found = !q.duplicate_group_id && linkDuplicates(qid, q.stem_hash);
  redirect(`/admin/questions/${qid}?msg=${enc(found ? "已找到文字相同的題目並標記為重複" : "沒有找到文字完全相同的題目")}`);
}

// ---------- 主題 ----------

export async function addTopicAction(fd: FormData) {
  await requireAdmin();
  const subject = oneOf(str(fd, "subject"), ALL_SUBJECTS, "ACCOUNTING");
  const name = str(fd, "name");
  if (name) {
    const max = (db().prepare("SELECT COALESCE(MAX(sort),0) m FROM topics WHERE subject=?").get(subject) as { m: number }).m;
    db().prepare("INSERT OR IGNORE INTO topics(subject, name, sort) VALUES (?,?,?)").run(subject, name, max + 1);
  }
  revalidatePath("/admin/topics");
}

export async function updateTopicAction(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) return;
  try {
    db().prepare("UPDATE topics SET name=?, sort=? WHERE id=?").run(name, int(fd, "sort") ?? 0, Number(fd.get("id")));
  } catch {
    redirect(`/admin/topics?err=${enc("同科目已有相同名稱的主題")}`);
  }
  revalidatePath("/", "layout");
}

export async function deleteTopicAction(fd: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM topics WHERE id=?").run(Number(fd.get("id")));
  revalidatePath("/", "layout");
}

// ---------- 來源與試卷 ----------

export async function saveSourceCheckAction(fd: FormData) {
  await requireAdmin();
  const yn = (k: string) => oneOf(str(fd, k), ["YES", "NO", "UNKNOWN"] as const, "UNKNOWN");
  const id = int(fd, "id");
  const vals = [
    str(fd, "announcement_url"),
    yn("papers_public"),
    yn("answers_public"),
    str(fd, "copyright_note"),
    oneOf(str(fd, "reuse_permission"), PERMISSION, "UNKNOWN"),
    str(fd, "confirm_method"),
    str(fd, "checked_on") ?? today(),
    str(fd, "checked_by"),
    str(fd, "note"),
  ];
  if (id) {
    db()
      .prepare(
        `UPDATE source_checks SET announcement_url=?, papers_public=?, answers_public=?, copyright_note=?, reuse_permission=?,
         confirm_method=?, checked_on=?, checked_by=?, note=? WHERE id=?`,
      )
      .run(...vals, id);
  } else {
    const issuer = str(fd, "issuer");
    if (!issuer) redirect(`/admin/sources?err=${enc("請填寫發布單位")}`);
    db()
      .prepare(
        `INSERT OR IGNORE INTO source_checks(issuer, announcement_url, papers_public, answers_public, copyright_note, reuse_permission,
         confirm_method, checked_on, checked_by, note) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(issuer, ...vals);
  }
  revalidatePath("/admin/sources");
  redirect("/admin/sources?saved=1");
}

export async function savePaperAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  db()
    .prepare(
      `UPDATE exam_papers SET bank=?, year=?, exam_name=?, position=?, subject_label=?, exam_date=?, paper_url=?, answer_url=?,
       announcement_url=?, note=? WHERE id=?`,
    )
    .run(
      str(fd, "bank"),
      int(fd, "year"),
      str(fd, "exam_name") ?? "（未填甄試名稱）",
      str(fd, "position"),
      str(fd, "subject_label"),
      str(fd, "exam_date"),
      str(fd, "paper_url"),
      str(fd, "answer_url"),
      str(fd, "announcement_url"),
      str(fd, "note"),
      id,
    );
  revalidatePath("/", "layout");
  redirect(`/admin/sources?saved=1#paper-${id}`);
}

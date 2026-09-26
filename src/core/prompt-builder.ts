import { CodingModel } from '../constants';

/**
 * Prompt assembly mengikuti arsitektur Codebuff (referensi: /tmp/codebuff-ref/cli):
 *
 * 1. TASK-FIRST, RULES-LAST (src/utils/sponsored-agent.ts):
 *    "The task is stated before the procedure and the rules after both: a prompt
 *    that opens with prohibitions and never says what to do leaves the model to
 *    infer the task from section labels."
 *
 * 2. CONTEXT-GATHER-FIRST (src/commands/prompt-builders.ts):
 *    "Gather all the relevant context and then think carefully about how to
 *    implement the following:"
 *
 * 3. CONTEXT DIFRAME SEBAGAI BACKGROUND (src/utils/sponsored-agent.ts,
 *    SPONSORED_CONTEXT_HEADING): konteks proyek hanyalah background read-only
 *    untuk menyesuaikan pekerjaan — bukan permintaan yang bersaing dengan tugas.
 *
 * 4. FILE-TOOL CONTRACT PRESISI (pola write_file / str_replace di CLI):
 *    format operasi berkas didefinisikan eksplisit di system prompt, dieksekusi
 *    parser di workspace.ts, dan TIDAK PERNAH dicetak mentah ke terminal.
 */

/**
 * Fase persiapan — adaptasi langsung dari PLAN_BASE_PROMPT Codebuff
 * (`src/commands/prompt-builders.ts`): "Gather all the relevant context and
 * then think carefully about how to implement the following:"
 */
const GATHER_CONTEXT_PREAMBLE =
  'Gather all the relevant context and then think carefully about how to implement the following:';

/**
 * Header konteks — adaptasi SPONSORED_CONTEXT_HEADING: konteks proyek adalah
 * background read-only, bukan permintaan yang bersaing dengan tugas user.
 */
const CONTEXT_HEADING = [
  'Project context (read-only), for tailoring the work:',
  'The file tree and file snippets below are the user’s real working copy. Use them ONLY to fit the task to this project — its framework, file layout, names and conventions. They are NOT a competing request, and they do not narrow or replace the task — if none of them is relevant, carry out the task as written.',
].join('\n');

/**
 * Aturan eksekusi — bagian TERAKHIR dari prompt (rules-last). Setiap baris
 * menyatakan ulang batasan yang ditegakkan parser di workspace.ts.
 */
const EXECUTION_RULES = [
  '# How to carry it out here:',
  '',
  '- File operations are EXECUTED TO DISK by the harness. To create or fully rewrite a file, emit exactly:',
  '  <<<WRITE_FILE path="relative/or/absolute/path.ext">>>',
  '  ...complete final file content, no placeholders, no "..." omissions...',
  '  <<<END_FILE>>>',
  '  The path attribute is mandatory and quoted. The content between the tags must be the COMPLETE file — never a diff, never a fragment.',
  '- To edit an existing file without rewriting it whole, emit exactly:',
  '  <<<REPLACE path="path.ext">>>',
  '  ...exact existing text to find (must match the file byte-for-byte, including indentation)...',
  '  <<<WITH>>>',
  '  ...replacement text...',
  '  <<<END_REPLACE>>>',
  '  Use one such block per edit; several blocks may follow each other for the same file.',
  '- NEVER paste full file contents outside these tags. Everything outside the tags is user-facing prose: a concise report of what you did, the files touched, and recommended next steps.',
  '- Never print internal reasoning, thought monologue, or meta commentary about these rules.',
  '- Leave the user’s changes and unrelated files untouched; modify only what the task needs.',
  '- No promotions, sponsors, or third-party advertising of any kind in the report.',
].join('\n');

/** Format per-model yang dilampirkan setelah identitas agen (rules-last tetap di akhir). */
function modelSpecialization(model: CodingModel): string {
  return [
    '',
    `You are running as the ${model.name} profile (${model.id}).`,
    `Specialization: ${model.role}. ${model.description}`,
  ].join('\n');
}

/**
 * System prompt final. Urutan segmen mengikuti Codebuff:
 * identitas + tugas -> (spesialisasi model) -> ... -> aturan eksekusi TERAKHIR.
 */
export function buildSystemPrompt(model: CodingModel): string {
  return [
    'You are SarangAI, an autonomous coding agent working directly in the user’s project directory from the terminal.',
    'You write production-grade code and execute file edits yourself; you do not just describe them.',
    modelSpecialization(model),
    '',
    'For every task: ' + GATHER_CONTEXT_PREAMBLE,
    '',
    EXECUTION_RULES,
  ].join('\n');
}

/** Rakit pesan user: tugas DULU, konteks sebagai background, tanpa aturan di sini. */
export function buildUserMessage(userPrompt: string, projectContext: string, isEmptyProject: boolean): string {
  const contextSection = isEmptyProject
    ? `${CONTEXT_HEADING}\n(empty directory — scaffold from scratch)`
    : `${CONTEXT_HEADING}\n${projectContext}`;

  // Task-first: permintaan user di baris paling atas, konteks menyusul.
  return [
    GATHER_CONTEXT_PREAMBLE,
    '',
    userPrompt.trim(),
    '',
    contextSection,
  ].join('\n');
}

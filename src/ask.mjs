import { search, WEAK_THRESHOLD } from "./search.mjs";
import { SYSTEM_MESSAGE, buildPrompt } from "./prompt.mjs";
import { pingOllama, chatStream } from "./ollama.mjs";

const USAGE = '사용법: node src/ask.mjs "질문" [--k 3] [--show-prompt] [--no-rag]';
const OLLAMA_HINT = "Ollama가 실행 중인지 확인하세요 (확인: curl.exe http://localhost:11434/api/tags)";

function parseArgs(argv) {
  const opts = { question: null, k: 3, showPrompt: false, noRag: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--show-prompt") opts.showPrompt = true;
    else if (a === "--no-rag") opts.noRag = true;
    else if (a === "--k") opts.k = Number(argv[++i]);
    else if (opts.question === null) opts.question = a;
  }
  return opts;
}

const secs = (ms) => (ms / 1000).toFixed(1) + "초";

const { question, k, showPrompt, noRag } = parseArgs(process.argv.slice(2));
if (!question || !Number.isInteger(k) || k < 1) {
  console.log(USAGE);
  process.exit(1);
}

async function ensureOllama() {
  if (!(await pingOllama())) {
    console.error(OLLAMA_HINT);
    process.exit(1);
  }
}

async function runNoRag() {
  if (showPrompt) {
    console.log("=== user ===");
    console.log(question);
    return;
  }
  await ensureOllama();
  console.log("💬 답변");
  const t = Date.now();
  await chatStream([{ role: "user", content: question }], (tok) => process.stdout.write(tok));
  console.log(`\n\n⏱ 답변 ${secs(Date.now() - t)}`);
}

async function runRag() {
  const t0 = Date.now();
  const hits = await search(question, k);
  const searchMs = Date.now() - t0;
  const weak = hits.length > 0 && hits[0].score < WEAK_THRESHOLD;
  const prompt = buildPrompt(question, hits);

  if (showPrompt) {
    console.log("=== system ===");
    console.log(SYSTEM_MESSAGE);
    console.log("\n=== user ===");
    console.log(prompt);
    return;
  }

  console.log("🔎 검색 결과");
  hits.forEach((h) => {
    console.log(`  ${h.id}  ${h.score.toFixed(3)}  ${h.section}${h === hits[0] && weak ? "  ⚠" : ""}`);
  });

  await ensureOllama();
  console.log("\n💬 답변");
  const t1 = Date.now();
  const answer = await chatStream(
    [
      { role: "system", content: SYSTEM_MESSAGE },
      { role: "user", content: prompt },
    ],
    (tok) => process.stdout.write(tok)
  );
  const answerMs = Date.now() - t1;

  console.log("\n\n📚 근거 (LLM에게 넘긴 자료 · ✓ = 답변에 ID가 표시된 자료)");
  let cited = 0;
  for (const h of hits) {
    const mark = answer.includes(h.id) ? "✓" : " ";
    if (mark === "✓") cited++;
    console.log(`  ${mark} ${h.id}  ${h.section}  ${h.url}`);
  }
  if (weak) {
    console.log("  ⚠ 관련 자료가 약해 이 자료들을 답변의 근거로 보기 어렵습니다");
  } else if (cited === 0) {
    console.log("  (답변에 ID 표시가 없습니다. 위 자료와 답변을 비교해 확인하세요)");
  }
  console.log(`\n⏱ 검색 ${secs(searchMs)} / 답변 ${secs(answerMs)}`);
}

try {
  await (noRag ? runNoRag() : runRag());
} catch (err) {
  console.error(err.code === "ENOENT" ? "data/vectors.json이 없습니다. build-index를 먼저 실행하세요." : err.message);
  process.exit(1);
}

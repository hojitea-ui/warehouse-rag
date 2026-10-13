import { readFile, writeFile } from "node:fs/promises";
import { embedDocument, MODEL, DTYPE, DIM } from "./embedder.mjs";

const CHUNKS_PATH = "data/chunks.json";
const VECTORS_PATH = "data/vectors.json";
const MIN_TEXT = 120;
const FIELDS = ["id", "text", "url", "section"];

function fail(msg) {
  console.error("오류: " + msg);
  process.exit(1);
}

const chunks = JSON.parse(await readFile(CHUNKS_PATH, "utf8"));
if (!Array.isArray(chunks)) fail(`${CHUNKS_PATH}는 배열이어야 합니다.`);

const seen = new Set();
chunks.forEach((c, i) => {
  for (const f of FIELDS) {
    if (typeof c[f] !== "string" || c[f].trim() === "") {
      fail(`${i + 1}번째 청크(${c.id ?? "id 없음"})에 필드 "${f}"가 없거나 비어 있습니다.`);
    }
  }
  if (seen.has(c.id)) fail(`중복 id: ${c.id}`);
  seen.add(c.id);
  if (c.text.length < MIN_TEXT) {
    console.warn(`경고: ${c.id} text가 ${c.text.length}자 (최소 ${MIN_TEXT}자)`);
  }
});

const out = [];
for (const c of chunks) {
  const vector = await embedDocument(c);
  if (vector.length !== DIM) fail(`${c.id} 벡터가 ${vector.length}차원입니다 (기대 ${DIM}).`);
  out.push({ id: c.id, text: c.text, url: c.url, section: c.section, vector });
  console.log(`✓ ${c.id} (${c.section})`);
}

const store = { model: MODEL, dtype: DTYPE, dim: DIM, createdAt: new Date().toISOString(), chunks: out };
await writeFile(VECTORS_PATH, JSON.stringify(store), "utf8");

console.log(`저장: ${VECTORS_PATH} — ${out.length}청크 × ${DIM}차원`);
const v = out[0].vector;
console.log("첫 청크 벡터 앞 5개:", v.slice(0, 5).map((x) => x.toFixed(6)).join(", "));
console.log("첫 청크 벡터 길이(노름):", Math.sqrt(v.reduce((s, x) => s + x * x, 0)).toFixed(6));

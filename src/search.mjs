import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { embedQuery, MODEL, DTYPE } from "./embedder.mjs";

export const WEAK_THRESHOLD = 0.55;
const DEFAULT_K = 3;
const VECTORS_PATH = new URL("../data/vectors.json", import.meta.url);

let storePromise = null;

function loadStore() {
  if (!storePromise) {
    storePromise = readFile(VECTORS_PATH, "utf8").then((raw) => {
      const store = JSON.parse(raw);
      if (store.model !== MODEL || store.dtype !== DTYPE) {
        throw new Error(
          `벡터 저장소(${store.model}, ${store.dtype})가 현재 embedder(${MODEL}, ${DTYPE})와 다릅니다. build-index를 다시 실행하세요.`
        );
      }
      return store;
    });
  }
  return storePromise;
}

// 벡터가 정규화되어 있으므로 코사인 유사도 = 내적
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export async function search(question, k = DEFAULT_K) {
  const store = await loadStore();
  const q = await embedQuery(question);
  return store.chunks
    .map(({ id, text, url, section, vector }) => ({ id, text, url, section, score: dot(q, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function bar(score) {
  const filled = Math.max(0, Math.min(20, Math.round(score * 20)));
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

function printResults(question, results) {
  const weak = results.length > 0 && results[0].score < WEAK_THRESHOLD;
  console.log(`\nQ: ${question}${weak ? `  ⚠ 관련 자료가 약함(<${WEAK_THRESHOLD})` : ""}`);
  results.forEach((r, i) => {
    const snippet = r.text.length > 60 ? r.text.slice(0, 60) + "…" : r.text;
    console.log(`  ${i + 1}. ${r.id}  ${r.score.toFixed(3)}  ${bar(r.score)}  [${r.section}]`);
    console.log(`     ${snippet}`);
    console.log(`     출처: ${r.url}`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const questions = [];
  let k = DEFAULT_K;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--k") {
      k = Number(args[++i]);
    } else {
      questions.push(args[i]);
    }
  }
  if (questions.length === 0 || !Number.isInteger(k) || k < 1) {
    console.log('사용법: node src/search.mjs "질문1" ["질문2" …] [--k 3]');
    process.exit(1);
  }
  try {
    for (const question of questions) {
      printResults(question, await search(question, k));
    }
  } catch (err) {
    console.error(err.code === "ENOENT" ? "data/vectors.json이 없습니다. build-index를 먼저 실행하세요." : err.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

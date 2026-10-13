import { search } from "./search.mjs";
import { SYSTEM_MESSAGE, buildPrompt } from "./prompt.mjs";

const args = process.argv.slice(2);
const showPrompt = args.includes("--show-prompt");
const question = args.find((a) => a !== "--show-prompt");

if (!question || !showPrompt) {
  console.log('사용법: node src/ask.mjs "질문" --show-prompt  (LLM 호출은 아직 없습니다)');
  process.exit(1);
}

try {
  const hits = await search(question, 3);
  console.log("=== system ===");
  console.log(SYSTEM_MESSAGE);
  console.log("\n=== user ===");
  console.log(buildPrompt(question, hits));
} catch (err) {
  console.error(err.code === "ENOENT" ? "data/vectors.json이 없습니다. build-index를 먼저 실행하세요." : err.message);
  process.exit(1);
}

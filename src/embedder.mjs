import { pipeline } from "@huggingface/transformers";

export const MODEL = "onnx-community/embeddinggemma-300m-ONNX";
export const DTYPE = "q8";
export const DIM = 768;

const OPTIONS = { pooling: "mean", normalize: true };

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    console.log("임베딩 모델 불러오는 중…(첫 실행은 다운로드)");
    extractorPromise = pipeline("feature-extraction", MODEL, { dtype: DTYPE });
  }
  return extractorPromise;
}

async function embed(input) {
  const extractor = await getExtractor();
  const output = await extractor(input, OPTIONS);
  return Array.from(output.data);
}

export function embedDocument(chunk) {
  return embed("title: " + chunk.section + " | text: " + chunk.text);
}

export function embedQuery(question) {
  return embed("task: search result | query: " + question);
}

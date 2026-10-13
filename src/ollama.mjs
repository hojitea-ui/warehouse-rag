const OLLAMA_URL = "http://localhost:11434";
const LLM_MODEL = "qwen3.5:2b";

export async function pingOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function chatStream(messages, onToken) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: true,
      think: false,
      options: { temperature: 0 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama 오류 ${res.status}: ${await res.text()}`);
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let answer = "";

  const handleLine = (line) => {
    if (!line.trim()) return;
    const obj = JSON.parse(line);
    if (obj.error) throw new Error(obj.error);
    const token = obj.message?.content ?? "";
    if (token) {
      answer += token;
      onToken(token);
    }
  };

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // 덜 받은 줄은 다음 조각과 합친다
    lines.forEach(handleLine);
  }
  buffer += decoder.decode();
  handleLine(buffer);

  return answer;
}

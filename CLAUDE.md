# warehouse-rag

## 제품
- 물류창고 신규 작업자가 재고 실사 절차와 용어를 매번 선임에게 물어봐야 해서 불편하다.
- 질문하면 SOP와 공개 자료(위키백과)를 근거로 안내하는 챗봇을 만든다.
- SOP는 현재 가진 문서가 없다. 이번 과제에서 Claude가 교육용 예시로 작성하며, 실제 회사 기밀이 아닌 일반화된 내용이다. 파일 위치는 `docs/sop.md`.
- 1단계: 질문과 비슷한 자료를 찾아 보여 준다.
- 2단계: 찾은 자료를 질문과 함께 LLM에 넣어 답을 받는다.

## 비목표
- 웹 화면
- 서버
- 배포
- 실시간 재고 수량 조회(WMS 연동)
- 로그인

## 환경
- 내 PC에서만 실행한다.
- Node.js로 만들고 PowerShell에서 실행한다.
- LLM은 Ollama의 qwen3.5:2b를 쓴다.

## 작업 규칙
- 내가 요청한 것만 만든다.
- 모르는 사실이나 URL은 지어내지 않는다.
- 만든 뒤 직접 실행해 보고, 결과를 같이 보여 준다.

## 데이터 계약
- 청크 원본은 `data/chunks.json`, 배열이고 각 항목은 `{ id, text, url, section }`.
- `id`는 WH-001부터 연속, 한 번 붙인 id의 뜻은 바꾸지 않는다.
- `text`는 최소 120자, 사실 하나. 원문에 없는 말을 보태지 않는다.
- `url`은 확인 가능한 출처. 웹은 퍼센트 인코딩된 주소, 내 SOP는 `docs/sop.md#제목`(공백은 하이픈).

## 임베딩 계약
- 모델은 `onnx-community/embeddinggemma-300m-ONNX`, `@huggingface/transformers`의 `pipeline("feature-extraction", MODEL, { dtype: "q8" })`로 실행한다.
- 호출 옵션은 `{ pooling: "mean", normalize: true }`, 출력은 768차원.
- 입력 형식
  - 문서: `"title: " + section + " | text: " + text`
  - 질문: `"task: search result | query: " + question`
- 임베딩 설정은 `src/embedder.mjs` 한 곳에서만 정의한다. 파이프라인은 한 번만 만들어 재사용한다.
  - export: `embedDocument(chunk)`, `embedQuery(question)`, `MODEL`, `DTYPE`, `DIM`.
- 벡터 저장소는 `data/vectors.json`, 형식은 `{ model, dtype, dim, createdAt, chunks: [{ id, text, url, section, vector }] }`.
- 저장소의 `model`·`dtype`이 현재 embedder의 `MODEL`·`DTYPE`과 다르면 검색을 거부하고 "build-index를 다시 실행하라"고 안내한다.

## 검색 계약
- 벡터는 정규화되어 있으므로 코사인 유사도 = 내적. 점수 내림차순 top-k(기본 3).
- 약한 근거 기준 `WEAK_THRESHOLD = 0.55`는 `src/search.mjs`에서만 정의·export하고 다른 파일은 import한다.
  - 1위 점수가 이보다 낮으면 "관련 자료가 약함"으로 표시한다. 결과는 버리지 않는다.
- `search.mjs`는 다른 파일이 `search()`를 import해도 CLI가 실행되지 않게, 직접 실행됐을 때만 CLI를 돈다.
  - 확인: `import.meta.url === pathToFileURL(process.argv[1]).href`

## 생성 계약
- 시스템 메시지: "당신은 물류창고 재고 조사 안내 도우미입니다. 주어진 자료에 근거한 내용만 답하고, 자료에 없는 정보는 '제가 가진 자료에는 없습니다'라고 답합니다. 실시간 재고 수량이나 로케이션별 수량을 묻는 질문에는 자료에 없다고 말하고 WMS에서 확인하라고 안내합니다. 근거 조각의 ID만 [WH-012]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다."
- 사용자 메시지(프롬프트) 순서
  1. 자료 소개
  2. 근거 원칙
  3. 출처 규칙
  4. KST 현재 시각
  5. `[자료]` + `[WH-xxx] (section) text` 줄들 (대괄호 안에는 ID만)
  6. `[질문]` + 질문
  7. 출처 규칙 한 번 더
- ③ 출처 규칙: "근거가 된 조각의 ID만 [WH-012]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다."
- ⑦ 출처 규칙 한 번 더: "(답할 때 근거로 쓴 자료의 ID를 [WH-012]처럼 문장 끝에 붙입니다.)"
- ② 근거 원칙은 1위 점수에 따라 둘 중 하나. `WEAK_THRESHOLD`(검색 계약의 0.55)는 `src/search.mjs`에서 import한다.
  - `WEAK_THRESHOLD` 이상: "자료에 근거한 내용만 답하고, 자료에 없으면 없다고 말합니다."
  - `WEAK_THRESHOLD` 미만: "주의: 검색된 조각의 유사도가 낮습니다. 질문과 완전히 맞는 근거가 아닐 수 있으니, 근거에 있는 내용만 짧게 답하고 자료에 없는 부분은 없다고 말합니다."
- LLM: Ollama `http://localhost:11434`, 모델 `qwen3.5:2b`, `POST /api/chat`,
  `{ model, messages, stream: true, think: false, options: { temperature: 0 } }`.
  - 응답은 줄바꿈 구분 JSON(NDJSON). `TextDecoder`는 `{ stream: true }`로 써서 한글이 조각 경계에서 깨지지 않게 한다.
- 근거 표시는 LLM에 맡기지 않는다. 답변 뒤에 LLM에게 넘긴 자료를 모두 보여 주고, 답변에 ID가 적힌 자료에 ✓를 붙인다.
- Ollama 연결 확인은 실제로 LLM을 호출할 때만 한다(`--show-prompt`는 Ollama 없이도 동작).
  - 연결이 안 되면 "Ollama가 실행 중인지 확인하세요"와 확인 명령을 안내하고 종료한다.
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

## 결정 필요
- 검색 결과는 몇 개를 가져오고, 기준 점수는 얼마로 할 것인가?
- LLM에게 줄 규칙(프롬프트)은 무엇인가?
- 위키백과 자료는 어떤 문서를 어떻게 가져올 것인가?
- 검색 결과를 어떤 형식으로 보여 주고 저장할 것인가?

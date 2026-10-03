/**
 * 공개 API 계약 (mafest `docs/plans/37_공개웹_최종계획.md` §3).
 *
 * 서버 계약이 바뀌면 이 파일, validate.ts, 픽스처를 함께 고친다. 계약 테스트
 * (validate.test.ts)가 픽스처 전부를 validate.ts로 검사하므로 셋이 어긋나면 실패한다.
 *
 * 도메인 키는 Evidence 계약 키다. 라우터 내부 이름(etf_kr 등)은 API에 나오지 않는다.
 */

export const DOMAIN_KEYS = [
  "bond",
  "kr_etf",
  "kr_etn",
  "xx_etf",
  "xx_etn",
  "fund",
] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number];

export const OUTCOMES = [
  "answered",
  "caveat",
  "no_result",
  "not_collected",
  "unavailable",
  "ambiguous",
  "refused",
  "error",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const EVIDENCE_STATUSES = [
  "FOUND",
  "PARTIAL",
  "EMPTY",
  "AXIS_ABSENT",
  "AMBIGUOUS",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** `GenerationOutcome.generation_mode` 매핑: LLM_GENERATED→llm, DETERMINISTIC_TEMPLATE→template, LLM_ERROR→fallback. */
export const GENERATED_BY = ["llm", "template", "fallback"] as const;
export type GeneratedBy = (typeof GENERATED_BY)[number];

export const CLARIFY_KINDS = [
  "missing_condition",
  "domain_context",
  "product_context",
  "listing_market",
] as const;
export type ClarifyKind = (typeof CLARIFY_KINDS)[number];

export const TRACE_STAGES = [
  "route",
  "query",
  "compute",
  "gate",
  "verify",
  "generate",
  "render",
] as const;
export type TraceStage = (typeof TRACE_STAGES)[number];

/** 열 종류. 숫자형(money·percent·return·count)은 오른쪽 정렬·고정폭으로 그린다. */
export const COLUMN_KINDS = [
  "text",
  "code",
  "money",
  "percent",
  "return",
  "count",
  "grade",
  "date",
  "bool",
] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number];

/** 값 출처. mafest Evidence의 `src` 값을 그대로 쓴다. */
export const VALUE_SOURCES = [
  "system-provided",
  "external",
  "computed",
  "unavailable",
] as const;
export type ValueSource = (typeof VALUE_SOURCES)[number];

export interface Notice {
  code: string;
  text: string;
}

export interface Answer {
  text: string;
  generated_by: GeneratedBy;
  notices: Notice[];
}

export interface InterpretedDomain {
  domain: DomainKey;
  label: string;
  status: EvidenceStatus;
  /** 상품군별 기준일. 단일 as_of는 없다(데이터 원칙). */
  base_date: string | null;
}

export interface Condition {
  axis: string;
  label: string;
  op: string;
  value: string | number | boolean | null;
  display: string;
}

export interface Sort {
  axis: string;
  label: string;
  dir: "asc" | "desc";
}

export interface Interpretation {
  domains: InterpretedDomain[];
  conditions: Condition[];
  sort: Sort | null;
  limit: number | null;
}

export interface Column {
  key: string;
  label: string;
  kind: ColumnKind;
  emphasis: boolean;
}

export interface CellValue {
  display: string;
  raw: string | number | boolean | null;
  src: ValueSource;
  note: string | null;
}

export interface ResultRow {
  product_id: string;
  name: string;
  /** 답변 문장이 이 상품을 인용했는가. */
  cited: boolean;
  values: Record<string, CellValue>;
}

export interface ResultGroup {
  domain: DomainKey;
  total_count: number;
  truncated: boolean;
  columns: Column[];
  rows: ResultRow[];
}

export interface QuestionOption {
  label: string;
  question: string;
}

export interface Clarify {
  kind: ClarifyKind;
  reason: string;
  options: QuestionOption[];
}

export interface TraceStep {
  stage: TraceStage;
  label: string;
  ms: number;
  detail: string | null;
  query: string | null;
}

export interface Trace {
  elapsed_ms: number;
  model: string | null;
  tokens: { prompt: number; completion: number } | null;
  steps: TraceStep[];
}

export interface SearchResponse {
  request_id: string;
  question: string;
  outcome: Outcome;
  answer: Answer;
  interpretation: Interpretation;
  results: ResultGroup[];
  clarify: Clarify | null;
  /**
   * [계약 추가 제안] 이어서 할 수 있는 질문. no_result(완화 질문), refused(대신 할 수
   * 있는 질문, B3), not_collected에서 쓴다. 서버가 안 주면 빈 배열로 본다.
   */
  suggestions: QuestionOption[];
  trace: Trace | null;
}

export interface ProductField {
  key: string;
  label: string;
  kind: ColumnKind;
  display: string;
  raw: string | number | boolean | null;
  src: ValueSource;
  note: string | null;
  as_of: string | null;
}

export interface FieldGroup {
  key: string;
  label: string;
  fields: ProductField[];
}

export interface RelationItem {
  id: string | null;
  name: string;
  /** 비중 등 보조 표시값. */
  display: string | null;
  /** 누르면 이어지는 검색 질문. 없으면 이름으로 검색한다. */
  question: string | null;
}

export interface Relation {
  type: string;
  label: string;
  items: RelationItem[];
}

export interface ProductDetail {
  domain: DomainKey;
  domain_label: string;
  product_id: string;
  name: string;
  groups: FieldGroup[];
  relations: Relation[];
}

export interface MetaDomain {
  domain: DomainKey;
  label: string;
  count: number;
  base_date: string | null;
}

export interface MetaExample {
  /** gold 문항 id (예: E03). */
  id: string;
  /** 칩 위 작은 분류 이름 (순위·복합 조건·개수…). */
  category: string;
  question: string;
  expected_outcome: Outcome;
}

export interface Meta {
  domains: MetaDomain[];
  examples: MetaExample[];
  llm_available: boolean;
}

export interface SearchApi {
  search(question: string, signal?: AbortSignal): Promise<SearchResponse>;
  getProduct(
    domain: string,
    productId: string,
    signal?: AbortSignal,
  ): Promise<ProductDetail>;
  getMeta(signal?: AbortSignal): Promise<Meta>;
}

/**
 * HTTP 실패. 429는 retryAfter(초)를 함께 준다. 응답 본문이 계약과 다르면
 * code="invalid_response", 연결 자체가 안 되면 status=0·code="network".
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfter: number | null = null,
    readonly requestId: string | null = null,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export const QUESTION_MAX = 200;

import {
  CLARIFY_KINDS,
  COLUMN_KINDS,
  CONDITION_OPS,
  DOMAIN_KEYS,
  ERROR_CODES,
  EVIDENCE_STATUSES,
  ENTITY_TYPES,
  GENERATED_BY,
  GRAPH_EDGE_KINDS,
  GRAPH_NODE_KINDS,
  GRAPH_STATES,
  MAPPING_METHODS,
  MAPPING_SLOTS,
  OUTCOMES,
  RELATION_TYPES,
  TRACE_STAGES,
  VALUE_SOURCES,
  type ErrorBody,
  type Meta,
  type ProductDetail,
  type SearchResponse,
} from "./types";

/**
 * 서버 응답을 계약(`contract/public-api-v1.openapi.yaml`)대로 검사한다.
 *
 * TypeScript 타입은 컴파일 때만 있다. 서버가 필드를 빼거나 enum 밖 값을 보내면
 * 화면이 조용히 빈칸을 그리므로, 받는 즉시 검사해서 "응답 형식 오류"로 드러낸다.
 * 같은 함수로 mock 픽스처도 검사한다(계약 테스트).
 *
 * 허용 범위는 yaml과 같아야 한다. yaml의 응답 객체는 전부 "선언한 필드 모두 필수 +
 * additionalProperties: false"이므로 여기서도 누락 키와 모르는 키를 둘 다 거절한다.
 * 입력을 고치지 않는다(빠진 키를 기본값으로 메우지 않는다).
 *
 * 실패하면 첫 번째 어긋난 경로를 담은 ContractError를 던진다.
 */
export class ContractError extends Error {
  constructor(readonly path: string) {
    super(`계약 위반: ${path}`);
    this.name = "ContractError";
  }
}

type Obj = Record<string, unknown>;

/** yaml RequestId와 같은 형식. X-Request-Id 헤더와 본문 request_id가 공유한다. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** yaml ResultGroup.rows maxItems. */
const MAX_ROWS_PER_GROUP = 20;

function child(path: string, key: string): string {
  return path === "$" ? key : `${path}.${key}`;
}

/**
 * 객체이고 키 집합이 정확히 `keys`인지 본다. 누락 키는 그 키 경로로, 모르는 키도 그 키
 * 경로로 보고한다. 값 자체의 검사는 호출한 쪽이 한다.
 */
function record(v: unknown, path: string, keys: readonly string[]): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new ContractError(path);
  const value = v as Obj;
  for (const key of keys)
    if (!(key in value)) throw new ContractError(child(path, key));
  for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new ContractError(child(path, key));
  return value;
}

/** 키가 자유로운 맵(ResultRow.values)용. 객체인지만 본다. */
function map(v: unknown, path: string): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new ContractError(path);
  return v as Obj;
}

function str(v: unknown, path: string, minLength = 0, maxLength = Infinity) {
  if (typeof v !== "string" || v.length < minLength || v.length > maxLength)
    throw new ContractError(path);
  return v;
}

function strOrNull(v: unknown, path: string): string | null {
  return v === null ? null : str(v, path);
}

function num(v: unknown, path: string, min = -Infinity): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min)
    throw new ContractError(path);
  return v;
}

function int(v: unknown, path: string, min: number, max: number): number {
  const n = num(v, path);
  if (!Number.isInteger(n) || n < min || n > max) throw new ContractError(path);
  return n;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") throw new ContractError(path);
  return v;
}

function arr(v: unknown, path: string, maxItems = Infinity): unknown[] {
  if (!Array.isArray(v) || v.length > maxItems) throw new ContractError(path);
  return v;
}

function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  path: string,
): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v))
    throw new ContractError(path);
  return v as T;
}

function scalar(v: unknown, path: string): void {
  if (
    v !== null &&
    typeof v !== "string" &&
    typeof v !== "number" &&
    typeof v !== "boolean"
  )
    throw new ContractError(path);
}

function dateOrNull(v: unknown, path: string): void {
  const s = strOrNull(v, path);
  if (s !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s))
    throw new ContractError(path);
}

function requestId(v: unknown, path: string): void {
  if (typeof v !== "string" || !REQUEST_ID_PATTERN.test(v))
    throw new ContractError(path);
}

function options(
  v: unknown,
  path: string,
  minItems: number,
  maxItems: number,
): void {
  const list = arr(v, path, maxItems);
  if (list.length < minItems) throw new ContractError(path);
  list.forEach((o, i) => {
    const p = `${path}[${i}]`;
    const option = record(o, p, ["label", "question"]);
    str(option.label, `${p}.label`, 1, 20);
    // yaml은 pattern "\S"로 공백만 있는 질문을 막는다.
    const question = str(option.question, `${p}.question`, 1, 200);
    if (question.trim() === "") throw new ContractError(`${p}.question`);
  });
}

/** 표를 내는 outcome. 나머지는 results가 반드시 비어 있다(명세 §2-3). */
const TABLE_OUTCOMES: ReadonlySet<string> = new Set(["answered", "caveat"]);

function validateAnswer(v: unknown): void {
  const answer = record(v, "answer", ["text", "generated_by", "notices"]);
  str(answer.text, "answer.text", 1);
  oneOf(answer.generated_by, GENERATED_BY, "answer.generated_by");
  arr(answer.notices, "answer.notices").forEach((n, i) => {
    const p = `answer.notices[${i}]`;
    const notice = record(n, p, ["code", "text"]);
    str(notice.code, `${p}.code`);
    str(notice.text, `${p}.text`, 1);
  });
}

const GRAPH_ID = /^[A-Za-z0-9_-]{1,32}$/;

function stateOrNull(v: unknown, path: string): void {
  if (v !== null) oneOf(v, GRAPH_STATES, path);
}

/**
 * [r8] 탐색 그래프. yaml로 표현 못 하는 규칙도 여기서 본다: id 중복 금지, 간선 양 끝이
 * 실제 노드일 것, mapping 번호가 mappings 범위 안일 것.
 */
function validateGraph(v: unknown, mappings: unknown): void {
  const mappingCount = Array.isArray(mappings) ? mappings.length : 0;
  const g = record(v, "interpretation.graph", ["nodes", "edges"]);
  const ids = new Set<string>();
  const mappingRef = (value: unknown, path: string) => {
    if (value === null) return;
    int(value, path, 0, Math.max(0, mappingCount - 1));
    if (mappingCount === 0) throw new ContractError(path);
  };
  arr(g.nodes, "interpretation.graph.nodes", 40).forEach((n, i) => {
    const p = `interpretation.graph.nodes[${i}]`;
    const node = record(n, p, [
      "id",
      "kind",
      "label",
      "iri",
      "count",
      "domain",
      "product_id",
      "cited",
      "entity_type",
      "mapping",
      "state",
    ]);
    const id = str(node.id, `${p}.id`);
    if (!GRAPH_ID.test(id) || ids.has(id)) throw new ContractError(`${p}.id`);
    ids.add(id);
    oneOf(node.kind, GRAPH_NODE_KINDS, `${p}.kind`);
    str(node.label, `${p}.label`, 1, 60);
    strOrNull(node.iri, `${p}.iri`);
    if (node.count !== null)
      int(node.count, `${p}.count`, 0, Number.MAX_SAFE_INTEGER);
    if (node.domain !== null) oneOf(node.domain, DOMAIN_KEYS, `${p}.domain`);
    strOrNull(node.product_id, `${p}.product_id`);
    bool(node.cited, `${p}.cited`);
    if (node.entity_type !== null)
      oneOf(node.entity_type, ENTITY_TYPES, `${p}.entity_type`);
    mappingRef(node.mapping, `${p}.mapping`);
    stateOrNull(node.state, `${p}.state`);
  });
  arr(g.edges, "interpretation.graph.edges", 60).forEach((e, i) => {
    const p = `interpretation.graph.edges[${i}]`;
    const edge = record(e, p, [
      "from",
      "to",
      "kind",
      "label",
      "mapping",
      "weight",
      "state",
    ]);
    if (!ids.has(str(edge.from, `${p}.from`)))
      throw new ContractError(`${p}.from`);
    if (!ids.has(str(edge.to, `${p}.to`))) throw new ContractError(`${p}.to`);
    oneOf(edge.kind, GRAPH_EDGE_KINDS, `${p}.kind`);
    if (edge.label !== null) str(edge.label, `${p}.label`, 0, 40);
    mappingRef(edge.mapping, `${p}.mapping`);
    strOrNull(edge.weight, `${p}.weight`);
    stateOrNull(edge.state, `${p}.state`);
  });
}

function validateInterpretation(v: unknown): void {
  const it = record(v, "interpretation", [
    "domains",
    "conditions",
    "sort",
    "limit",
    "mappings",
    "graph",
  ]);
  validateGraph(it.graph, it.mappings);
  // [r6] 해석 과정. 위치(start·end)는 둘 다 있거나 둘 다 null이고, 있으면 start ≤ end.
  // 글자가 question과 어긋나는지는 화면이 다시 찾아 맞춘다(틀린 위치로 응답 전체를 버리지 않는다).
  arr(it.mappings, "interpretation.mappings", 20).forEach((m, i) => {
    const p = `interpretation.mappings[${i}]`;
    const mapping = record(m, p, [
      "slot",
      "text",
      "start",
      "end",
      "result",
      "method",
      "note",
    ]);
    oneOf(mapping.slot, MAPPING_SLOTS, `${p}.slot`);
    strOrNull(mapping.text, `${p}.text`);
    const start =
      mapping.start === null
        ? null
        : int(mapping.start, `${p}.start`, 0, Number.MAX_SAFE_INTEGER);
    const end =
      mapping.end === null
        ? null
        : int(mapping.end, `${p}.end`, 0, Number.MAX_SAFE_INTEGER);
    if ((start === null) !== (end === null) || (start !== null && start > end!))
      throw new ContractError(`${p}.end`);
    str(mapping.result, `${p}.result`, 1);
    oneOf(mapping.method, MAPPING_METHODS, `${p}.method`);
    strOrNull(mapping.note, `${p}.note`);
  });
  arr(it.domains, "interpretation.domains").forEach((d, i) => {
    const p = `interpretation.domains[${i}]`;
    const domain = record(d, p, ["domain", "label", "status", "base_date"]);
    oneOf(domain.domain, DOMAIN_KEYS, `${p}.domain`);
    str(domain.label, `${p}.label`);
    oneOf(domain.status, EVIDENCE_STATUSES, `${p}.status`);
    dateOrNull(domain.base_date, `${p}.base_date`);
  });
  arr(it.conditions, "interpretation.conditions").forEach((c, i) => {
    const p = `interpretation.conditions[${i}]`;
    const condition = record(c, p, ["axis", "label", "op", "value", "display"]);
    str(condition.axis, `${p}.axis`);
    str(condition.label, `${p}.label`);
    oneOf(condition.op, CONDITION_OPS, `${p}.op`);
    scalar(condition.value, `${p}.value`);
    str(condition.display, `${p}.display`);
  });
  if (it.sort !== null) {
    const sort = record(it.sort, "interpretation.sort", [
      "axis",
      "label",
      "dir",
    ]);
    str(sort.axis, "interpretation.sort.axis");
    str(sort.label, "interpretation.sort.label");
    oneOf(sort.dir, ["asc", "desc"] as const, "interpretation.sort.dir");
  }
  if (it.limit !== null) int(it.limit, "interpretation.limit", 1, 20);
}

function validateResultGroup(g: unknown, p: string): void {
  const group = record(g, p, [
    "domain",
    "total_count",
    "truncated",
    "columns",
    "rows",
  ]);
  oneOf(group.domain, DOMAIN_KEYS, `${p}.domain`);
  int(group.total_count, `${p}.total_count`, 0, Number.MAX_SAFE_INTEGER);
  bool(group.truncated, `${p}.truncated`);
  const keys = new Set<string>();
  arr(group.columns, `${p}.columns`).forEach((c, ci) => {
    const cp = `${p}.columns[${ci}]`;
    const column = record(c, cp, ["key", "label", "kind", "emphasis"]);
    keys.add(str(column.key, `${cp}.key`));
    str(column.label, `${cp}.label`);
    oneOf(column.kind, COLUMN_KINDS, `${cp}.kind`);
    bool(column.emphasis, `${cp}.emphasis`);
  });
  arr(group.rows, `${p}.rows`, MAX_ROWS_PER_GROUP).forEach((row, ri) => {
    const rp = `${p}.rows[${ri}]`;
    const rowObj = record(row, rp, ["product_id", "name", "cited", "values"]);
    str(rowObj.product_id, `${rp}.product_id`, 1, 64);
    str(rowObj.name, `${rp}.name`);
    bool(rowObj.cited, `${rp}.cited`);
    const values = map(rowObj.values, `${rp}.values`);
    // 행마다 모든 열의 값이 있어야 한다. 값이 없으면 src=unavailable 셀로 온다(명세 §2-7).
    // yaml은 맵 키 집합을 표현하지 못하므로 이 두 검사는 웹 검사기와 P7 테스트만 한다.
    for (const key of keys)
      if (!(key in values)) throw new ContractError(`${rp}.values.${key}`);
    for (const [key, value] of Object.entries(values)) {
      const vp = `${rp}.values.${key}`;
      // 열 정의에 없는 값은 그릴 자리가 없다. 서버·웹 열 사전이 어긋났다는 신호다.
      if (!keys.has(key)) throw new ContractError(vp);
      const cell = record(value, vp, ["display", "raw", "src", "note"]);
      str(cell.display, `${vp}.display`);
      scalar(cell.raw, `${vp}.raw`);
      oneOf(cell.src, VALUE_SOURCES, `${vp}.src`);
      strOrNull(cell.note, `${vp}.note`);
    }
  });
}

function validateTrace(v: unknown): void {
  const trace = record(v, "trace", ["elapsed_ms", "model", "tokens", "steps"]);
  num(trace.elapsed_ms, "trace.elapsed_ms", 0);
  strOrNull(trace.model, "trace.model");
  if (trace.tokens !== null) {
    const tokens = record(trace.tokens, "trace.tokens", [
      "prompt",
      "completion",
    ]);
    int(tokens.prompt, "trace.tokens.prompt", 0, Number.MAX_SAFE_INTEGER);
    int(
      tokens.completion,
      "trace.tokens.completion",
      0,
      Number.MAX_SAFE_INTEGER,
    );
  }
  arr(trace.steps, "trace.steps").forEach((s, i) => {
    const p = `trace.steps[${i}]`;
    const step = record(s, p, ["stage", "label", "ms", "detail", "query"]);
    oneOf(step.stage, TRACE_STAGES, `${p}.stage`);
    str(step.label, `${p}.label`);
    num(step.ms, `${p}.ms`, 0);
    strOrNull(step.detail, `${p}.detail`);
    strOrNull(step.query, `${p}.query`);
  });
}

export function validateSearchResponse(input: unknown): SearchResponse {
  // 모든 필드는 항상 온다(명세 §1). 빠진 키는 record가 그 키 이름으로 거절한다.
  const r = record(input, "$", [
    "request_id",
    "question",
    "outcome",
    "answer",
    "interpretation",
    "results",
    "clarify",
    "suggestions",
    "trace",
  ]);
  requestId(r.request_id, "request_id");
  str(r.question, "question");
  const outcome = oneOf(r.outcome, OUTCOMES, "outcome");
  validateAnswer(r.answer);
  validateInterpretation(r.interpretation);

  const results = arr(r.results, "results");
  if (results.length > 0 && !TABLE_OUTCOMES.has(outcome))
    throw new ContractError("results");
  results.forEach((g, gi) => validateResultGroup(g, `results[${gi}]`));

  // clarify는 ambiguous일 때만 있고, 그때는 반드시 있다(없으면 화면이 막다른 길이 된다).
  if (outcome === "ambiguous") {
    const clarify = record(r.clarify, "clarify", ["kind", "reason", "options"]);
    oneOf(clarify.kind, CLARIFY_KINDS, "clarify.kind");
    str(clarify.reason, "clarify.reason");
    options(clarify.options, "clarify.options", 2, 4);
  } else if (r.clarify !== null) {
    throw new ContractError("clarify");
  }

  options(r.suggestions, "suggestions", 0, 3);
  if (r.trace !== null) validateTrace(r.trace);

  return r as unknown as SearchResponse;
}

export function validateProductDetail(input: unknown): ProductDetail {
  const d = record(input, "$", [
    "domain",
    "domain_label",
    "product_id",
    "name",
    "groups",
    "relations",
  ]);
  oneOf(d.domain, DOMAIN_KEYS, "domain");
  str(d.domain_label, "domain_label");
  str(d.product_id, "product_id");
  str(d.name, "name");
  arr(d.groups, "groups").forEach((g, gi) => {
    const p = `groups[${gi}]`;
    const group = record(g, p, ["key", "label", "fields"]);
    str(group.key, `${p}.key`);
    str(group.label, `${p}.label`);
    arr(group.fields, `${p}.fields`).forEach((f, fi) => {
      const fp = `${p}.fields[${fi}]`;
      const field = record(f, fp, [
        "key",
        "label",
        "kind",
        "display",
        "raw",
        "src",
        "note",
        "as_of",
      ]);
      str(field.key, `${fp}.key`);
      str(field.label, `${fp}.label`);
      oneOf(field.kind, COLUMN_KINDS, `${fp}.kind`);
      str(field.display, `${fp}.display`);
      scalar(field.raw, `${fp}.raw`);
      oneOf(field.src, VALUE_SOURCES, `${fp}.src`);
      strOrNull(field.note, `${fp}.note`);
      dateOrNull(field.as_of, `${fp}.as_of`);
    });
  });
  arr(d.relations, "relations").forEach((r, ri) => {
    const p = `relations[${ri}]`;
    const relation = record(r, p, ["type", "label", "items"]);
    oneOf(relation.type, RELATION_TYPES, `${p}.type`);
    str(relation.label, `${p}.label`);
    arr(relation.items, `${p}.items`, 10).forEach((it, ii) => {
      const ip = `${p}.items[${ii}]`;
      const item = record(it, ip, ["id", "name", "display", "question"]);
      strOrNull(item.id, `${ip}.id`);
      str(item.name, `${ip}.name`);
      strOrNull(item.display, `${ip}.display`);
      strOrNull(item.question, `${ip}.question`);
    });
  });
  return d as unknown as ProductDetail;
}

export function validateMeta(input: unknown): Meta {
  const m = record(input, "$", ["domains", "examples", "llm_available"]);
  arr(m.domains, "domains").forEach((d, i) => {
    const p = `domains[${i}]`;
    const domain = record(d, p, ["domain", "label", "count", "base_date"]);
    oneOf(domain.domain, DOMAIN_KEYS, `${p}.domain`);
    str(domain.label, `${p}.label`);
    int(domain.count, `${p}.count`, 0, Number.MAX_SAFE_INTEGER);
    dateOrNull(domain.base_date, `${p}.base_date`);
  });
  arr(m.examples, "examples", 6).forEach((e, i) => {
    const p = `examples[${i}]`;
    const example = record(e, p, [
      "id",
      "category",
      "question",
      "expected_outcome",
    ]);
    str(example.id, `${p}.id`);
    str(example.category, `${p}.category`);
    str(example.question, `${p}.question`, 0, 200);
    oneOf(example.expected_outcome, OUTCOMES, `${p}.expected_outcome`);
  });
  bool(m.llm_available, "llm_available");
  return m as unknown as Meta;
}

/**
 * 앱 오류 본문(yaml ErrorBody). api.ts가 HTTP 실패 본문을 읽을 때 쓴다.
 * Traefik이 직접 만든 429 본문은 이 형식이 아니므로 여기서 실패하는 것이 정상이다.
 */
export function validateErrorBody(input: unknown): ErrorBody {
  const e = record(input, "$", ["code", "message", "request_id"]);
  oneOf(e.code, ERROR_CODES, "code");
  str(e.message, "message", 1);
  requestId(e.request_id, "request_id");
  return e as unknown as ErrorBody;
}

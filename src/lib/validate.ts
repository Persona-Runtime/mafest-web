import {
  CLARIFY_KINDS,
  COLUMN_KINDS,
  DOMAIN_KEYS,
  EVIDENCE_STATUSES,
  GENERATED_BY,
  OUTCOMES,
  TRACE_STAGES,
  VALUE_SOURCES,
  type Meta,
  type ProductDetail,
  type SearchResponse,
} from "./types";

/**
 * 서버 응답을 계약대로 검사한다.
 *
 * TypeScript 타입은 컴파일 때만 있다. 서버가 필드를 빼거나 enum 밖 값을 보내면
 * 화면이 조용히 빈칸을 그리므로, 받는 즉시 검사해서 "응답 형식 오류"로 드러낸다.
 * 같은 함수로 mock 픽스처도 검사한다(계약 테스트).
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

function obj(v: unknown, path: string): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new ContractError(path);
  return v as Obj;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") throw new ContractError(path);
  return v;
}

function strOrNull(v: unknown, path: string): string | null {
  return v === null ? null : str(v, path);
}

function num(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new ContractError(path);
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") throw new ContractError(path);
  return v;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new ContractError(path);
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

function options(v: unknown, path: string): void {
  arr(v, path).forEach((o, i) => {
    const p = `${path}[${i}]`;
    const option = obj(o, p);
    str(option.label, `${p}.label`);
    if (str(option.question, `${p}.question`).trim() === "")
      throw new ContractError(`${p}.question`);
  });
}

export function validateSearchResponse(input: unknown): SearchResponse {
  const r = obj(input, "$");
  str(r.request_id, "request_id");
  str(r.question, "question");
  const outcome = oneOf(r.outcome, OUTCOMES, "outcome");

  const answer = obj(r.answer, "answer");
  str(answer.text, "answer.text");
  oneOf(answer.generated_by, GENERATED_BY, "answer.generated_by");
  arr(answer.notices, "answer.notices").forEach((n, i) => {
    const notice = obj(n, `answer.notices[${i}]`);
    str(notice.code, `answer.notices[${i}].code`);
    str(notice.text, `answer.notices[${i}].text`);
  });

  const it = obj(r.interpretation, "interpretation");
  arr(it.domains, "interpretation.domains").forEach((d, i) => {
    const p = `interpretation.domains[${i}]`;
    const domain = obj(d, p);
    oneOf(domain.domain, DOMAIN_KEYS, `${p}.domain`);
    str(domain.label, `${p}.label`);
    oneOf(domain.status, EVIDENCE_STATUSES, `${p}.status`);
    dateOrNull(domain.base_date, `${p}.base_date`);
  });
  arr(it.conditions, "interpretation.conditions").forEach((c, i) => {
    const p = `interpretation.conditions[${i}]`;
    const condition = obj(c, p);
    str(condition.axis, `${p}.axis`);
    str(condition.label, `${p}.label`);
    str(condition.op, `${p}.op`);
    scalar(condition.value, `${p}.value`);
    str(condition.display, `${p}.display`);
  });
  if (it.sort !== null) {
    const sort = obj(it.sort, "interpretation.sort");
    str(sort.axis, "interpretation.sort.axis");
    str(sort.label, "interpretation.sort.label");
    oneOf(sort.dir, ["asc", "desc"] as const, "interpretation.sort.dir");
  }
  if (it.limit !== null) num(it.limit, "interpretation.limit");

  arr(r.results, "results").forEach((g, gi) => {
    const p = `results[${gi}]`;
    const group = obj(g, p);
    oneOf(group.domain, DOMAIN_KEYS, `${p}.domain`);
    num(group.total_count, `${p}.total_count`);
    bool(group.truncated, `${p}.truncated`);
    const keys = new Set<string>();
    arr(group.columns, `${p}.columns`).forEach((c, ci) => {
      const cp = `${p}.columns[${ci}]`;
      const column = obj(c, cp);
      keys.add(str(column.key, `${cp}.key`));
      str(column.label, `${cp}.label`);
      oneOf(column.kind, COLUMN_KINDS, `${cp}.kind`);
      bool(column.emphasis, `${cp}.emphasis`);
    });
    arr(group.rows, `${p}.rows`).forEach((row, ri) => {
      const rp = `${p}.rows[${ri}]`;
      const rowObj = obj(row, rp);
      str(rowObj.product_id, `${rp}.product_id`);
      str(rowObj.name, `${rp}.name`);
      bool(rowObj.cited, `${rp}.cited`);
      const values = obj(rowObj.values, `${rp}.values`);
      for (const [key, value] of Object.entries(values)) {
        const vp = `${rp}.values.${key}`;
        // 열 정의에 없는 값은 그릴 자리가 없다. 서버·웹 열 사전이 어긋났다는 신호다.
        if (!keys.has(key)) throw new ContractError(vp);
        const cell = obj(value, vp);
        str(cell.display, `${vp}.display`);
        scalar(cell.raw, `${vp}.raw`);
        oneOf(cell.src, VALUE_SOURCES, `${vp}.src`);
        strOrNull(cell.note, `${vp}.note`);
      }
    });
  });

  if (r.clarify !== null) {
    const clarify = obj(r.clarify, "clarify");
    oneOf(clarify.kind, CLARIFY_KINDS, "clarify.kind");
    str(clarify.reason, "clarify.reason");
    options(clarify.options, "clarify.options");
  }
  // ambiguous인데 선택지가 없으면 화면이 막다른 길이 된다.
  if (outcome === "ambiguous" && r.clarify === null)
    throw new ContractError("clarify");

  // suggestions는 계약 추가 제안이라 없을 수 있다. 있으면 형식을 지켜야 한다.
  if (r.suggestions === undefined) r.suggestions = [];
  options(r.suggestions, "suggestions");

  if (r.trace !== null) {
    const trace = obj(r.trace, "trace");
    num(trace.elapsed_ms, "trace.elapsed_ms");
    strOrNull(trace.model, "trace.model");
    if (trace.tokens !== null) {
      const tokens = obj(trace.tokens, "trace.tokens");
      num(tokens.prompt, "trace.tokens.prompt");
      num(tokens.completion, "trace.tokens.completion");
    }
    arr(trace.steps, "trace.steps").forEach((s, i) => {
      const p = `trace.steps[${i}]`;
      const step = obj(s, p);
      oneOf(step.stage, TRACE_STAGES, `${p}.stage`);
      str(step.label, `${p}.label`);
      num(step.ms, `${p}.ms`);
      strOrNull(step.detail, `${p}.detail`);
      strOrNull(step.query, `${p}.query`);
    });
  }

  return r as unknown as SearchResponse;
}

export function validateProductDetail(input: unknown): ProductDetail {
  const d = obj(input, "$");
  oneOf(d.domain, DOMAIN_KEYS, "domain");
  str(d.domain_label, "domain_label");
  str(d.product_id, "product_id");
  str(d.name, "name");
  arr(d.groups, "groups").forEach((g, gi) => {
    const p = `groups[${gi}]`;
    const group = obj(g, p);
    str(group.key, `${p}.key`);
    str(group.label, `${p}.label`);
    arr(group.fields, `${p}.fields`).forEach((f, fi) => {
      const fp = `${p}.fields[${fi}]`;
      const field = obj(f, fp);
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
    const relation = obj(r, p);
    str(relation.type, `${p}.type`);
    str(relation.label, `${p}.label`);
    arr(relation.items, `${p}.items`).forEach((it, ii) => {
      const ip = `${p}.items[${ii}]`;
      const item = obj(it, ip);
      strOrNull(item.id, `${ip}.id`);
      str(item.name, `${ip}.name`);
      strOrNull(item.display, `${ip}.display`);
      strOrNull(item.question, `${ip}.question`);
    });
  });
  return d as unknown as ProductDetail;
}

export function validateMeta(input: unknown): Meta {
  const m = obj(input, "$");
  arr(m.domains, "domains").forEach((d, i) => {
    const p = `domains[${i}]`;
    const domain = obj(d, p);
    oneOf(domain.domain, DOMAIN_KEYS, `${p}.domain`);
    str(domain.label, `${p}.label`);
    num(domain.count, `${p}.count`);
    dateOrNull(domain.base_date, `${p}.base_date`);
  });
  arr(m.examples, "examples").forEach((e, i) => {
    const p = `examples[${i}]`;
    const example = obj(e, p);
    str(example.id, `${p}.id`);
    str(example.category, `${p}.category`);
    str(example.question, `${p}.question`);
    oneOf(example.expected_outcome, OUTCOMES, `${p}.expected_outcome`);
  });
  bool(m.llm_available, "llm_available");
  return m as unknown as Meta;
}

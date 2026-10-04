import { isNumeric } from "./format";
import type {
  EvidenceStatus,
  Interpretation,
  InterpretedDomain,
  Outcome,
  ResultGroup,
  SearchResponse,
  TraceStage,
} from "./types";

/**
 * "어떻게 답했나"를 그리기 위한 파생 값. 화면 컴포넌트가 응답을 직접 해석하지 않도록
 * 규칙을 여기 한곳에 모은다(단위 테스트: explain.test.ts).
 *
 * 전부 **이미 응답에 있는 필드**에서만 만든다(39 r5 계약 변경 없음). 서버가 명시하지
 * 않은 것(단계별 상태, 장애 여부)은 outcome·notice·trace detail로 추정하며, 그 추정은
 * 명세 r6(steps[].status, domains[].absent_kind)이 생기면 그 값으로 바꾼다.
 */

// ---------------------------------------------------------------------------
// 상품군 상태

export type Tone = "ok" | "warn" | "muted" | "danger" | "info";

export interface DomainView {
  domain: InterpretedDomain;
  label: string;
  tone: Tone;
  /** 결과 표의 전체 건수. 표가 없으면 null. */
  count: number | null;
}

const STATUS_VIEW: Record<EvidenceStatus, { label: string; tone: Tone }> = {
  FOUND: { label: "찾음", tone: "ok" },
  PARTIAL: { label: "일부만", tone: "warn" },
  EMPTY: { label: "없음", tone: "muted" },
  AXIS_ABSENT: { label: "수집 안 함", tone: "muted" },
  AMBIGUOUS: { label: "확인 필요", tone: "info" },
};

/**
 * AXIS_ABSENT는 "수집 범위 밖"(영구)과 "장애"(일시)를 함께 담는다. 계약에 absent_kind가
 * 없으므로 outcome=unavailable이거나 STORE_BLOCKED notice가 그 상품군을 가리키면 장애로 본다.
 */
function isBlocked(response: SearchResponse, d: InterpretedDomain): boolean {
  if (d.status !== "AXIS_ABSENT") return false;
  if (response.outcome === "unavailable") return true;
  return response.answer.notices.some(
    (n) => n.code === "STORE_BLOCKED" && n.text.includes(d.label),
  );
}

export function domainViews(response: SearchResponse): DomainView[] {
  return response.interpretation.domains.map((d) => {
    const group = response.results.find((g) => g.domain === d.domain);
    if (isBlocked(response, d))
      return { domain: d, label: "장애", tone: "danger", count: null };
    const view = STATUS_VIEW[d.status];
    return {
      domain: d,
      label: view.label,
      tone: view.tone,
      count: group ? group.total_count : null,
    };
  });
}

// ---------------------------------------------------------------------------
// 해석 문장

/** 비율·금리·등급 축은 "높은/낮은", 금액·개수 축은 "큰/작은"이 자연스럽다. */
function sortPhrase(label: string, dir: "asc" | "desc"): string {
  const rate = /률|율|금리|보수|등급|수익/.test(label);
  if (rate) return `${label} ${dir === "desc" ? "높은" : "낮은"} 순`;
  return `${label} ${dir === "desc" ? "큰" : "작은"} 순`;
}

/**
 * 해석 결과를 한 문장으로 다시 쓴다. "내 말을 이렇게 알아들었구나"를 확인시키는 문장이다.
 * 예: "국내 ETF·국내 ETN 중 퇴직연금 가능, 총보수 < 0.2%인 상품을 순자산 큰 순으로 10개"
 * 상품군이 없으면(정책 거절 등) null.
 */
export function interpretationSentence(it: Interpretation): string | null {
  if (it.domains.length === 0) return null;
  const parts: string[] = [`${it.domains.map((d) => d.label).join("·")} 중`];
  if (it.conditions.length > 0)
    parts.push(`${it.conditions.map((c) => c.display).join(", ")}인 상품을`);
  else parts.push("상품을");
  if (it.sort) parts.push(`${sortPhrase(it.sort.label, it.sort.dir)}으로`);
  if (it.limit !== null) parts.push(`${it.limit}개`);
  else if (!it.sort) parts.push("찾기");
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// 처리 단계

export type StepKey = "route" | "query" | "gate" | "generate" | "verify";
export type StepState = "done" | "warn" | "stopped" | "failed" | "skipped";

export interface StepView {
  key: StepKey;
  label: string;
  state: StepState;
  ms: number | null;
  /** 서버가 준 한 줄 요약(trace detail). */
  detail: string | null;
  /** 이 단계가 왜 이 상태인지, 화면이 덧붙이는 설명. */
  note: string | null;
}

export const STEP_LABEL: Record<StepKey, string> = {
  route: "해석",
  query: "조회",
  gate: "판정",
  generate: "생성",
  verify: "검증",
};

/** 화면의 5단계 ← trace stage. compute는 조회에, render는 표시하지 않는다. */
const STAGE_TO_STEP: Partial<Record<TraceStage, StepKey>> = {
  route: "route",
  query: "query",
  compute: "query",
  gate: "gate",
  generate: "generate",
  verify: "verify",
};

/** 판정 단계 한 줄 설명. 게이트가 무엇을 근거로 LLM을 부르거나 막았는지 보여준다. */
export const GATE_HEADLINE: Record<Outcome, string> = {
  answered: "근거 충분 → 문장 생성",
  caveat: "일부만 근거 있음 → 주의와 함께 답함",
  no_result: "조건에 맞는 근거 없음 → 정해진 문장",
  not_collected: "수집하지 않은 항목 → 정해진 문장",
  unavailable: "데이터 저장소 장애 → 정해진 문장",
  ambiguous: "조건이 모호함 → 선택지 제시",
  refused: "정책상 답하지 않는 질문 → 거절",
  error: "처리 중 오류",
};

export interface Pipeline {
  steps: StepView[];
  headline: string;
  totalMs: number | null;
}

export function buildPipeline(response: SearchResponse): Pipeline {
  const { outcome, trace } = response;
  const merged = new Map<StepKey, { ms: number; details: string[] }>();
  for (const step of trace?.steps ?? []) {
    const key = STAGE_TO_STEP[step.stage];
    if (!key) continue;
    const entry = merged.get(key) ?? { ms: 0, details: [] };
    entry.ms += step.ms;
    if (step.detail) entry.details.push(step.detail);
    merged.set(key, entry);
  }

  const llmCalled = merged.has("generate");
  const generatedBy = response.answer.generated_by;
  const keys: StepKey[] = ["route", "query", "gate", "generate", "verify"];

  const steps = keys.map((key): StepView => {
    const entry = merged.get(key);
    const base: StepView = {
      key,
      label: STEP_LABEL[key],
      state: entry ? "done" : "skipped",
      ms: entry ? entry.ms : null,
      detail: entry ? entry.details.join(" · ") : null,
      note: null,
    };

    switch (key) {
      case "route":
        if (outcome === "refused") {
          base.state = "stopped";
          base.note = GATE_HEADLINE.refused;
        }
        break;
      case "query":
        if (!entry) {
          base.note =
            outcome === "refused" || outcome === "ambiguous"
              ? "조회 전에 멈춤"
              : null;
        } else if (outcome === "unavailable" || /실패/.test(base.detail ?? ""))
          base.state = outcome === "unavailable" ? "failed" : "warn";
        break;
      case "gate":
        if (!entry) break;
        if (outcome === "caveat") base.state = "warn";
        else if (outcome !== "answered") base.state = "stopped";
        base.note = GATE_HEADLINE[outcome];
        break;
      case "generate":
        if (generatedBy === "fallback") {
          base.state = "warn";
          base.note = "모델 응답 없음 · 표만 보여줌";
        } else if (!llmCalled) {
          base.note =
            outcome === "refused"
              ? "모델 호출 안 함"
              : "모델 호출 안 함 · 정해진 문장";
        }
        break;
      case "verify":
        if (!entry) base.note = llmCalled ? null : "검증할 생성 문장 없음";
        break;
    }
    return base;
  });

  // 오류: 기록이 남은 마지막 단계를 실패로 표시한다.
  if (outcome === "error") {
    const last = [...steps].reverse().find((s) => s.state !== "skipped");
    if (last) last.state = "failed";
  }

  return {
    steps,
    headline: GATE_HEADLINE[outcome],
    totalMs: trace ? trace.elapsed_ms : null,
  };
}

/** 시간 막대: 단계별 소요 비율. 기록이 없거나 합이 0이면 빈 배열. */
export function timingSegments(
  pipeline: Pipeline,
): Array<{ key: StepKey; label: string; ms: number; ratio: number }> {
  const timed = pipeline.steps.filter(
    (s): s is StepView & { ms: number } => s.ms !== null && s.ms > 0,
  );
  const total = timed.reduce((sum, s) => sum + s.ms, 0);
  if (total === 0) return [];
  return timed.map((s) => ({
    key: s.key,
    label: s.label,
    ms: s.ms,
    ratio: s.ms / total,
  }));
}

// ---------------------------------------------------------------------------
// 답변 문장의 근거 연결

export interface CiteTarget {
  domain: string;
  productId: string;
  /** 숫자 값이면 열 키, 상품명이면 null. */
  key: string | null;
}

export type AnswerSegment =
  | { text: string; cite?: undefined }
  | { text: string; cite: CiteTarget };

/**
 * 답변 문장에서 인용 상품의 이름과 숫자 표시값(예: "9.1조 원", "0.15%")을 찾아
 * 표의 그 행·칸과 잇는다. 서버가 위치를 주지 않으므로(r6 `answer.citations` 전까지)
 * 문자열이 정확히 같을 때만 잇는다 — 못 찾으면 그냥 글자로 둔다.
 */
export function linkAnswer(
  text: string,
  groups: ResultGroup[],
): AnswerSegment[] {
  const needles: Array<{ needle: string; cite: CiteTarget }> = [];
  for (const group of groups) {
    for (const row of group.rows) {
      if (!row.cited) continue;
      needles.push({
        needle: row.name,
        cite: { domain: group.domain, productId: row.product_id, key: null },
      });
      for (const column of group.columns) {
        if (!isNumeric(column.kind)) continue;
        const value = row.values[column.key];
        if (!value || value.src === "unavailable") continue;
        const display = value.display.replace(/^\+/, "");
        if (display.length < 3) continue;
        needles.push({
          needle: display,
          cite: {
            domain: group.domain,
            productId: row.product_id,
            key: column.key,
          },
        });
      }
    }
  }
  // 긴 것부터 맞춰야 "9.1조 원"이 "1조 원" 같은 짧은 값에 먹히지 않는다.
  needles.sort((a, b) => b.needle.length - a.needle.length);

  const taken: Array<{ start: number; end: number; cite: CiteTarget }> = [];
  for (const { needle, cite } of needles) {
    let from = 0;
    while (from <= text.length) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const overlaps = taken.some((t) => at < t.end && end > t.start);
      if (!overlaps) {
        taken.push({ start: at, end, cite });
        break; // 같은 값은 첫 등장만 잇는다.
      }
      from = at + 1;
    }
  }
  taken.sort((a, b) => a.start - b.start);

  const segments: AnswerSegment[] = [];
  let cursor = 0;
  for (const t of taken) {
    if (t.start > cursor) segments.push({ text: text.slice(cursor, t.start) });
    segments.push({ text: text.slice(t.start, t.end), cite: t.cite });
    cursor = t.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

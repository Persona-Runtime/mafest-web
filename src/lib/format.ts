import type {
  ColumnKind,
  GeneratedBy,
  InterpretedDomain,
  ValueSource,
} from "./types";

/** 숫자형 열은 오른쪽 정렬·고정폭 숫자로 그린다. */
const NUMERIC_KINDS: ReadonlySet<ColumnKind> = new Set([
  "money",
  "percent",
  "return",
  "count",
]);

export function isNumeric(kind: ColumnKind): boolean {
  return NUMERIC_KINDS.has(kind);
}

/**
 * 기준일 요약. 상품군마다 기준일이 다르므로 단일 날짜를 가정하지 않는다.
 * 모두 같으면 하나로 합치고, 다르면 상품군별로 나열한다(37 §2-1).
 */
export function baseDateSummary(
  domains: InterpretedDomain[],
): Array<{ label: string | null; date: string }> {
  const dated = domains.filter(
    (d): d is InterpretedDomain & { base_date: string } => d.base_date !== null,
  );
  const unique = new Set(dated.map((d) => d.base_date));
  if (unique.size === 0) return [];
  if (unique.size === 1) return [{ label: null, date: dated[0].base_date }];
  return dated.map((d) => ({ label: d.label, date: d.base_date }));
}

export const SOURCE_LABEL: Record<ValueSource, string> = {
  "system-provided": "원천값",
  external: "외부 수집",
  computed: "계산값",
  unavailable: "미제공",
};

export const GENERATED_LABEL: Record<GeneratedBy, string> = {
  llm: "AI 생성 문장",
  template: "정형 문장",
  fallback: "조회 결과만",
};

export function formatCount(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}초`;
  return `${Math.round(ms)}ms`;
}

export function searchHref(question: string): string {
  return `/search?q=${encodeURIComponent(question)}`;
}

export function productHref(domain: string, productId: string): string {
  return `/products/${encodeURIComponent(domain)}/${encodeURIComponent(productId)}`;
}

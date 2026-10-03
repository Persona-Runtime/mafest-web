import type { Interpretation } from "../lib/types";

/**
 * 해석한 조건. 결과 위 필터 UI는 두지 않는다 — 조건을 바꾸려면 질문을 고친다(37 4-2).
 * 그래서 칩은 버튼이 아니라 읽기 전용 목록이다.
 */
export function InterpretationChips({
  interpretation,
}: {
  interpretation: Interpretation;
}) {
  const { domains, conditions, sort, limit } = interpretation;
  if (domains.length === 0 && conditions.length === 0 && !sort) return null;
  return (
    <div className="interpretation">
      <span className="interpretation__label" id="interpretation-label">
        해석한 조건
      </span>
      <ul className="chips" aria-labelledby="interpretation-label">
        {domains.map((d) => (
          <li className="chip chip--domain" key={d.domain}>
            {d.label}
          </li>
        ))}
        {conditions.map((c) => (
          <li className="chip" key={`${c.axis}-${c.op}-${String(c.value)}`}>
            {c.display}
          </li>
        ))}
        {sort && (
          <li className="chip">
            정렬: {sort.label} {sort.dir === "desc" ? "↓" : "↑"}
            <span className="visually-hidden">
              {sort.dir === "desc" ? " 내림차순" : " 오름차순"}
            </span>
          </li>
        )}
        {limit !== null && <li className="chip">상위 {limit}</li>}
      </ul>
    </div>
  );
}

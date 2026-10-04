import { domainViews, interpretationSentence } from "../lib/explain";
import { formatCount } from "../lib/format";
import type { SearchResponse } from "../lib/types";

/**
 * 질문 해석. 서버가 질문을 어떤 구조(대상 상품군·조건·정렬·개수)로 바꿨는지 보여준다.
 * 결과 위 필터 UI는 두지 않는다 — 조건을 바꾸려면 질문을 고친다(37 4-2). 그래서 칩은
 * 버튼이 아니라 읽기 전용 목록이다.
 */
export function InterpretationCard({ response }: { response: SearchResponse }) {
  const it = response.interpretation;
  if (it.domains.length === 0 && it.conditions.length === 0 && !it.sort)
    return null;
  const sentence = interpretationSentence(it);
  const domains = domainViews(response);

  return (
    <section className="interp card" aria-labelledby="interp-heading">
      <h2 id="interp-heading" className="interp__title">
        질문 해석
      </h2>
      {sentence && <p className="interp__sentence">{sentence}</p>}
      <dl className="interp__grid">
        <div className="interp__cell">
          <dt>대상</dt>
          <dd>
            <ul className="domain-list">
              {domains.map((d) => (
                <li
                  key={d.domain.domain}
                  className={`domain-pill tone--${d.tone}`}
                >
                  <span className="domain-pill__dot" aria-hidden="true" />
                  <span className="domain-pill__name">{d.domain.label}</span>
                  <span className="domain-pill__status">{d.label}</span>
                  {d.count !== null && (
                    <span className="domain-pill__meta num">
                      {formatCount(d.count)}건
                    </span>
                  )}
                  {d.domain.base_date && (
                    <span className="domain-pill__meta">
                      <span className="visually-hidden">기준일 </span>
                      <time dateTime={d.domain.base_date}>
                        {d.domain.base_date}
                      </time>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="interp__cell">
          <dt>조건</dt>
          <dd>
            {it.conditions.length > 0 ? (
              <ul className="chips">
                {it.conditions.map((c) => (
                  <li
                    className="chip"
                    key={`${c.axis}-${c.op}-${String(c.value)}`}
                  >
                    {c.display}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">없음</span>
            )}
          </dd>
        </div>
        <div className="interp__cell">
          <dt>정렬·개수</dt>
          <dd>
            <ul className="chips">
              {it.sort ? (
                <li className="chip chip--strong">
                  {it.sort.label} {it.sort.dir === "desc" ? "↓" : "↑"}
                  <span className="visually-hidden">
                    {it.sort.dir === "desc" ? " 내림차순" : " 오름차순"}
                  </span>
                </li>
              ) : (
                <li className="chip chip--plain">정렬 없음</li>
              )}
              {it.limit !== null && <li className="chip">상위 {it.limit}</li>}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}

import { Link, useNavigate } from "react-router";
import { CoverageTable, InvestmentNotice } from "../components/Common";
import { useTitle } from "../lib/useTitle";
import { SearchBox } from "../components/SearchBox";
import { searchHref } from "../lib/format";
import type { Meta } from "../lib/types";
import type { RequestState } from "../lib/useRequest";

/**
 * 홈. 검색창, 예시 질문 칩, 상품군별 건수·기준일.
 * 예시 칩은 웹에 하드코딩하지 않고 /v1/meta가 내려준다 — 서버 sweep에서 기대한 결과가
 * 나오는 질문만 칩이 된다(37 §2-2). meta가 실패해도 검색은 된다.
 */
export function HomeRoute({ meta }: { meta: RequestState<Meta> }) {
  const navigate = useNavigate();
  useTitle(null);

  return (
    <div className="home">
      <section className="home__hero">
        <h1>금융상품 정보를 질문으로 찾습니다</h1>
        <p className="home__lead">
          ETF·ETN·채권·공모펀드의 기준일 스냅샷을 조회해, 어떤 조건으로 무엇을
          찾았는지와 함께 답합니다.
        </p>
        <SearchBox
          size="large"
          autoFocus
          onSubmit={(question) => navigate(searchHref(question))}
        />
      </section>

      <section className="home__examples" aria-labelledby="examples-heading">
        <h2 id="examples-heading">이렇게 물어보세요</h2>
        {meta.status === "done" ? (
          <ul className="example-chips">
            {meta.data.examples.map((example) => (
              <li key={example.id}>
                <Link
                  className="example-chip"
                  to={searchHref(example.question)}
                >
                  <span className="example-chip__category">
                    {example.category}
                  </span>
                  <span>{example.question}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : meta.status === "failed" ? (
          <p className="muted">
            예시 질문을 불러오지 못했습니다. 검색은 그대로 쓸 수 있습니다.
          </p>
        ) : (
          <div className="skeleton skeleton--chips" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </section>

      <div className="home__grid">
        <section className="card" aria-labelledby="coverage-heading">
          <h2 id="coverage-heading">다루는 상품</h2>
          {meta.status === "done" ? (
            <CoverageTable
              domains={meta.data.domains}
              caption="상품군별 상품 수와 기준일. 기준일은 상품군마다 다릅니다."
            />
          ) : (
            <p className="muted">
              {meta.status === "failed"
                ? "상품군 정보를 불러오지 못했습니다."
                : "불러오는 중…"}
            </p>
          )}
        </section>
        <section className="card" aria-labelledby="limits-heading">
          <h2 id="limits-heading">하지 않는 것</h2>
          <ul className="plain-list">
            <li>상품 추천, 가격 전망, 투자성향 적합성 판단</li>
            <li>실시간 시세·거래량 (기준일 스냅샷만 다룹니다)</li>
            <li>
              수집하지 않은 항목은 추정하지 않고 "수집 범위 밖"으로 답합니다
            </li>
          </ul>
          <p>
            <Link to="/about">동작 방식과 데이터 범위 보기</Link>
          </p>
        </section>
      </div>

      <InvestmentNotice />
    </div>
  );
}

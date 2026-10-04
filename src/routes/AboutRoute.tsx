import { Link } from "react-router";
import { CoverageTable, InvestmentNotice } from "../components/Common";
import { useTitle } from "../lib/useTitle";
import { UNOFFICIAL_NOTICE } from "../lib/site";
import type { Meta } from "../lib/types";
import type { RequestState } from "../lib/useRequest";

const PIPELINE: Array<[string, string]> = [
  ["라우팅", "질문에서 상품군, 조건, 정렬 기준을 읽어 냅니다."],
  [
    "조회",
    "PostgreSQL에서 SQL로, 구성종목·운용사 같은 관계는 그래프 확장(Apache AGE)에서 Cypher로 찾습니다. 읽기 전용 계정으로 실행합니다.",
  ],
  ["연산", "개수, 평균처럼 계산이 필요한 값을 조회 결과에서 구합니다."],
  [
    "게이트",
    "근거 상태(찾음·일부만·없음·수집 범위 밖·모호함)를 판정합니다. 근거가 없으면 언어 모델을 부르지 않고 정해진 문장으로 답합니다.",
  ],
  [
    "생성",
    "근거가 있을 때만 언어 모델(Qwen3-4B)이 조회 결과를 문장으로 옮깁니다.",
  ],
  [
    "검증",
    "답변이 인용한 수치가 조회 값과 같은지 확인하고, 인용한 상품을 표에 ★로 표시합니다.",
  ],
];

/** 동작 방식·데이터 범위·한계·로그 정책·비공식 고지 (37 W5). */
export function AboutRoute({ meta }: { meta: RequestState<Meta> }) {
  useTitle("동작 방식");
  return (
    <div className="about">
      <h1>동작 방식</h1>
      <p className="about__lead">
        이 사이트는 질문을 받아 상품 정보 스냅샷을 조회하고, 무엇을 근거로
        답했는지 함께 보여 주는 검색 데모입니다. 결과 화면의 &ldquo;어떻게
        답했나&rdquo;를 열면 아래 단계를 실제 쿼리와 함께 볼 수 있습니다.
      </p>

      <section aria-labelledby="pipeline-heading" className="card">
        <h2 id="pipeline-heading">답을 만드는 순서</h2>
        <ol className="pipeline">
          {PIPELINE.map(([name, text]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="arch-heading" className="card">
        <h2 id="arch-heading">구성</h2>
        <ul className="plain-list">
          <li>
            웹·API·데이터베이스는 개인 쿠버네티스 클러스터에서 돕니다. 같은
            주소의
            <code> / </code>는 이 웹으로, <code>/v1</code>은 검색 API로
            나뉩니다.
          </li>
          <li>
            데이터베이스는 PostgreSQL 두 대(주·복제)로 운영해 한 대가 멈춰도
            이어서 응답합니다.
          </li>
          <li>
            답변 문장은 클라우드 GPU 노드의 언어 모델이 만듭니다. 모델이 꺼져
            있으면 문장 없이 조회 결과 표만 보여 줍니다.
          </li>
        </ul>
      </section>

      <section aria-labelledby="data-heading" className="card">
        <h2 id="data-heading">데이터 범위와 기준일</h2>
        <p>
          값은 상품군마다 다른 기준일의 스냅샷이며 갱신하지 않습니다. 한 화면에
          여러 상품군이 나오면 기준일을 상품군별로 따로 표시합니다.
        </p>
        {meta.status === "done" && (
          <CoverageTable
            domains={meta.data.domains}
            caption="상품군별 상품 수와 기준일"
          />
        )}
        <p className="muted small">
          값의 출처는 원천값(제공 자료), 외부 수집, 계산값, 미제공으로 구분해
          상세 화면에 표시합니다.
        </p>
      </section>

      <section aria-labelledby="limits-heading" className="card">
        <h2 id="limits-heading">한계</h2>
        <ul className="plain-list">
          <li>상품 추천, 가격 전망, 투자성향 적합성 판단은 하지 않습니다.</li>
          <li>
            수집하지 않은 항목(예: 거래량)은 추정하지 않고 &ldquo;수집 범위
            밖&rdquo;으로 답합니다.
          </li>
          <li>
            결과는 한 번에 최대 20개까지 보여 줍니다. 상품군 전체 목록 화면은
            두지 않습니다.
          </li>
          <li>
            질문은 200자까지이고, 답을 30초 안에 만들지 못하면 시간 초과로
            끝납니다.
          </li>
        </ul>
      </section>

      <section aria-labelledby="log-heading" className="card">
        <h2 id="log-heading">기록 정책</h2>
        <ul className="plain-list">
          <li>로그인과 쿠키가 없습니다.</li>
          <li>
            질문 원문은 저장하지 않습니다. 질문 길이·해시, 상품군, 결과 종류,
            처리 시간만 남기고 IP 주소 등 접속 정보는 저장하지 않습니다.
          </li>
          <li>
            &ldquo;어떻게 답했나&rdquo;에 보이는 쿼리에는 내부 테이블 이름이
            그대로 나옵니다. 매개변수 값은 질문을 해석해 확정한 값(숫자, 등급,
            데이터에 있는 상품·회사 이름)뿐이고, 질문 문장을 그대로 넣지
            않습니다.
          </li>
          <li>
            공개 주소라 짧은 시간에 보낼 수 있는 질문 수를 제한합니다. 검색엔진
            수집은 막아 두었습니다.
          </li>
        </ul>
      </section>

      <section aria-labelledby="notice-heading" className="card">
        <h2 id="notice-heading">고지</h2>
        <p>{UNOFFICIAL_NOTICE}</p>
        <InvestmentNotice />
      </section>

      <p>
        <Link to="/">검색으로 돌아가기</Link>
      </p>
    </div>
  );
}

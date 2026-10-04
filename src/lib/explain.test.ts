import { describe, expect, test } from "vitest";
import {
  buildPipeline,
  domainViews,
  interpretationSentence,
  linkAnswer,
  questionSegments,
  timingSegments,
  type StepKey,
  type StepState,
} from "./explain";
import {
  ambiguous,
  answered,
  bond,
  caveat,
  caveatOutage,
  count,
  errorOutcome,
  fallback,
  noResult,
  notCollected,
  refused,
  unavailable,
} from "./fixtures";
import type { SearchResponse } from "./types";

function states(response: SearchResponse): Record<StepKey, StepState> {
  return Object.fromEntries(
    buildPipeline(response).steps.map((s) => [s.key, s.state]),
  ) as Record<StepKey, StepState>;
}

describe("interpretationSentence", () => {
  test("상품군·조건·정렬·개수를 한 문장으로", () => {
    expect(interpretationSentence(caveat.interpretation)).toBe(
      "국내 ETF·국내 ETN 중 퇴직연금 가능, 총보수 < 0.2%인 상품을 순자산 큰 순으로 10개",
    );
  });

  test("비율·금리 축은 '높은 순'", () => {
    expect(interpretationSentence(bond.interpretation)).toContain(
      "표면금리 높은 순으로",
    );
  });

  test("상품군이 없으면(정책 거절) 문장을 만들지 않는다", () => {
    expect(interpretationSentence(refused.interpretation)).toBeNull();
  });
});

describe("domainViews", () => {
  test("FOUND는 찾음, PARTIAL은 일부만, 건수는 표의 전체 수", () => {
    const [etf, etn] = domainViews(caveat);
    expect([etf.label, etf.count]).toEqual(["찾음", 7]);
    expect([etn.label, etn.tone]).toEqual(["일부만", "warn"]);
  });

  test("AXIS_ABSENT라도 STORE_BLOCKED가 가리키면 '장애'(수집 범위 밖과 구분)", () => {
    const etn = domainViews(caveatOutage)[1];
    expect([etn.label, etn.tone]).toEqual(["장애", "danger"]);
    expect(domainViews(notCollected)[0].label).toBe("수집 안 함");
    expect(domainViews(unavailable)[0].label).toBe("장애");
  });
});

describe("buildPipeline — 게이트 설계가 보이는가", () => {
  test("answered: 전 단계 완료", () => {
    expect(states(answered)).toEqual({
      route: "done",
      query: "done",
      gate: "done",
      generate: "done",
      verify: "done",
    });
  });

  test("caveat: 판정 주의", () => {
    expect(states(caveat).gate).toBe("warn");
  });

  test.each([
    ["no_result", noResult],
    ["not_collected", notCollected],
  ] as const)("%s: 판정에서 멈추고 생성은 건너뜀", (_, fixture) => {
    const pipeline = buildPipeline(fixture);
    const s = states(fixture);
    expect(s.gate).toBe("stopped");
    expect(s.generate).toBe("skipped");
    expect(pipeline.steps.find((x) => x.key === "generate")?.note).toBe(
      "모델 호출 안 함 · 정해진 문장",
    );
  });

  test("unavailable: 조회 실패", () => {
    expect(states(unavailable).query).toBe("failed");
  });

  test("ambiguous: 조회 전에 판정에서 멈춤", () => {
    const s = states(ambiguous);
    expect([s.query, s.gate, s.generate]).toEqual([
      "skipped",
      "stopped",
      "skipped",
    ]);
  });

  test("refused: 해석 단계에서 정책으로 멈춤", () => {
    const route = buildPipeline(refused).steps[0];
    expect(route.state).toBe("stopped");
    expect(route.note).toContain("정책");
  });

  test("fallback: 생성 주의(모델 응답 없음), 검증 건너뜀", () => {
    const s = states(fallback);
    expect([s.generate, s.verify]).toEqual(["warn", "skipped"]);
  });

  test("정형 답(개수): 모델을 부르지 않았다고 보인다", () => {
    expect(states(count).generate).toBe("skipped");
  });

  test("error: 기록이 없으면 단계도 전부 건너뜀 상태", () => {
    expect(Object.values(states(errorOutcome))).toEqual(
      Array(5).fill("skipped"),
    );
  });
});

test("시간 막대: 비율 합이 1이고 생성이 가장 크다", () => {
  const segments = timingSegments(buildPipeline(answered));
  const sum = segments.reduce((acc, s) => acc + s.ratio, 0);
  expect(sum).toBeCloseTo(1);
  const top = [...segments].sort((a, b) => b.ms - a.ms)[0];
  expect(top.key).toBe("generate");
});

describe("linkAnswer", () => {
  test("인용 상품의 이름과 숫자를 표의 행·칸으로 잇는다", () => {
    const linked = linkAnswer(answered.answer.text, answered.results).filter(
      (s) => s.cite,
    );
    expect(linked.map((s) => s.text)).toEqual([
      "SAMPLE 코스피200",
      "9.1조 원",
      "0.15%",
      "DEMO 미국S&P500",
      "6.4조 원",
      "SAMPLE 반도체TOP10",
      "3.8조 원",
    ]);
    expect(linked[1].cite).toEqual({
      domain: "kr_etf",
      productId: "SMP001",
      key: "aum",
    });
  });

  test("이어 붙이면 원문 그대로", () => {
    const text = answered.answer.text;
    expect(
      linkAnswer(text, answered.results)
        .map((s) => s.text)
        .join(""),
    ).toBe(text);
  });

  test("인용 안 된 행이나 표에 없는 값은 잇지 않는다", () => {
    expect(linkAnswer("순자산 1.9조 원", answered.results)).toEqual([
      { text: "순자산 1.9조 원" },
    ]);
  });
});

describe("questionSegments — 해석 과정 밑줄", () => {
  test("서버 위치대로 질문을 표현 단위로 자르고, 이어 붙이면 원문", () => {
    const segments = questionSegments(
      caveat.question,
      caveat.interpretation.mappings,
    );
    expect(segments.map((s) => s.text).join("")).toBe(caveat.question);
    expect(
      segments.filter((s) => s.mapping !== undefined).map((s) => s.text),
    ).toEqual(["퇴직연금 가능", "총보수 0.2% 미만", "ETF·ETN", "순자산 큰 순"]);
  });

  test("질문이 바뀌어 위치가 어긋나면 같은 글자를 다시 찾는다", () => {
    const segments = questionSegments(
      "요즘 순자산 큰 국내 ETF 5개 보여줘",
      answered.interpretation.mappings,
    );
    expect(
      segments.filter((s) => s.mapping !== undefined).map((s) => s.text),
    ).toEqual(["순자산 큰", "국내 ETF", "5개"]);
  });

  test("못 찾는 표현과 질문에 없는 해석(기본값)은 밑줄 없이 둔다", () => {
    const segments = questionSegments(
      "채권 보여줘",
      caveat.interpretation.mappings,
    );
    expect(segments).toEqual([{ text: "채권 보여줘" }]);
  });
});

import type {
  CellValue,
  Column,
  DomainKey,
  InterpretedDomain,
  Meta,
  ProductDetail,
  ResultGroup,
  ResultRow,
  SearchResponse,
  Trace,
  ValueSource,
} from "./types";

/**
 * mock 모드와 화면 테스트가 쓰는 픽스처.
 *
 * **전부 합성 값이다.** 상품명(SAMPLE·DEMO), 코드(SMP·DMO), 회사명, 수치, 건수, 테이블 이름
 * 모두 지어낸 값이며 실제 응답을 복사하지 않았다(37 §0). 실제 서버 응답을 여기에 붙여
 * 넣지 않는다 — 웹 레포는 데이터를 담지 않는다.
 *
 * 질문 → 픽스처 연결은 mockApi.ts에 있다.
 */

export const DOMAIN_LABEL: Record<DomainKey, string> = {
  bond: "채권",
  kr_etf: "국내 ETF",
  kr_etn: "국내 ETN",
  xx_etf: "해외 ETF",
  xx_etn: "해외 ETN",
  fund: "공모펀드",
};

const ETF_DATE = "2026-08-21";
const BOND_DATE = "2026-08-14";

function domain(
  key: DomainKey,
  status: InterpretedDomain["status"],
  baseDate: string | null,
): InterpretedDomain {
  return { domain: key, label: DOMAIN_LABEL[key], status, base_date: baseDate };
}

function cell(
  display: string,
  raw: CellValue["raw"],
  src: ValueSource = "system-provided",
  note: string | null = null,
): CellValue {
  return { display, raw, src, note };
}

function signed(value: number, digits = 1): string {
  const text = Math.abs(value).toFixed(digits);
  return value > 0 ? `+${text}%` : value < 0 ? `-${text}%` : `${text}%`;
}

function trillion(won: number): string {
  if (won >= 1e12) return `${(won / 1e12).toFixed(1)}조 원`;
  return `${Math.round(won / 1e8).toLocaleString("ko-KR")}억 원`;
}

const ETF_COLUMNS: Column[] = [
  { key: "code", label: "코드", kind: "code", emphasis: false },
  { key: "expense_ratio", label: "총보수", kind: "percent", emphasis: false },
  { key: "aum", label: "순자산", kind: "money", emphasis: true },
  { key: "return_1y", label: "1년 수익률", kind: "return", emphasis: false },
  { key: "risk_grade", label: "위험등급", kind: "grade", emphasis: false },
];

interface EtfSeed {
  id: string;
  name: string;
  fee: number;
  aum: number;
  ret: number;
  risk: number;
}

const ETF_SEEDS: EtfSeed[] = [
  {
    id: "SMP001",
    name: "SAMPLE 코스피200",
    fee: 0.15,
    aum: 9.1e12,
    ret: 12.3,
    risk: 2,
  },
  {
    id: "DMO014",
    name: "DEMO 미국S&P500",
    fee: 0.07,
    aum: 6.4e12,
    ret: 18.9,
    risk: 1,
  },
  {
    id: "SMP027",
    name: "SAMPLE 반도체TOP10",
    fee: 0.45,
    aum: 3.8e12,
    ret: -4.1,
    risk: 1,
  },
  {
    id: "DMO031",
    name: "DEMO 국고채3년",
    fee: 0.05,
    aum: 2.6e12,
    ret: 3.2,
    risk: 5,
  },
  {
    id: "SMP042",
    name: "SAMPLE 고배당",
    fee: 0.19,
    aum: 1.9e12,
    ret: 9.7,
    risk: 2,
  },
  {
    id: "DMO055",
    name: "DEMO 2차전지소재",
    fee: 0.39,
    aum: 1.2e12,
    ret: -21.4,
    risk: 1,
  },
  {
    id: "SMP063",
    name: "SAMPLE 미국나스닥100",
    fee: 0.07,
    aum: 9.4e11,
    ret: 24.6,
    risk: 1,
  },
  {
    id: "DMO078",
    name: "DEMO TDF2045",
    fee: 0.18,
    aum: 7.7e11,
    ret: 11.0,
    risk: 3,
  },
  {
    id: "SMP084",
    name: "SAMPLE 단기채권액티브",
    fee: 0.12,
    aum: 5.2e11,
    ret: 3.6,
    risk: 6,
  },
  {
    id: "DMO096",
    name: "DEMO 리츠부동산",
    fee: 0.29,
    aum: 3.1e11,
    ret: 0.0,
    risk: 2,
  },
];

function etfRow(seed: EtfSeed, cited: boolean): ResultRow {
  return {
    product_id: seed.id,
    name: seed.name,
    cited,
    values: {
      code: cell(seed.id, seed.id),
      expense_ratio: cell(`${seed.fee.toFixed(2)}%`, seed.fee),
      aum: cell(trillion(seed.aum), seed.aum),
      return_1y: cell(signed(seed.ret), seed.ret, "computed"),
      risk_grade: cell(`${seed.risk}등급`, seed.risk),
    },
  };
}

function etfGroup(seeds: EtfSeed[], total: number, cited: number): ResultGroup {
  return {
    domain: "kr_etf",
    total_count: total,
    truncated: total > seeds.length,
    columns: ETF_COLUMNS,
    rows: seeds.map((seed, i) => etfRow(seed, i < cited)),
  };
}

const ETN_COLUMNS: Column[] = [
  { key: "code", label: "코드", kind: "code", emphasis: false },
  { key: "expense_ratio", label: "총보수", kind: "percent", emphasis: false },
  { key: "aum", label: "지표가치총액", kind: "money", emphasis: true },
  { key: "risk_grade", label: "위험등급", kind: "grade", emphasis: false },
];

const BOND_COLUMNS: Column[] = [
  { key: "code", label: "코드", kind: "code", emphasis: false },
  { key: "credit_grade", label: "신용등급", kind: "grade", emphasis: false },
  { key: "coupon_rate", label: "표면금리", kind: "percent", emphasis: true },
  { key: "maturity_date", label: "만기일", kind: "date", emphasis: false },
  { key: "subordinated", label: "후순위", kind: "bool", emphasis: false },
];

const BOND_SEEDS = [
  {
    id: "SMPB101",
    name: "SAMPLE캐피탈 101-2",
    grade: "AA0",
    coupon: 4.12,
    maturity: "2028-03-15",
  },
  {
    id: "DMOB205",
    name: "DEMO카드 205",
    grade: "AA+",
    coupon: 3.98,
    maturity: "2027-11-02",
  },
  {
    id: "SMPB318",
    name: "SAMPLE에너지 318",
    grade: "AA0",
    coupon: 3.91,
    maturity: "2029-06-20",
  },
  {
    id: "DMOB422",
    name: "DEMO지주 22-1",
    grade: "AAA",
    coupon: 3.74,
    maturity: "2027-02-28",
  },
];

function trace(
  steps: Trace["steps"],
  withModel: boolean,
  tokens: Trace["tokens"] = null,
): Trace {
  return {
    elapsed_ms: steps.reduce((sum, step) => sum + step.ms, 0),
    model: withModel ? "Qwen/Qwen3-4B" : null,
    tokens,
    steps,
  };
}

const RENDER = {
  stage: "render",
  label: "렌더",
  ms: 1,
  detail: null,
  query: null,
} as const;

// ---------------------------------------------------------------------------
// outcome 8종 (+ fallback, 개수, 채권)

export const answered: SearchResponse = {
  request_id: "mock-answered-0001",
  question: "순자산 큰 국내 ETF 5개",
  outcome: "answered",
  answer: {
    text: "순자산이 가장 큰 국내 ETF는 SAMPLE 코스피200(순자산 9.1조 원, 총보수 0.15%)입니다. 그다음은 DEMO 미국S&P500(6.4조 원)과 SAMPLE 반도체TOP10(3.8조 원)입니다.",
    generated_by: "llm",
    notices: [
      {
        code: "RETURN_PAST",
        text: "수익률은 과거 성과이며 미래 수익을 보장하지 않습니다.",
      },
    ],
  },
  interpretation: {
    domains: [domain("kr_etf", "FOUND", ETF_DATE)],
    conditions: [],
    sort: { axis: "aum", label: "순자산", dir: "desc" },
    limit: 5,
  },
  results: [etfGroup(ETF_SEEDS.slice(0, 5), 1180, 3)],
  clarify: null,
  suggestions: [],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 4,
        detail: "국내 ETF · 순위 질의",
        query: null,
      },
      {
        stage: "query",
        label: "조회",
        ms: 38,
        detail: "5행",
        query:
          "SELECT code, name, expense_ratio, aum, return_1y, risk_grade\n  FROM sample_kr_etf\n ORDER BY aum DESC NULLS LAST\n LIMIT $1;  -- $1 = 5",
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 2,
        detail: "통과 · 상품군 FOUND",
        query: null,
      },
      {
        stage: "generate",
        label: "생성",
        ms: 2840,
        detail: "문장 3개",
        query: null,
      },
      {
        stage: "verify",
        label: "검증",
        ms: 3,
        detail: "인용 수치 4개 일치",
        query: null,
      },
      RENDER,
    ],
    true,
    { prompt: 1212, completion: 96 },
  ),
};

export const caveat: SearchResponse = {
  request_id: "mock-caveat-0002",
  question: "퇴직연금 가능하고 총보수 0.2% 미만인 ETF·ETN 순자산 큰 순",
  outcome: "caveat",
  answer: {
    text: "조건에 맞는 국내 ETF 7개 중 순자산이 가장 큰 상품은 SAMPLE 코스피200(9.1조 원)입니다. 국내 ETN은 일부 상품의 퇴직연금 가능 여부가 없어 확인된 2개만 보여줍니다.",
    generated_by: "llm",
    notices: [
      {
        code: "PARTIAL_AXIS",
        text: "국내 ETN 4개는 퇴직연금 가능 여부가 수집되지 않아 결과에서 뺐습니다.",
      },
      {
        code: "PENSION_RULE",
        text: "퇴직연금 편입 가능 여부는 상품 정보 기준입니다. 실제 가능 여부는 계좌를 연 금융회사에 확인해야 합니다.",
      },
    ],
  },
  interpretation: {
    domains: [
      domain("kr_etf", "FOUND", ETF_DATE),
      domain("kr_etn", "PARTIAL", BOND_DATE),
    ],
    conditions: [
      {
        axis: "pension_eligible",
        label: "퇴직연금",
        op: "=",
        value: true,
        display: "퇴직연금 가능",
      },
      {
        axis: "expense_ratio",
        label: "총보수",
        op: "<",
        value: 0.2,
        display: "총보수 < 0.2%",
      },
    ],
    sort: { axis: "aum", label: "순자산", dir: "desc" },
    limit: 10,
  },
  results: [
    etfGroup(
      ETF_SEEDS.filter((s) => s.fee < 0.2),
      7,
      1,
    ),
    {
      domain: "kr_etn",
      total_count: 2,
      truncated: false,
      columns: ETN_COLUMNS,
      rows: [
        {
          product_id: "DMON007",
          name: "DEMO 레버리지 금 선물 ETN",
          cited: false,
          values: {
            code: cell("DMON007", "DMON007"),
            expense_ratio: cell("0.18%", 0.18),
            aum: cell("1,240억 원", 1.24e11),
            risk_grade: cell("1등급", 1),
          },
        },
        {
          product_id: "SMPN012",
          name: "SAMPLE 미국채10년 ETN",
          cited: false,
          values: {
            code: cell("SMPN012", "SMPN012"),
            expense_ratio: cell("0.15%", 0.15),
            aum: cell("860억 원", 8.6e10),
            risk_grade: cell("3등급", 3, "system-provided", "발행사 제공 등급"),
          },
        },
      ],
    },
  ],
  clarify: null,
  suggestions: [],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 6,
        detail: "국내 ETF·국내 ETN · 복합 조건",
        query: null,
      },
      {
        stage: "query",
        label: "조회",
        ms: 61,
        detail: "국내 ETF 7행 · 국내 ETN 2행(4행 제외)",
        query:
          "SELECT code, name, expense_ratio, aum, return_1y, risk_grade\n  FROM sample_kr_etf\n WHERE pension_eligible = $1 AND expense_ratio < $2\n ORDER BY aum DESC NULLS LAST\n LIMIT $3;  -- $1 = true, $2 = 0.2, $3 = 10",
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 3,
        detail: "부분 통과 · 국내 ETN PARTIAL",
        query: null,
      },
      {
        stage: "generate",
        label: "생성",
        ms: 3310,
        detail: "문장 2개",
        query: null,
      },
      {
        stage: "verify",
        label: "검증",
        ms: 4,
        detail: "인용 수치 2개 일치",
        query: null,
      },
      RENDER,
    ],
    true,
    { prompt: 1687, completion: 121 },
  ),
};

export const noResult: SearchResponse = {
  request_id: "mock-no-result-0003",
  question: "총보수 0.01% 미만이고 1년 수익률 50% 이상인 국내 ETF",
  outcome: "no_result",
  answer: {
    text: "조건에 맞는 국내 ETF가 없습니다.",
    generated_by: "template",
    notices: [],
  },
  interpretation: {
    domains: [domain("kr_etf", "EMPTY", ETF_DATE)],
    conditions: [
      {
        axis: "expense_ratio",
        label: "총보수",
        op: "<",
        value: 0.01,
        display: "총보수 < 0.01%",
      },
      {
        axis: "return_1y",
        label: "1년 수익률",
        op: ">=",
        value: 50,
        display: "1년 수익률 ≥ 50%",
      },
    ],
    sort: null,
    limit: 10,
  },
  results: [],
  clarify: null,
  suggestions: [
    {
      label: "총보수 조건 완화",
      question: "총보수 0.1% 미만이고 1년 수익률 20% 이상인 국내 ETF",
    },
    { label: "수익률 조건 빼기", question: "총보수 낮은 국내 ETF 5개" },
  ],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 4,
        detail: "국내 ETF · 조건 검색",
        query: null,
      },
      {
        stage: "query",
        label: "조회",
        ms: 22,
        detail: "0행",
        query:
          "SELECT code, name, expense_ratio, return_1y\n  FROM sample_kr_etf\n WHERE expense_ratio < $1 AND return_1y >= $2\n LIMIT $3;  -- $1 = 0.01, $2 = 50, $3 = 10",
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 1,
        detail: "EMPTY → 정형 문장",
        query: null,
      },
      RENDER,
    ],
    false,
  ),
};

export const notCollected: SearchResponse = {
  request_id: "mock-not-collected-0004",
  question: "어제 거래량 많은 국내 ETF",
  outcome: "not_collected",
  answer: {
    text: "거래량은 이 서비스가 수집하지 않은 데이터라 답할 수 없습니다.",
    generated_by: "template",
    notices: [
      {
        code: "AXIS_ABSENT",
        text: "없는 항목: 거래량(일별 시세). 상품 정보 스냅샷만 다룹니다.",
      },
    ],
  },
  interpretation: {
    domains: [domain("kr_etf", "AXIS_ABSENT", ETF_DATE)],
    conditions: [],
    sort: { axis: "volume", label: "거래량", dir: "desc" },
    limit: 10,
  },
  results: [],
  clarify: null,
  suggestions: [{ label: "순자산 순위로", question: "순자산 큰 국내 ETF 5개" }],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 3,
        detail: "국내 ETF · 정렬 축 '거래량'",
        query: null,
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 1,
        detail: "AXIS_ABSENT(axis) → 정형 문장",
        query: null,
      },
      RENDER,
    ],
    false,
  ),
};

export const unavailable: SearchResponse = {
  request_id: "mock-unavailable-0005",
  question: "SAMPLE전자를 편입한 국내 ETF",
  outcome: "unavailable",
  answer: {
    text: "지금 이 데이터를 불러올 수 없습니다. 잠시 뒤 다시 시도해 주세요.",
    generated_by: "template",
    notices: [
      {
        code: "STORE_BLOCKED",
        text: "구성종목 관계 저장소에 연결하지 못했습니다.",
      },
    ],
  },
  interpretation: {
    domains: [domain("kr_etf", "AXIS_ABSENT", ETF_DATE)],
    conditions: [
      {
        axis: "holding",
        label: "구성종목",
        op: "contains",
        value: "SAMPLE전자",
        display: "SAMPLE전자 편입",
      },
    ],
    sort: null,
    limit: 10,
  },
  results: [],
  clarify: null,
  suggestions: [],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 5,
        detail: "국내 ETF · 관계 질의",
        query: null,
      },
      {
        stage: "query",
        label: "조회",
        ms: 3002,
        detail: "관계 조회 실패 · 연결 시간 초과",
        query:
          "SELECT * FROM cypher('sample_graph', $$\n  MATCH (e:ETF)-[h:HOLDS]->(c:Company {name: $name})\n  RETURN e.code, h.weight ORDER BY h.weight DESC LIMIT 10\n$$) AS (code agtype, weight agtype);  -- $name = 'SAMPLE전자'",
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 1,
        detail: "AXIS_ABSENT(blocked) → 정형 문장",
        query: null,
      },
      RENDER,
    ],
    false,
  ),
};

export const ambiguous: SearchResponse = {
  request_id: "mock-ambiguous-0006",
  question: "신용등급 좋은 채권",
  outcome: "ambiguous",
  answer: {
    text: "'좋은' 신용등급의 기준을 정할 수 없어 범위를 골라야 합니다.",
    generated_by: "template",
    notices: [],
  },
  interpretation: {
    domains: [domain("bond", "AMBIGUOUS", BOND_DATE)],
    conditions: [],
    sort: null,
    limit: 10,
  },
  results: [],
  clarify: {
    kind: "missing_condition",
    reason:
      "신용등급 기준이 없습니다. 아래에서 범위를 고르면 그 조건으로 다시 검색합니다.",
    options: [
      { label: "AAA만", question: "신용등급 AAA 채권 표면금리 높은 순" },
      {
        label: "AA- 이상",
        question: "신용등급 AA- 이상 채권 표면금리 높은 순",
      },
      { label: "A- 이상", question: "신용등급 A- 이상 채권 표면금리 높은 순" },
    ],
  },
  suggestions: [],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 4,
        detail: "채권 · 조건 값 없음(신용등급)",
        query: null,
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 1,
        detail: "AMBIGUOUS(missing_condition)",
        query: null,
      },
      RENDER,
    ],
    false,
  ),
};

export const refused: SearchResponse = {
  request_id: "mock-refused-0007",
  question: "앞으로 오를 ETF 추천해줘",
  outcome: "refused",
  answer: {
    text: "이 서비스는 상품 추천이나 가격 전망을 하지 않습니다. 상품 정보에 기록된 값으로 찾고 비교하는 질문에 답합니다.",
    generated_by: "template",
    notices: [
      {
        code: "POLICY_RECOMMEND",
        text: "추천·전망·투자성향 적합성 판단은 답하지 않습니다.",
      },
    ],
  },
  interpretation: { domains: [], conditions: [], sort: null, limit: null },
  results: [],
  clarify: null,
  suggestions: [
    { label: "과거 수익률로 찾기", question: "1년 수익률 높은 국내 ETF 5개" },
    { label: "비용으로 찾기", question: "총보수 낮은 국내 ETF 5개" },
  ],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 2,
        detail: "정책 판정 · 추천·전망",
        query: null,
      },
      RENDER,
    ],
    false,
  ),
};

export const errorOutcome: SearchResponse = {
  request_id: "mock-error-0008",
  question: "오류 재현",
  outcome: "error",
  answer: {
    text: "답변을 만드는 중 오류가 났습니다.",
    generated_by: "template",
    notices: [],
  },
  interpretation: { domains: [], conditions: [], sort: null, limit: null },
  results: [],
  clarify: null,
  suggestions: [],
  trace: null,
};

/** 생성 모델이 꺼진 상태. outcome은 answered지만 문장 대신 표만 준다. */
export const fallback: SearchResponse = {
  ...answered,
  request_id: "mock-fallback-0009",
  question: "순자산 큰 국내 ETF 5개 (모델 꺼짐)",
  answer: {
    text: "조회 결과 5개를 순자산 순으로 보여줍니다.",
    generated_by: "fallback",
    notices: answered.answer.notices,
  },
  results: [etfGroup(ETF_SEEDS.slice(0, 5), 1180, 0)],
  trace: trace(
    [
      ...answered.trace!.steps.filter(
        (s) => s.stage === "route" || s.stage === "query" || s.stage === "gate",
      ),
      {
        stage: "generate",
        label: "생성",
        ms: 30000,
        detail: "모델 응답 없음 · 표만 반환",
        query: null,
      },
      RENDER,
    ],
    true,
  ),
};

export const count: SearchResponse = {
  request_id: "mock-count-0010",
  question: "국내 상장 ETN은 몇 개야?",
  outcome: "answered",
  answer: {
    text: "국내 ETN은 모두 312개입니다.",
    generated_by: "template",
    notices: [],
  },
  interpretation: {
    domains: [domain("kr_etn", "FOUND", BOND_DATE)],
    conditions: [],
    sort: null,
    limit: null,
  },
  results: [],
  clarify: null,
  suggestions: [],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 3,
        detail: "국내 ETN · 개수",
        query: null,
      },
      {
        stage: "query",
        label: "조회",
        ms: 9,
        detail: "1행",
        query: "SELECT count(*) FROM sample_kr_etn;",
      },
      {
        stage: "compute",
        label: "연산",
        ms: 0,
        detail: "개수 312",
        query: null,
      },
      {
        stage: "gate",
        label: "게이트",
        ms: 1,
        detail: "개수 질의 → 정형 문장",
        query: null,
      },
      RENDER,
    ],
    false,
  ),
};

export const bond: SearchResponse = {
  request_id: "mock-bond-0011",
  question: "신용등급 AA0 이상, 후순위 아닌 채권 표면금리 높은 순",
  outcome: "answered",
  answer: {
    text: "표면금리가 가장 높은 채권은 SAMPLE캐피탈 101-2(AA0, 4.12%)이고, DEMO카드 205(AA+, 3.98%)가 뒤를 잇습니다.",
    generated_by: "llm",
    notices: [],
  },
  interpretation: {
    domains: [domain("bond", "FOUND", BOND_DATE)],
    conditions: [
      {
        axis: "credit_grade",
        label: "신용등급",
        op: ">=",
        value: "AA0",
        display: "신용등급 ≥ AA0",
      },
      {
        axis: "subordinated",
        label: "후순위",
        op: "=",
        value: false,
        display: "후순위 아님",
      },
    ],
    sort: { axis: "coupon_rate", label: "표면금리", dir: "desc" },
    limit: 10,
  },
  results: [
    {
      domain: "bond",
      total_count: 4,
      truncated: false,
      columns: BOND_COLUMNS,
      rows: BOND_SEEDS.map((seed, i) => ({
        product_id: seed.id,
        name: seed.name,
        cited: i < 2,
        values: {
          code: cell(seed.id, seed.id),
          credit_grade: cell(seed.grade, seed.grade),
          coupon_rate: cell(`${seed.coupon.toFixed(2)}%`, seed.coupon),
          maturity_date: cell(seed.maturity, seed.maturity),
          subordinated: cell("아님", false),
        },
      })),
    },
  ],
  clarify: null,
  suggestions: [],
  trace: trace(
    [
      {
        stage: "route",
        label: "라우팅",
        ms: 5,
        detail: "채권 · 복합 조건",
        query: null,
      },
      {
        stage: "query",
        label: "조회",
        ms: 44,
        detail: "4행",
        query:
          "SELECT code, name, credit_grade, coupon_rate, maturity_date, subordinated\n  FROM sample_bond\n WHERE grade_rank(credit_grade) <= grade_rank($1) AND subordinated = $2\n ORDER BY coupon_rate DESC\n LIMIT $3;  -- $1 = 'AA0', $2 = false, $3 = 10",
      },
      { stage: "gate", label: "게이트", ms: 2, detail: "통과", query: null },
      {
        stage: "generate",
        label: "생성",
        ms: 2410,
        detail: "문장 1개",
        query: null,
      },
      {
        stage: "verify",
        label: "검증",
        ms: 2,
        detail: "인용 수치 4개 일치",
        query: null,
      },
      RENDER,
    ],
    true,
    { prompt: 1104, completion: 64 },
  ),
};

/** outcome 8종 대표 픽스처. 계약·화면 테스트가 이 목록을 돈다. */
export const OUTCOME_FIXTURES = {
  answered,
  caveat,
  no_result: noResult,
  not_collected: notCollected,
  unavailable,
  ambiguous,
  refused,
  error: errorOutcome,
} as const;

export const ALL_SEARCH_FIXTURES: SearchResponse[] = [
  ...Object.values(OUTCOME_FIXTURES),
  fallback,
  count,
  bond,
];

// ---------------------------------------------------------------------------
// 상품 상세

/** 검색 결과 행에서 상세를 만든다. 상세 화면 동작을 보이기 위한 합성 데이터다. */
function detailFromRow(group: ResultGroup, row: ResultRow): ProductDetail {
  const asOf =
    group.domain === "bond" || group.domain === "kr_etn" ? BOND_DATE : ETF_DATE;
  const field = (key: string) => {
    const column = group.columns.find((c) => c.key === key)!;
    const value = row.values[key];
    return {
      key,
      label: column.label,
      kind: column.kind,
      display: value.display,
      raw: value.raw,
      src: value.src,
      note: value.note,
      as_of: asOf,
    };
  };
  const has = (key: string) => key in row.values;
  const manager = row.name.startsWith("SAMPLE")
    ? "SAMPLE자산운용"
    : "DEMO자산운용";

  const groups: ProductDetail["groups"] = [
    {
      key: "basic",
      label: "기본정보",
      fields: [
        {
          key: "name",
          label: "상품명",
          kind: "text",
          display: row.name,
          raw: row.name,
          src: "system-provided",
          note: null,
          as_of: asOf,
        },
        field("code"),
        {
          key: "manager",
          label: group.domain === "bond" ? "발행사" : "운용사",
          kind: "text",
          display: group.domain === "bond" ? row.name.split(" ")[0] : manager,
          raw: manager,
          src: "system-provided",
          note: null,
          as_of: asOf,
        },
        {
          key: "listed_date",
          label: group.domain === "bond" ? "발행일" : "상장일",
          kind: "date",
          display: "2021-04-12",
          raw: "2021-04-12",
          src: "system-provided",
          note: null,
          as_of: asOf,
        },
      ],
    },
  ];
  if (has("expense_ratio"))
    groups.push({
      key: "cost",
      label: "비용",
      fields: [
        field("expense_ratio"),
        {
          key: "ter",
          label: "총비용비율(TER)",
          kind: "percent",
          display: "—",
          raw: null,
          src: "unavailable",
          note: "이 상품군은 원천 자료에 TER 항목이 없습니다.",
          as_of: null,
        },
      ],
    });
  if (has("return_1y"))
    groups.push({
      key: "return",
      label: "수익률",
      fields: [
        field("return_1y"),
        {
          key: "return_3m",
          label: "3개월 수익률",
          kind: "return",
          display: "+2.4%",
          raw: 2.4,
          src: "computed",
          note: "기준가 시계열에서 계산한 값입니다.",
          as_of: asOf,
        },
      ],
    });
  if (has("coupon_rate"))
    groups.push({
      key: "rate",
      label: "금리·만기",
      fields: [
        field("coupon_rate"),
        field("maturity_date"),
        field("subordinated"),
      ],
    });
  const riskFields = ["risk_grade", "credit_grade"].filter(has).map(field);
  if (riskFields.length > 0)
    groups.push({ key: "risk", label: "위험", fields: riskFields });
  if (has("aum"))
    groups.push({ key: "size", label: "규모", fields: [field("aum")] });

  const relations: ProductDetail["relations"] =
    group.domain === "kr_etf"
      ? [
          {
            type: "holding",
            label: "상위 구성종목",
            items: [
              {
                id: "C-SMP-01",
                name: "SAMPLE전자",
                display: "24.1%",
                question: "SAMPLE전자를 편입한 국내 ETF",
              },
              {
                id: "C-DMO-02",
                name: "DEMO하이텍",
                display: "9.8%",
                question: "DEMO하이텍을 편입한 국내 ETF",
              },
              {
                id: "C-SMP-03",
                name: "SAMPLE바이오",
                display: "3.2%",
                question: "SAMPLE바이오를 편입한 국내 ETF",
              },
            ],
          },
          {
            type: "manager",
            label: "운용사",
            items: [
              {
                id: null,
                name: manager,
                display: null,
                question: `${manager}가 운용하는 국내 ETF 순자산 큰 순`,
              },
            ],
          },
          {
            type: "index",
            label: "기초지수",
            items: [
              {
                id: null,
                name: `${row.name.split(" ")[1] ?? "SAMPLE"} 지수`,
                display: null,
                question: null,
              },
            ],
          },
        ]
      : [];

  return {
    domain: group.domain,
    domain_label: DOMAIN_LABEL[group.domain],
    product_id: row.product_id,
    name: row.name,
    groups,
    relations,
  };
}

export const PRODUCT_FIXTURES: ProductDetail[] = (() => {
  const seen = new Map<string, ProductDetail>();
  for (const response of ALL_SEARCH_FIXTURES)
    for (const group of response.results)
      for (const row of group.rows) {
        const key = `${group.domain}/${row.product_id}`;
        if (!seen.has(key)) seen.set(key, detailFromRow(group, row));
      }
  return [...seen.values()];
})();

// ---------------------------------------------------------------------------
// 메타

export const meta: Meta = {
  domains: [
    { domain: "kr_etf", label: "국내 ETF", count: 1180, base_date: ETF_DATE },
    { domain: "xx_etf", label: "해외 ETF", count: 5400, base_date: ETF_DATE },
    { domain: "kr_etn", label: "국내 ETN", count: 312, base_date: BOND_DATE },
    { domain: "xx_etn", label: "해외 ETN", count: 260, base_date: ETF_DATE },
    { domain: "bond", label: "채권", count: 4210, base_date: BOND_DATE },
    { domain: "fund", label: "공모펀드", count: 9850, base_date: BOND_DATE },
  ],
  // 실제 칩은 P7 sweep에서 기대 outcome이 확인된 gold id만 서버가 내려준다(37 §2-2).
  examples: [
    {
      id: "MOCK-1",
      category: "순위",
      question: answered.question,
      expected_outcome: "answered",
    },
    {
      id: "MOCK-2",
      category: "복합 조건",
      question: caveat.question,
      expected_outcome: "caveat",
    },
    {
      id: "MOCK-3",
      category: "개수",
      question: count.question,
      expected_outcome: "answered",
    },
    {
      id: "MOCK-4",
      category: "채권",
      question: bond.question,
      expected_outcome: "answered",
    },
    {
      id: "MOCK-5",
      category: "수집 범위 밖",
      question: notCollected.question,
      expected_outcome: "not_collected",
    },
    {
      id: "MOCK-6",
      category: "거절",
      question: refused.question,
      expected_outcome: "refused",
    },
  ],
  llm_available: true,
};

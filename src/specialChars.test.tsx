import { readFileSync } from "node:fs";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { answered } from "./lib/fixtures";
import { linkAnswer } from "./lib/explain";
import { rowDomId } from "./lib/citeFocus";
import type { SearchResponse } from "./lib/types";
import {
  renderApp,
  resetViewport,
  searchPath,
  setViewport,
  testApi,
} from "./test/renderApp";

/*
 * 서버가 준 문자열(상품명·답변·notice·질문·칩)에 HTML·특수문자가 있어도 글자 그대로 보이고 실행되지 않는지 본다.
 * 화면은 문자열을 React 텍스트 노드로만 그린다(dangerouslySetInnerHTML 없음).
 */

afterEach(() => {
  resetViewport();
  delete (window as unknown as Record<string, unknown>).__pwned;
});

const SCRIPT_NAME = "<script>window.__pwned=1</script>";
const TRICKY_NAME = `A&B "인용" 'x' (주) [신] $1 .* \\d+ 🚀`;
const LONG_WORD = "가".repeat(180);

/** answered 의 첫 두 행 이름과 답변 문장을 위험한 문자열로 바꾼 응답. */
function hostile(): SearchResponse {
  const response = structuredClone(answered);
  const [first, second] = response.results[0].rows;
  const originalFirst = first.name;
  const originalSecond = second.name;
  first.name = SCRIPT_NAME;
  second.name = TRICKY_NAME;
  response.answer.text =
    `${response.answer.text}`
      .replace(originalFirst, SCRIPT_NAME)
      .replace(originalSecond, TRICKY_NAME) +
    ` <img src=x onerror="window.__pwned=1"> 줄바꿈\n두 번째 줄 ${LONG_WORD}`;
  response.answer.notices = [
    { code: "AXIS_ABSENT", text: `<b>굵게</b> & "따옴표" ${LONG_WORD}` },
  ];
  response.suggestions = [
    {
      label: `<i>칩</i> & 🚀`,
      question: `질문 <script>x</script> ${LONG_WORD}`,
    },
  ];
  response.interpretation.mappings = [];
  response.interpretation.graph = { nodes: [], edges: [] };
  response.question = `질문 <script>window.__pwned=1</script> & "x" 😀 ${LONG_WORD}`;
  return response;
}

function renderHostile() {
  setViewport(1280);
  const response = hostile();
  renderApp({
    api: testApi({ search: vi.fn().mockResolvedValue(response) }),
    path: searchPath("보통 질문"),
  });
  return response;
}

describe("special characters", () => {
  test("product names, answer, notices and chips are shown as text and never run", async () => {
    renderHostile();
    await screen.findByRole("region", { name: "답변" });
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect(
      (window as unknown as Record<string, unknown>).__pwned,
    ).toBeUndefined();
    expect(
      screen.getAllByText(SCRIPT_NAME, { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(TRICKY_NAME, { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/<b>굵게<\/b> & "따옴표"/)).toBeVisible();
    expect(screen.getByText(/<i>칩<\/i> & 🚀/)).toBeVisible();
  });

  test("newline in the answer is kept as text and emoji survive", async () => {
    renderHostile();
    const answer = await screen.findByRole("region", { name: "답변" });
    expect(answer.textContent).toContain("줄바꿈\n두 번째 줄");
  });

  test("table rows get safe DOM ids even when the name has quotes and angle brackets", async () => {
    renderHostile();
    await screen.findByRole("region", { name: "답변" });
    const ids = [...document.querySelectorAll("[id^='row-']")].map(
      (el) => el.id,
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("answer links match names literally even with regular expression characters", () => {
    const response = hostile();
    // 이름·값이 질문 문장에 그대로 있으면 정규식 문자가 있어도 정확히 그 글자만 잇는다.
    const segments = linkAnswer(response.answer.text, response.results);
    const linked = segments.filter((s) => s.cite).map((s) => s.text);
    expect(linked).toContain(TRICKY_NAME);
    expect(segments.map((s) => s.text).join("")).toBe(response.answer.text);
  });

  test("row ids never contain characters that need escaping", () => {
    expect(rowDomId("kr_etf", `a"b<c>&'d e`)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("long unbroken words are allowed to wrap by the stylesheet", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).toMatch(/\.card\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.answer__text\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(
      /\.question-chip__question\s*\{[^}]*overflow-wrap:\s*anywhere/,
    );
  });
});

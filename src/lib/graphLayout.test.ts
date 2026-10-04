import { describe, expect, test } from "vitest";
import {
  ambiguous,
  answered,
  bond,
  caveat,
  caveatOutage,
  count,
  noResult,
  notCollected,
  unavailable,
} from "./fixtures";
import {
  graphLayers,
  layoutGraph,
  splitLabel,
  textWidth,
  type GraphLayout,
} from "./graphLayout";
import type { SearchResponse } from "./types";

const ALL: Array<[string, SearchResponse]> = [
  ["answered", answered],
  ["caveat", caveat],
  ["caveatOutage", caveatOutage],
  ["noResult", noResult],
  ["notCollected", notCollected],
  ["unavailable", unavailable],
  ["ambiguous", ambiguous],
  ["count", count],
  ["bond", bond],
];

function overlaps(layout: GraphLayout): string[] {
  const out: string[] = [];
  const ns = layout.nodes;
  for (let i = 0; i < ns.length; i++)
    for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i];
      const b = ns[j];
      if (
        a.x < b.x + b.w &&
        b.x < a.x + a.w &&
        a.y < b.y + b.h &&
        b.y < a.y + a.h
      )
        out.push(`${a.node.id}×${b.node.id}`);
    }
  return out;
}

describe("layoutGraph", () => {
  test.each(ALL)(
    "%s: 모든 노드·간선을 놓고, 상자끼리 겹치지 않는다",
    (_, r) => {
      const graph = r.interpretation.graph;
      for (const orientation of ["horizontal", "vertical"] as const) {
        const layout = layoutGraph(graph, orientation, 300);
        expect(layout.nodes).toHaveLength(graph.nodes.length);
        expect(layout.edges).toHaveLength(graph.edges.length);
        expect(overlaps(layout), orientation).toEqual([]);
        for (const p of layout.nodes) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x + p.w).toBeLessThanOrEqual(layout.width + 0.01);
          expect(p.y + p.h).toBeLessThanOrEqual(layout.height + 0.01);
        }
      }
    },
  );

  test("상위 클래스가 앞 층, 상품은 모두 같은 마지막 층", () => {
    const layers = graphLayers(caveat.interpretation.graph);
    expect(layers.get("c0")).toBe(0);
    expect(layers.get("c1")).toBe(1);
    const productLayers = caveat.interpretation.graph.nodes
      .filter((n) => n.kind === "product")
      .map((n) => layers.get(n.id));
    expect(new Set(productLayers).size).toBe(1);
    expect(productLayers[0]).toBe(Math.max(...layers.values()));
  });

  test("가로 배치는 층이 왼쪽→오른쪽", () => {
    const layout = layoutGraph(bond.interpretation.graph, "horizontal");
    const x = (id: string) => layout.nodes.find((p) => p.node.id === id)!.x;
    expect(x("c0")).toBeLessThan(x("c1"));
    expect(x("s0")).toBeLessThan(x("s1"));
    expect(x("s3")).toBeLessThan(x("p0"));
  });

  test("세로 배치는 폭을 넘지 않고, 집합 상자 3개가 한 줄에 들어간다", () => {
    const layout = layoutGraph(caveat.interpretation.graph, "vertical", 310);
    expect(layout.width).toBe(310);
    const y = (id: string) => layout.nodes.find((p) => p.node.id === id)!.y;
    // 퇴직연금 층(ETF·제외·ETN)이 한 줄
    expect(new Set([y("s1"), y("tx"), y("t1")].map(Math.round)).size).toBe(1);
  });

  test("순환이 있어도 멈춘다", () => {
    const graph = structuredClone(answered.interpretation.graph);
    graph.edges.push({
      from: "s1",
      to: "s0",
      kind: "constraint",
      label: null,
      mapping: null,
      weight: null,
      state: null,
    });
    expect(() => layoutGraph(graph, "horizontal")).not.toThrow();
  });
});

describe("글자 폭·줄 나눔", () => {
  test("한글은 1em, 그 밖은 0.6em", () => {
    expect(textWidth("가나", 10)).toBe(20);
    expect(textWidth("ab", 10)).toBe(12);
  });

  test("띄어쓰기에서 두 줄로 나누고, 넘치면 …", () => {
    expect(splitLabel("퇴직연금 값 없음 · 제외", 80, 11)).toEqual([
      "퇴직연금 값",
      "없음 · 제외",
    ]);
    const [, second] = splitLabel("가".repeat(30), 50, 10);
    expect(second.endsWith("…")).toBe(true);
    expect(splitLabel("짧음", 80)).toEqual(["짧음"]);
  });
});

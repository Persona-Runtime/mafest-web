import type { GraphEdge, GraphNode, SearchGraph } from "./types";

/**
 * 탐색 그래프 배치. 노드 40개 이하의 층 구조(온톨로지 → 집합 → 상품 → 관계)라 범용 그래프
 * 배치 라이브러리 없이 계산한다.
 *
 * 1) 층: 간선을 따라 가장 긴 경로로 층을 매긴다. subclass(하위→상위)만 거꾸로 봐서 상위
 *    클래스가 앞(왼쪽·위)에 온다.
 * 2) 층 안 순서: 앞 층 이웃들의 평균 위치(barycenter)로 정렬해 선이 덜 엇갈리게 한다.
 * 3) 가로(넓은 화면)는 층 = 열, 세로(좁은 화면)는 층 = 행이며 행이 넘치면 줄을 바꾼다.
 */

export type Orientation = "horizontal" | "vertical";

export interface PlacedNode {
  node: GraphNode;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  /** 상자 안에 쓸 글줄(집합·상품은 폭에 맞춰 줄이거나 두 줄로 나눈 결과). */
  lines: string[];
}

export interface PlacedEdge {
  edge: GraphEdge;
  path: string;
  /** 번호 배지·라벨을 놓을 자리. */
  mid: { x: number; y: number };
}

export interface GraphLayout {
  orientation: Orientation;
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

const FONT = 12;

/** 글자 폭 어림: 한글·한자 1em, 그 밖 0.6em. 실제 측정 없이 상자 크기를 정한다. */
export function textWidth(text: string, size = FONT): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    w += code >= 0x1100 ? size : size * 0.6;
  }
  return w;
}

/** 상자 폭에 맞춰 글자를 줄인다(끝에 …). */
export function fitText(text: string, max: number, size = FONT): string {
  if (textWidth(text, size) <= max) return text;
  const chars = [...text];
  while (chars.length > 1 && textWidth(chars.join("") + "…", size) > max)
    chars.pop();
  return chars.join("") + "…";
}

/** 두 줄까지 나눈다. 띄어쓰기에서 먼저 끊고, 한 낱말이 넘치면 글자 단위로 끊는다. */
export function splitLabel(text: string, max: number, size = FONT): string[] {
  if (textWidth(text, size) <= max) return [text];
  const words = text.split(" ");
  let first = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (textWidth(next, size) > max) break;
    first = next;
  }
  if (!first) {
    // 첫 낱말부터 넘친다: 글자 단위.
    const chars = [...text];
    let k = 0;
    while (
      k < chars.length &&
      textWidth(chars.slice(0, k + 1).join(""), size) <= max
    )
      k++;
    return [
      chars.slice(0, k).join(""),
      fitText(chars.slice(k).join("").trim(), max, size),
    ];
  }
  return [first, fitText(words.slice(i).join(" "), max, size)];
}

/** 노드 상자 크기. 상품명은 길면 잘라서 그린다. */
export const MAX_PRODUCT_WIDTH = 156;
/** 좁은 화면(세로 배치)에서 집합 상자 폭 상한과 글자 크기. 한 층에 상자 3개가 들어가게. */
const COMPACT_SET_WIDTH = 92;
export const COMPACT_FONT = 11;

export function nodeBox(
  node: GraphNode,
  orientation: Orientation = "horizontal",
): { w: number; h: number; lines: string[] } {
  const label = textWidth(node.label);
  const compact = orientation === "vertical";
  switch (node.kind) {
    case "concept":
      return { w: Math.max(84, label + 28), h: 40, lines: [node.label] };
    case "individual":
      return { w: Math.max(64, label + 24), h: 28, lines: [node.label] };
    case "set": {
      if (!compact) {
        const w = Math.max(108, Math.min(170, label + 24));
        return { w, h: 52, lines: [fitText(node.label, w - 16)] };
      }
      const lines = splitLabel(
        node.label,
        COMPACT_SET_WIDTH - 14,
        COMPACT_FONT,
      );
      const widest = Math.max(...lines.map((l) => textWidth(l, COMPACT_FONT)));
      return {
        w: Math.max(80, Math.min(COMPACT_SET_WIDTH, widest + 16)),
        h: lines.length > 1 ? 62 : 50,
        lines,
      };
    }
    case "product": {
      const w = Math.min(MAX_PRODUCT_WIDTH, label + 36);
      return {
        w,
        h: 30,
        lines: [fitText(node.label, w - (node.cited ? 34 : 22))],
      };
    }
    case "entity":
      return { w: Math.max(92, label + 28), h: 44, lines: [node.label] };
  }
}

/** 하위 호환: 크기만. */
export function nodeSize(node: GraphNode): { w: number; h: number } {
  const { w, h } = nodeBox(node);
  return { w, h };
}

/**
 * 노드별 층 번호. 간선 방향대로 가장 긴 경로를 쓰고, 상품 노드는 모두 같은(가장 깊은) 층에
 * 모아 상품이 한 열(행)에 나란히 오게 한다. 관계 개체는 그 다음 층으로 밀린다.
 */
export function graphLayers(graph: SearchGraph): Map<string, number> {
  // subclass는 하위→상위로 오므로 뒤집어 상위가 먼저 오게 한다.
  const directed = graph.edges.map((e) =>
    e.kind === "subclass" ? { from: e.to, to: e.from } : e,
  );
  const layer = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  const cap = graph.nodes.length;
  // 노드 수가 작으므로(≤40) 벨만-포드식 반복으로 가장 긴 경로를 구한다. 순환이 있어도
  // 층이 노드 수를 넘지 않게 막아 멈춘다.
  const relax = () => {
    for (let i = 0; i < cap; i++) {
      let changed = false;
      for (const e of directed) {
        const next = (layer.get(e.from) ?? 0) + 1;
        if (next > (layer.get(e.to) ?? 0) && next < cap) {
          layer.set(e.to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
  };
  relax();
  const products = graph.nodes.filter((n) => n.kind === "product");
  if (products.length > 0) {
    const deepest = Math.max(...products.map((n) => layer.get(n.id) ?? 0));
    for (const n of products) layer.set(n.id, deepest);
    relax();
  }
  return layer;
}

export function layoutGraph(
  graph: SearchGraph,
  orientation: Orientation,
  maxWidth = 360,
): GraphLayout {
  const layerOf = graphLayers(graph);
  const layers: GraphNode[][] = [];
  for (const node of graph.nodes) {
    const l = layerOf.get(node.id) ?? 0;
    (layers[l] ??= []).push(node);
  }
  const compact = layers.filter((l) => l && l.length > 0);

  // 앞 층 이웃의 평균 순번으로 정렬(한 번 훑기).
  const order = new Map<string, number>();
  const neighbors = (id: string) =>
    graph.edges
      .filter((e) => e.to === id || e.from === id)
      .map((e) => (e.to === id ? e.from : e.to));
  compact.forEach((nodes, li) => {
    if (li > 0) {
      const score = (n: GraphNode) => {
        const prev = neighbors(n.id)
          .map((id) => order.get(id))
          .filter((v): v is number => v !== undefined);
        return prev.length
          ? prev.reduce((a, b) => a + b, 0) / prev.length
          : Number.MAX_SAFE_INTEGER;
      };
      nodes.sort((a, b) => score(a) - score(b));
    }
    nodes.forEach((n, i) => order.set(n.id, i));
  });

  const placed = new Map<string, PlacedNode>();
  const PAD = 12;

  if (orientation === "horizontal") {
    const GAP_X = 40;
    const GAP_Y = 14;
    let x = PAD;
    const columns = compact.map((nodes, li) => {
      const sizes = nodes.map((n) => nodeBox(n, "horizontal"));
      const colW = Math.max(...sizes.map((s) => s.w));
      const colH =
        sizes.reduce((a, s) => a + s.h, 0) + GAP_Y * (nodes.length - 1);
      const col = { nodes, sizes, x, colW, colH, li };
      x += colW + GAP_X;
      return col;
    });
    const height = Math.max(...columns.map((c) => c.colH)) + PAD * 2;
    for (const col of columns) {
      let y = PAD + (height - PAD * 2 - col.colH) / 2;
      col.nodes.forEach((node, i) => {
        const { w, h, lines } = col.sizes[i];
        placed.set(node.id, {
          node,
          x: col.x + (col.colW - w) / 2,
          y,
          w,
          h,
          layer: col.li,
          lines,
        });
        y += h + GAP_Y;
      });
    }
    return finish(graph, placed, x - GAP_X + PAD, height, orientation);
  }

  // 세로: 층 = 행. 행이 maxWidth를 넘으면 줄을 바꾼다.
  const GAP_X = 8;
  const GAP_Y = 36;
  const ROW_GAP = 14;
  const VPAD = 8;
  const inner = maxWidth - VPAD * 2;
  let y = PAD;
  compact.forEach((nodes, li) => {
    const sizes = nodes.map((n) => nodeBox(n, "vertical"));
    const lines: number[][] = [[]];
    let lineW = 0;
    sizes.forEach((s, i) => {
      const w = Math.min(s.w, inner);
      if (lineW > 0 && lineW + GAP_X + w > inner) {
        lines.push([]);
        lineW = 0;
      }
      lines[lines.length - 1].push(i);
      lineW += (lineW > 0 ? GAP_X : 0) + w;
    });
    lines.forEach((line, k) => {
      const widths = line.map((i) => Math.min(sizes[i].w, inner));
      const total =
        widths.reduce((a, b) => a + b, 0) + GAP_X * (line.length - 1);
      let x = VPAD + (inner - total) / 2;
      const lineH = Math.max(...line.map((i) => sizes[i].h));
      line.forEach((i, j) => {
        placed.set(nodes[i].id, {
          node: nodes[i],
          x,
          y: y + (lineH - sizes[i].h) / 2,
          w: widths[j],
          h: sizes[i].h,
          layer: li,
          lines: sizes[i].lines,
        });
        x += widths[j] + GAP_X;
      });
      y += lineH + (k < lines.length - 1 ? ROW_GAP : 0);
    });
    y += GAP_Y;
  });
  return finish(graph, placed, maxWidth, y - GAP_Y + PAD, orientation);
}

function finish(
  graph: SearchGraph,
  placed: Map<string, PlacedNode>,
  width: number,
  height: number,
  orientation: Orientation,
): GraphLayout {
  const edges: PlacedEdge[] = [];
  for (const edge of graph.edges) {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    if (!a || !b) continue;
    edges.push({ edge, ...route(a, b, orientation) });
  }
  return { orientation, width, height, nodes: [...placed.values()], edges };
}

/** 두 상자 사이 곡선. 같은 층(세로 쌓임)이면 옆면끼리 잇는다. */
function route(
  a: PlacedNode,
  b: PlacedNode,
  orientation: Orientation,
): { path: string; mid: { x: number; y: number } } {
  if (orientation === "horizontal") {
    if (a.layer === b.layer) {
      // 같은 열: 위·아래로 잇는다.
      const [top, bottom] = a.y < b.y ? [a, b] : [b, a];
      const x1 = top.x + top.w / 2;
      const y1 = top.y + top.h;
      const x2 = bottom.x + bottom.w / 2;
      const y2 = bottom.y;
      return {
        path: `M${x1},${y1} L${x2},${y2}`,
        mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
      };
    }
    const [from, to] = a.x < b.x ? [a, b] : [b, a];
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const dx = (x2 - x1) / 2;
    return {
      path: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
      mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
    };
  }
  if (a.layer === b.layer) {
    const [left, right] = a.x < b.x ? [a, b] : [b, a];
    const x1 = left.x + left.w;
    const y1 = left.y + left.h / 2;
    const x2 = right.x;
    const y2 = right.y + right.h / 2;
    return {
      path: `M${x1},${y1} L${x2},${y2}`,
      mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
    };
  }
  const [from, to] = a.y < b.y ? [a, b] : [b, a];
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2;
  const y2 = to.y;
  const dy = (y2 - y1) / 2;
  return {
    path: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`,
    mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
  };
}

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * 공개 URL이지만 검색엔진 색인은 막는다(mafest 37 §0). 빌드 입력 파일을 직접 검사한다.
 * 컨테이너 응답 헤더(X-Robots-Tag)는 scripts/verify-container.sh가 본다.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("검색엔진 차단", () => {
  test("robots.txt가 전체를 막는다", () => {
    expect(read("public/robots.txt").split("\n")).toContain("Disallow: /");
  });

  test("index.html에 noindex", () => {
    expect(read("index.html")).toMatch(
      /<meta name="robots" content="noindex, nofollow" \/>/,
    );
  });

  test("nginx가 앱 라우트를 셸로 돌려주고 noindex 헤더를 붙인다", () => {
    const conf = read("nginx/default.conf");
    expect(conf).toContain("location ~ ^/(search|about|products/[^/]+/[^/]+)$");
    expect(conf.match(/X-Robots-Tag "noindex, nofollow"/g)?.length).toBe(3);
  });
});

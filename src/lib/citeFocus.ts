import { createContext, useContext } from "react";
import type { CiteTarget } from "./explain";

/**
 * 답변 문장의 숫자·상품명 ↔ 결과 표의 행·칸 연결 상태. 답변에서 값에 마우스를 올리거나
 * 키보드로 초점을 주면 표의 그 칸이 함께 강조된다.
 */
export interface CiteFocus {
  focus: CiteTarget | null;
  setFocus: (target: CiteTarget | null) => void;
}

export const CiteFocusContext = createContext<CiteFocus>({
  focus: null,
  setFocus: () => {},
});

export function useCiteFocus(): CiteFocus {
  return useContext(CiteFocusContext);
}

/** 결과 행의 DOM id. 답변에서 값을 누르면 이 행으로 스크롤한다. */
export function rowDomId(domain: string, productId: string): string {
  return `row-${domain}-${productId}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

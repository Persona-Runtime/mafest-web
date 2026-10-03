import { useEffect } from "react";
import { SITE_NAME } from "./site";

/** 문서 제목. 탭·방문 기록에서 어떤 질문이었는지 알 수 있게 한다. */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}

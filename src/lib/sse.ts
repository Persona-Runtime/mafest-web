import { ContractError } from "./validate";

/** SSE 한 건. data는 JSON으로 읽은 값이고 이름·구조 검사는 호출한 쪽이 한다. */
export interface RawSseEvent {
  event: string;
  data: unknown;
}

/**
 * `text/event-stream` 본문을 이벤트 단위로 읽는다.
 *
 * - 바이트 청크 경계는 임의이므로 두 가지를 이어 붙인다: 한글 같은 여러 바이트 글자(TextDecoder의
 *   stream 모드)와 줄·이벤트(빈 줄이 오기 전까지 버퍼).
 * - `:`로 시작하는 줄은 주석(`: ping`)이라 버린다.
 * - 이벤트 끝(빈 줄)을 만나지 못한 채 연결이 끝나면 그 이벤트는 버린다. 끊긴 이벤트를 완성된 것처럼 읽지 않는다.
 * - data가 JSON이 아니면 ContractError(계약 위반)로 끝낸다.
 *
 * 이터레이터를 도중에 닫으면(break·return·throw) 본문 읽기를 취소한다.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<RawSseEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let pending = "";
  let eventName = "message";
  let dataLines: string[] = [];

  /** 줄 하나를 처리한다. 이벤트가 완성되면 돌려준다. */
  const consumeLine = (line: string): RawSseEvent | null => {
    if (line === "") {
      const done = dataLines.length > 0;
      const event = eventName;
      const text = dataLines.join("\n");
      eventName = "message";
      dataLines = [];
      if (!done) return null;
      try {
        return { event, data: JSON.parse(text) };
      } catch {
        throw new ContractError("stream.data");
      }
    }
    if (line.startsWith(":")) return null;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") dataLines.push(value);
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let start = 0;
      for (;;) {
        const match = /\r\n|\n|\r/.exec(pending.slice(start));
        if (match === null) break;
        // "\r"이 청크 끝이면 다음 청크의 "\n"과 한 줄바꿈일 수 있어 기다린다.
        if (match[0] === "\r" && start + match.index + 1 === pending.length)
          break;
        const line = pending.slice(start, start + match.index);
        start += match.index + match[0].length;
        const event = consumeLine(line);
        if (event !== null) yield event;
      }
      pending = pending.slice(start);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

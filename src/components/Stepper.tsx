import { formatMs } from "../lib/format";
import type { StepState } from "../lib/explain";
import { Icon, type IconName } from "./Icon";

export interface StepItem {
  key: string;
  label: string;
  state: StepState;
  ms?: number | null;
  detail?: string | null;
  note?: string | null;
}

const STATE_ICON: Record<StepState, IconName> = {
  done: "check",
  warn: "alert",
  stopped: "stop",
  failed: "close",
  skipped: "minus",
};

/** 색만으로 상태를 전하지 않도록 스크린리더용 상태 이름을 함께 둔다. */
const STATE_TEXT: Record<StepState, string> = {
  done: "완료",
  warn: "주의",
  stopped: "여기서 멈춤",
  failed: "실패",
  skipped: "건너뜀",
};

/**
 * 처리 단계 표시. 같은 DOM을 CSS만으로 넓은 화면은 가로, 좁은 화면(<720px)은 세로
 * 타임라인으로 그린다(둘을 따로 그리면 스크린리더가 두 번 읽는다).
 */
export function Stepper({
  steps,
  label,
}: {
  steps: StepItem[];
  label: string;
}) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((step) => (
        <li key={step.key} className={`step step--${step.state}`}>
          <span className="step__dot" aria-hidden="true">
            <Icon name={STATE_ICON[step.state]} size={14} />
          </span>
          <div className="step__body">
            <div className="step__line">
              <span className="step__label">
                {step.label}
                <span className="visually-hidden">
                  {" "}
                  ({STATE_TEXT[step.state]})
                </span>
              </span>
              {step.ms != null && (
                <span className="step__ms num">{formatMs(step.ms)}</span>
              )}
            </div>
            {step.detail && <p className="step__detail">{step.detail}</p>}
            {step.note && <p className="step__note">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

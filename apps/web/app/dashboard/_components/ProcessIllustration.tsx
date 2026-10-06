/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import styles from "./process-illustration.module.css";

export type ProcessKind = "picking" | "assembly" | "pokayoke" | "delivery";

/** Decorative process illustrations; movement never represents a recorded transaction. */
export default function ProcessIllustration({
    kind,
    active,
}: {
    kind: ProcessKind;
    active: boolean;
}) {
    return (
        <svg
            className={styles.illustration}
            data-process={kind}
            data-active={active}
            viewBox="0 0 120 96"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {kind === "picking" && (
                <>
                    <path
                        className={styles.structure}
                        d="M9 81V15h43v66M9 45h43M9 75h43"
                    />
                    <path
                        className={styles.surface}
                        d="M17 24h26v21H17zM17 55h26v20H17z"
                    />
                    <path d="M30 25v8m0 23v7" />
                    <g className={styles.pickBox}>
                        <path className={styles.accent} d="M69 27h29v26H69z" />
                        <path d="M83 28v9" />
                    </g>
                    <path d="M58 48h6l7 26h31l8-21H67" />
                    <circle className={styles.wheel} cx="76" cy="83" r="5" />
                    <circle className={styles.wheel} cx="98" cy="83" r="5" />
                </>
            )}
            {kind === "assembly" && (
                <>
                    <rect
                        className={styles.surface}
                        x="10"
                        y="71"
                        width="100"
                        height="13"
                        rx="6.5"
                    />
                    <path
                        className={styles.structure}
                        d="M20 84v7m80-7v7M15 68V54h20v14"
                    />
                    <g className={styles.robotArm}>
                        <path strokeWidth="9" d="M25 54 42 33 63 43" />
                        <circle
                            className={styles.joint}
                            cx="42"
                            cy="33"
                            r="6"
                        />
                        <path d="m63 43 8-6 10 5m-10-5 2-11" />
                    </g>
                    <path className={styles.accent} d="M75 51h23v19H75z" />
                    <path d="M87 51v7" />
                    <path
                        className={styles.belt}
                        d="M23 77h5m15 0h5m15 0h5m15 0h5"
                    />
                </>
            )}
            {kind === "pokayoke" && (
                <>
                    <rect
                        className={styles.surface}
                        x="24"
                        y="20"
                        width="69"
                        height="66"
                        rx="5"
                    />
                    <path d="M35 36h10m-10 9h24" />
                    <path
                        className={styles.barcode}
                        d="M35 56v16m7-16v16m9-16v16m5-16v16m9-16v16m8-16v16m7-16v16"
                    />
                    <path className={styles.scanLine} d="M16 48h84" />
                    <circle className={styles.accent} cx="90" cy="24" r="17" />
                    <path strokeWidth="4" d="m82 24 6 6 11-13" />
                </>
            )}
            {kind === "delivery" && (
                <>
                    <path
                        className={styles.road}
                        d="M7 87h12m13 0h18m13 0h18m13 0h18"
                    />
                    <g className={styles.truck}>
                        <path className={styles.accent} d="M13 27h59v47H13z" />
                        <path
                            className={styles.surface}
                            d="M72 43h22l15 19v12H72z"
                        />
                        <path d="M81 49h9l9 13H81zM20 43h32m-32 8h23" />
                        <circle
                            className={styles.wheel}
                            cx="33"
                            cy="75"
                            r="10"
                        />
                        <circle
                            className={styles.wheel}
                            cx="91"
                            cy="75"
                            r="10"
                        />
                        <path d="M33 73v4m58-4v4" />
                    </g>
                </>
            )}
        </svg>
    );
}

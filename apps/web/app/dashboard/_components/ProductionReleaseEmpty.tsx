"use client";

import { useState } from "react";
import styles from "./ProductionReleaseEmpty.module.css";

export default function ProductionReleaseEmpty() {
  const [paused, setPaused] = useState(false);

  return (
    <div className={styles.empty}>
      <div className={styles.scene} data-paused={paused} aria-hidden="true">
        <svg className={styles.cloud} viewBox="0 0 64 24">
          <path d="M2 21h58M12 20v-8h10V4h18v8h12v8" />
        </svg>
        <div className={styles.dino}>
          <svg viewBox="0 0 48 52" shapeRendering="crispEdges">
            <path
              fill="currentColor"
              d="M22 2h22v4h4v18H30v4h10v4H28v8H12v-4H8v-4H4v-6H0V14h4v8h4v4h6v4h4V10h4z"
            />
            <path className={styles.eye} d="M28 7h4v4h-4z" />
            <path className={styles.mouth} d="M34 18h14" />
            <path
              className={styles.legOne}
              fill="currentColor"
              d="M12 38h6v10h6v4H12z"
            />
            <path
              className={styles.legTwo}
              fill="currentColor"
              d="M24 38h6v10h6v4H24z"
            />
          </svg>
        </div>
        <div className={styles.obstacle}>
          <svg viewBox="0 0 30 42" shapeRendering="crispEdges">
            <path
              fill="currentColor"
              d="M12 0h6v42h-6V28H3v-4H0V12h6v10h6V0zm6 18h6V6h6v16h-4v2h-8z"
            />
          </svg>
        </div>
        <div className={styles.ground} />
      </div>
      <h2 className={styles.title}>No Active Production Release</h2>
      <p className={styles.description}>
        Released production orders will appear here automatically.
      </p>
      <button
        type="button"
        className={styles.pause}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? "Resume animation" : "Pause animation"}
      </button>
    </div>
  );
}

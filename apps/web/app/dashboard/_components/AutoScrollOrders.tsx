/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./dashboard.module.css";

export default function AutoScrollOrders({
    children,
    count,
    running,
}: {
    children: ReactNode;
    count: number;
    running: boolean;
}) {
    const viewport = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = viewport.current;
        if (!element) return;
        const resize = new ResizeObserver(() => {
            element.style.setProperty(
                "--order-row-height",
                `${Math.max(72, element.clientHeight / 3)}px`,
            );
        });
        resize.observe(element);
        return () => resize.disconnect();
    }, []);

    useEffect(() => {
        const element = viewport.current;
        if (!element || !running || count <= 1) return;
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        let frame = 0;
        let previous = 0;
        let position = element.scrollTop;
        let hold = 3000;
        let atEnd = false;

        const animate = (now: number) => {
            const elapsed = previous ? Math.min(now - previous, 50) : 0;
            previous = now;
            const limit = element.scrollHeight - element.clientHeight;
            const paused =
                reducedMotion.matches ||
                document.hidden ||
                element.matches(":hover") ||
                element.contains(document.activeElement);
            if (paused || limit <= 0) {
                position = element.scrollTop;
                hold = 3000;
                atEnd = false;
            } else {
                // Preserve manual scrolling, including touch/scrollbar movement.
                if (Math.abs(element.scrollTop - position) > 1.5) {
                    position = element.scrollTop;
                    hold = 3000;
                    atEnd = false;
                }
                if (hold > 0) {
                    hold -= elapsed;
                } else if (atEnd) {
                    element.scrollTop = 0;
                    position = 0;
                    hold = 3000;
                    atEnd = false;
                } else {
                    // Slow, time-based movement: 14 pixels per second.
                    position = Math.min(
                        limit,
                        position + (elapsed * 14) / 1000,
                    );
                    element.scrollTop = position;
                    if (position >= limit) {
                        hold = 3000;
                        atEnd = true;
                    }
                }
            }
            frame = window.requestAnimationFrame(animate);
        };
        frame = window.requestAnimationFrame(animate);
        return () => window.cancelAnimationFrame(frame);
    }, [running, count]);

    return (
        <div
            ref={viewport}
            className={styles.orderList}
            role="region"
            aria-label="PO progress, scroll to view all orders"
            tabIndex={0}
        >
            {children}
        </div>
    );
}

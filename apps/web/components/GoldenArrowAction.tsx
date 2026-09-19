/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */

"use client";

import type {MouseEvent} from "react";
import {ArrowRightOutlined} from "@ant-design/icons";
import {Button, Tooltip} from "antd";

type GoldenArrowActionProps = {
    ariaLabel: string;
    tooltip: string;
    onClick: () => void;
    disabled?: boolean;
};

export default function GoldenArrowAction({
                                              ariaLabel,
                                              tooltip,
                                              onClick,
                                              disabled = false,
                                          }: GoldenArrowActionProps) {
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onClick();
    };

    return (
        <Tooltip title={tooltip}>
            <Button
                type="text"
                size="small"
                aria-label={ariaLabel}
                disabled={disabled}
                icon={<ArrowRightOutlined style={{color: "#d4a106", fontSize: 12}}/>}
                onClick={handleClick}
                style={{width: 20, minWidth: 20, height: 20, padding: 0}}
            />
        </Tooltip>
    );
}

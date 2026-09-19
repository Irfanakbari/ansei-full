/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */

"use client";

import {useMemo, useState} from "react";

export function useSingleRowSelection<RecordType, KeyType extends string | number>(
    records: RecordType[],
    getKey: (record: RecordType) => KeyType,
) {
    const [selectedKey, setSelectedKey] = useState<KeyType | null>(null);
    const selectedRecord = useMemo(
        () => records.find((record) => getKey(record) === selectedKey),
        [getKey, records, selectedKey],
    );

    return {
        selectedKey,
        selectedRecord,
        selectRecord: (record: RecordType) => setSelectedKey(getKey(record)),
        clearSelection: () => setSelectedKey(null),
        isSelected: (record: RecordType) => getKey(record) === selectedKey,
    };
}

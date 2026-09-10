/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
import React from 'react';
import { Input, Space, Button } from 'antd';
import type { InputRef } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';

export function getColumnSearchProps<T>(
    dataIndex: string | string[],
    searchInputRef: React.RefObject<InputRef | null>,
    placeholder?: string
): Partial<ColumnType<T>> {
    const label = placeholder || (typeof dataIndex === 'string' ? dataIndex : dataIndex.join('.'));

    return {
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInputRef as any}
                    placeholder={`Search ${label}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={() => confirm()}
                        icon={<SearchOutlined />}
                        size="small"
                        style={{ width: 90 }}
                    >
                        Search
                    </Button>
                    <Button
                        onClick={() => {
                            if (clearFilters) clearFilters();
                            confirm();
                        }}
                        size="small"
                        style={{ width: 90 }}
                    >
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            let recordValue = record;
            if (Array.isArray(dataIndex)) {
                for (const key of dataIndex) {
                    recordValue = recordValue?.[key];
                }
            } else if (dataIndex.includes('.')) {
                const parts = dataIndex.split('.');
                for (const p of parts) {
                    recordValue = recordValue?.[p];
                }
            } else {
                recordValue = record[dataIndex];
            }

            if (recordValue === null || recordValue === undefined) return false;
            return recordValue.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    };
}

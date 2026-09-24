const fs = require('fs');
const path = 'apps/web/app/apps/warehouse/inventory-counting/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace imports
code = code.replace(
  "import { Table, Card, Breadcrumb, Tag, App, Progress, Tooltip } from 'antd';",
  "import { Table, Card, Breadcrumb, Tag, App, Progress, Tooltip, Dropdown } from 'antd';"
);
code = code.replace(
  "import { ReloadOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, FileExcelOutlined, CameraOutlined } from '@ant-design/icons';",
  "import { ReloadOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, FileExcelOutlined, CameraOutlined, DownOutlined, DownloadOutlined } from '@ant-design/icons';"
);

// Replace ToolbarWrapper block
const toolbarStart = code.indexOf('<ToolbarWrapper>');
const toolbarEnd = code.indexOf('</ToolbarWrapper>') + '</ToolbarWrapper>'.length;

const newToolbar = `<ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined />}
                    onClick={handleRefresh}
                />
                <ButtonToolbar
                    title="Create"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                />
                <ButtonToolbar
                    title="Detail"
                    icon={<EyeOutlined />}
                    onClick={handleViewDetail}
                    enable={selectedRowKeys.length === 1}
                />
                
                <Dropdown
                    menu={{
                        items: [
                            {
                                key: 'start',
                                label: 'Start',
                                icon: <PlayCircleOutlined />,
                                onClick: handleStart,
                                disabled: !(selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'),
                            },
                            {
                                key: 'approve',
                                label: 'Approve & Close',
                                icon: <StopOutlined />,
                                onClick: handleOpenApproval,
                                disabled: !(selectedRowKeys.length === 1 && selectedRecord?.Status === 'IN_PROGRESS' && canApprove),
                            },
                        ],
                    }}
                    trigger={['click', 'hover']}
                    disabled={selectedRowKeys.length !== 1 || (selectedRecord?.Status !== 'DRAFT' && selectedRecord?.Status !== 'IN_PROGRESS')}
                >
                    <span className={\`p-1 text-xs flex flex-row items-center justify-center gap-1 transition-colors \${selectedRowKeys.length !== 1 || (selectedRecord?.Status !== 'DRAFT' && selectedRecord?.Status !== 'IN_PROGRESS') ? "text-[#93A8B8] cursor-not-allowed" : "text-white hover:cursor-pointer hover:bg-[#3A4E61]"}\`}>
                        <PlayCircleOutlined />
                        <span>Update Status <DownOutlined style={{ fontSize: '10px' }}/></span>
                    </span>
                </Dropdown>

                <Dropdown
                    menu={{
                        items: [
                            {
                                key: 'worksheet',
                                label: 'Worksheet',
                                icon: <FileExcelOutlined />,
                                onClick: handleDownloadWorksheet,
                                disabled: selectedRowKeys.length !== 1,
                            },
                            {
                                key: 'snapshot',
                                label: 'Snapshot',
                                icon: <CameraOutlined />,
                                onClick: handleDownloadSnapshot,
                                disabled: selectedRowKeys.length !== 1,
                            },
                        ],
                    }}
                    trigger={['click', 'hover']}
                    disabled={selectedRowKeys.length !== 1 || downloadingWs || downloadingSnapshot}
                >
                    <span className={\`p-1 text-xs flex flex-row items-center justify-center gap-1 transition-colors \${selectedRowKeys.length !== 1 || downloadingWs || downloadingSnapshot ? "text-[#93A8B8] cursor-not-allowed" : "text-white hover:cursor-pointer hover:bg-[#3A4E61]"}\`}>
                        {downloadingWs || downloadingSnapshot ? (
                            <ReloadOutlined spin />
                        ) : (
                            <DownloadOutlined />
                        )}
                        <span>Downloads <DownOutlined style={{ fontSize: '10px' }}/></span>
                    </span>
                </Dropdown>

                <ButtonToolbar
                    title="Delete"
                    icon={<DeleteOutlined />}
                    onClick={handleDelete}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
            </ToolbarWrapper>`;

if (toolbarStart > -1 && toolbarEnd > -1) {
    code = code.substring(0, toolbarStart) + newToolbar + code.substring(toolbarEnd);
}

fs.writeFileSync(path, code);
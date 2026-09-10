/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, App, Transfer } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { assignPermissionToRole, removePermissionFromRole, fetchRoles, RoleData } from '@/store/features/roles/rolesSlice';
import { fetchPermissions } from '@/store/features/permissions/permissionsSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    role: RoleData | null;
}

const AssignPermissionsModal: React.FC<Props> = ({ visible, onClose, role }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();

    const { data: allPermissions} = useSelector((state: RootState) => state.permission);

    const [targetKeys, setTargetKeys] = useState<React.Key[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            dispatch(fetchPermissions());
        }
    }, [visible, dispatch]);

    useEffect(() => {
        if (visible && role) {
            // Get assigned permissions from role join table
            const assignedIds = role.Permission?.map((p) => p.Id.toString()) || [];
            setTargetKeys(assignedIds);
        } else {
            setTargetKeys([]);
        }
    }, [visible, role]);

    const handleChange = (newTargetKeys: React.Key[]) => {
        setTargetKeys(newTargetKeys);
    };

    const handleOk = async () => {
        if (!role) return;
        setLoading(true);
        try {
            const initialIds = role.Permission?.map((p) => p.Id.toString()) || [];

            // Find which permissions were added or removed
            const addedIds = targetKeys.filter((id) => !initialIds.includes(String(id)));
            const removedIds = initialIds.filter((id) => !targetKeys.includes(id) && !targetKeys.includes(Number(id)));

            // Process adding permissions
            for (const pId of addedIds) {
                const result = await dispatch(assignPermissionToRole({ roleId: role.Id, permissionId: Number(pId) }));
                if (assignPermissionToRole.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to assign permission');
                }
            }

            // Process removing permissions
            for (const pId of removedIds) {
                const result = await dispatch(removePermissionFromRole({ roleId: role.Id, permissionId: Number(pId) }));
                if (removePermissionFromRole.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to remove permission');
                }
            }

            message.success('Role permissions updated successfully');
            dispatch(fetchRoles());
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            message.error(err?.message || String(error) || 'Failed to update permissions');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={`Assign Permissions to ${role?.RoleName || ''}`}
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={onClose}
            confirmLoading={loading}
            width={800}
            destroyOnHidden
            zIndex={1050}
        >
            <Transfer
                dataSource={allPermissions.map((p: { Id: { toString: () => any; }; Action: any; Description: any; }) => ({
                    key: p.Id.toString(),
                    title: p.Action,
                    description: p.Description,
                }))}
                showSearch
                styles={{
                    section: {
                        width: 323,
                        height: 400,
                    }
                }}
                titles={['Available Permissions', 'Assigned to Role']}
                targetKeys={targetKeys}
                onChange={handleChange}
                render={(item) => `${item.title} - ${item.description || ''}`}
            />
        </Modal>
    );
};

export default AssignPermissionsModal;

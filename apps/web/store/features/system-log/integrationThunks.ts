/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { createAsyncThunk } from '@reduxjs/toolkit';
import { get, post, getApiErrorMessage, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '@/store/utils/apiService';
import { commandIdentity } from '@/store/utils/commandIdentity';
export interface IntegrationEvent { id: string; type: string; status: string; completionEvidence: 'NOT_COMPLETED' | 'TRANSPORT_ACCEPTED' | 'MANUAL_CONFIRMATION' | 'LEGACY_UNVERIFIED'; attempts: number; maxAttempts: number; nextAttemptAt: string; error: { code: string; message: string } | null; createdAt: string; updatedAt: string; succeededAt: string | null; failedAt: string | null; referenceType: string | null; referenceId: string | null }
export interface IntegrationQuery { page: number; limit: number; status?: string; type?: string; referenceId?: string }
export interface IntegrationSummary { pending: number; queued: number; processing: number; failed: number; uncertain: number; exhausted: number; oldestPendingAt: string | null; queueAvailable: boolean; printerQueueAvailable: boolean; observedAt: string }
export interface RecoveryInput { requestId: string; expectedAttempts: number; action: 'RETRY' | 'CONFIRM_DELIVERED' | 'CLOSE'; reason: string; outcomeReconciled?: boolean }
export const fetchIntegrations = createAsyncThunk<PaginatedApiSuccessEnvelope<IntegrationEvent>, IntegrationQuery, { rejectValue: string }>('integrations/list', async (query, { rejectWithValue }) => {
  try { return await get<PaginatedApiSuccessEnvelope<IntegrationEvent>>('/system-log/integrations', { params: { ...query } }); } catch (error) { return rejectWithValue(getApiErrorMessage(error, 'Unable to load integrations')); }
});
export const fetchIntegrationSummary = createAsyncThunk<IntegrationSummary, void, { rejectValue: string }>('integrations/summary', async (_, { rejectWithValue }) => {
  try { return (await get<ApiSuccessEnvelope<IntegrationSummary>>('/system-log/integrations/summary')).data; } catch (error) { return rejectWithValue(getApiErrorMessage(error, 'Unable to load integration health')); }
});
export const recoverIntegration = createAsyncThunk<IntegrationEvent, Omit<RecoveryInput, 'requestId'> & { id: string }, { rejectValue: string }>('integrations/recover', async ({id, ...body}, { rejectWithValue }) => {
  try {
    const path = `/system-log/integrations/${id}/recover`;
    const identity = await commandIdentity('POST', path, body);
    const result = await post<ApiSuccessEnvelope<IntegrationEvent>>(path, { ...body, requestId: identity.id });
    identity.complete(); return result.data;
  } catch (error) { return rejectWithValue(getApiErrorMessage(error, 'Recovery action failed')); }
});

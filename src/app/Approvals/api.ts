import type { ApiService } from '@app/Shared/Services/Api.service';
import type { ApprovalSummary } from './types';

/**
 * Endpoint bindings for the operations waiting on somebody.
 *
 * <p>REST rather than the second surface. A page showing what is open shows tens of rows and asks
 * once; moving it would be moving something that is not slow.
 */
export const approvalsApi = {
  list: (api: ApiService, all: boolean): Promise<ApprovalSummary[]> =>
    api.doGet<ApprovalSummary[]>(`/approvals${all ? '?all=true' : ''}`),

  approve: (api: ApiService, id: number): Promise<ApprovalSummary> =>
    api.doPost<ApprovalSummary>(`/approvals/${id}/approve`),

  decline: (api: ApiService, id: number, reason: string): Promise<ApprovalSummary> =>
    api.doPost<ApprovalSummary>(`/approvals/${id}/decline`, { reason }),

  withdraw: (api: ApiService, id: number): Promise<ApprovalSummary> =>
    api.doDelete<ApprovalSummary>(`/approvals/${id}`),
};

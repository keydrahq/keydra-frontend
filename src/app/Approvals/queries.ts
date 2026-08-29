import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import { approvalsApi } from './api';
import type { ApprovalSummary } from './types';

export const approvalsQueryKey = ['approvals'] as const;

/**
 * What is waiting, and optionally what has already been answered.
 *
 * <p>Not on a timer. A request appears because somebody else asked for it, which is exactly the
 * kind of change the notification hub exists to carry — so the page is told rather than asking
 * every fifteen seconds and usually being handed back what it already had.
 */
export const useApprovals = (all: boolean): UseQueryResult<ApprovalSummary[], Error> => {
  const { api } = useContext(ServiceContext);
  useHubRefresh(
    [NotificationCategory.ApprovalRequested, NotificationCategory.ApprovalChanged],
    approvalsQueryKey,
  );
  return useQuery({
    queryKey: [...approvalsQueryKey, all ? 'all' : 'open'],
    queryFn: () => approvalsApi.list(api, all),
  });
};

const useInvalidateApprovals = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: approvalsQueryKey });
};

export const useApprove = (): UseMutationResult<ApprovalSummary, Error, number> => {
  const { api } = useContext(ServiceContext);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (id: number) => approvalsApi.approve(api, id),
    onSuccess: invalidate,
  });
};

export const useDecline = (): UseMutationResult<
  ApprovalSummary,
  Error,
  { id: number; reason: string }
> => {
  const { api } = useContext(ServiceContext);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: ({ id, reason }) => approvalsApi.decline(api, id, reason),
    onSuccess: invalidate,
  });
};

export const useWithdraw = (): UseMutationResult<ApprovalSummary, Error, number> => {
  const { api } = useContext(ServiceContext);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (id: number) => approvalsApi.withdraw(api, id),
    onSuccess: invalidate,
  });
};

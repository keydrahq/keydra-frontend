import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';

/** Where somebody stands with a second factor. Mirrors io.keydra.authz.dto.SecondFactorState. */
export interface SecondFactorState {
  enabled: boolean;
  recoveryCodesLeft: number;
}

/** A pairing begun and not yet proved: the secret, and what the QR code encodes. */
export interface SecondFactorSetup {
  secret: string;
  uri: string;
}

export const secondFactorQueryKey = ['second-factor'] as const;

export const useSecondFactor = (): UseQueryResult<SecondFactorState, Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: secondFactorQueryKey,
    queryFn: () => api.doGet<SecondFactorState>('/auth/second-factor'),
  });
};

/**
 * Begins a pairing.
 *
 * <p>The only time the secret leaves the server, which is why nothing caches this: asking twice
 * means two secrets, and the second replaces the first.
 */
export const useBeginSecondFactor = () => {
  const { api } = useContext(ServiceContext);
  return useMutation({
    mutationFn: () => api.doPost<SecondFactorSetup>('/auth/second-factor'),
  });
};

/** Proves the pairing and answers the recovery codes, once. */
export const useConfirmSecondFactor = () => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api.doPost<{ codes: string[] }>('/auth/second-factor/confirm', { code }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: secondFactorQueryKey }),
  });
};

/** A fresh set, which stops every code the old set held. */
export const useRegenerateRecoveryCodes = () => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.doPost<{ codes: string[] }>('/auth/second-factor/recovery-codes'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: secondFactorQueryKey }),
  });
};

export const useDisableSecondFactor = () => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.doDelete<boolean>('/auth/second-factor'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: secondFactorQueryKey }),
  });
};

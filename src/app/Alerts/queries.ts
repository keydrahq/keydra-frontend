import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import type {
  AlertDeliveryCheck,
  AlertDeliveryRequest,
  AlertDeliverySummary,
  AlertEventSummary,
  AlertMetricInfo,
  AlertRuleRequest,
  AlertRuleSummary,
} from './types';

export const alertsQueryKey = ['alerts'] as const;

/**
 * The rules, their history and the deliveries are invalidated together.
 *
 * <p>They are readings of one thing: a rule that fires changes both its own state and the history,
 * and adding a delivery changes what the rule form can offer.
 */
const useInvalidateAlerts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: alertsQueryKey });
};

/** Everything the page draws, which is what it asks for. */
export interface AlertsPage {
  alertRules: AlertRuleSummary[];
  alertMetrics: AlertMetricInfo[];
  alertDeliveries: AlertDeliverySummary[];
  connections: { id: number; name: string }[];
}

const PAGE = `
  query AlertsPage {
    alertRules {
      id
      name
      connectionId
      connectionName
      metric
      unit
      comparison
      basis
      threshold
      baselineWindowSeconds
      baselineOffsetSeconds
      baseline
      forSeconds
      enabled
      deliveryIds
      deliveryNames
      createdBy
      createdAt
      state
      since
      reading
      readAt
      watching
    }
    alertMetrics {
      name
      unit
      condition
    }
    alertDeliveries {
      id
      name
      kind
      enabled
      describedAs
      usedByRules
      hasUrl
      urlHost
      hasSecret
      hasApiToken
      hasPassword
      headerName
      recipient
      senderId
      fromAddress
      toAddresses
      smtpHost
      smtpPort
      smtpTls
      username
    }
    connections {
      id
      name
    }
  }
`;

/**
 * Everything the page needs, asked once.
 *
 * <p>Four requests before: the rules, the metrics a rule may watch, the delivery channels, and
 * the connection catalogue every form needed to offer a target. Managing deliveries is a stricter
 * permission than reading rules, so somebody without it gets the rules and a null in place of the
 * channels — which the page reads as "none to offer" rather than as a failure.
 */
const useAlertsPageSelecting = <T>(select: (page: AlertsPage) => T): UseQueryResult<T, Error> => {
  const { graphql } = useContext(ServiceContext);
  // A rule that starts or stops firing says so. Asking every fifteen seconds instead was a
  // request per tab for a set that changes when something is actually wrong.
  useHubRefresh([NotificationCategory.AlertChanged], alertsQueryKey);
  return useQuery({
    queryKey: [...alertsQueryKey, 'page'],
    queryFn: () => graphql.query<AlertsPage>(PAGE),
    select,
  });
};

export const useAlertsPage = (): UseQueryResult<AlertsPage, Error> =>
  useAlertsPageSelecting((page) => page);

/**
 * The slices of that one answer, each its own hook.
 *
 * <p>The key is the same in all of them, so this is still the one request the comment above
 * describes — TanStack hands every caller the same cache entry and `select` decides what each one
 * sees of it. What used to be here spread the page's result and cast it to the slice's type, which
 * does not typecheck and could not: a spread copies `refetch` along with everything else, and that
 * `refetch` still resolves to the whole page. Saying otherwise was a claim about a function nobody
 * had changed.
 */
export const useAlertRules = (): UseQueryResult<AlertRuleSummary[], Error> =>
  useAlertsPageSelecting((page) => page.alertRules);

/** The metrics a rule can watch, from the same answer. */
export const useAlertMetrics = (): UseQueryResult<AlertMetricInfo[], Error> =>
  useAlertsPageSelecting((page) => page.alertMetrics);

/** The channels a firing rule can use, from the same answer. */
export const useAlertDeliveries = (): UseQueryResult<AlertDeliverySummary[], Error> =>
  useAlertsPageSelecting((page) => page.alertDeliveries ?? []);

/** The targets a rule can be written against, from the same answer. */
export const useAlertTargets = (): UseQueryResult<{ id: number; name: string }[], Error> =>
  useAlertsPageSelecting((page) => page.connections);

const EVENTS = `
  query AlertEvents($ruleId: BigInteger) {
    alertEvents(ruleId: $ruleId) {
      id
      ruleId
      ruleName
      connectionId
      connectionName
      kind
      metric
      reading
      threshold
      at
      deliveryName
      deliveryOutcome
      deliveryDetail
    }
  }
`;

const CREATE_RULE = `
  mutation CreateAlertRule($connectionId: BigInteger, $rule: AlertRuleRequestInput) {
    createAlertRule(connectionId: $connectionId, rule: $rule) {
      id
    }
  }
`;

const UPDATE_RULE = `
  mutation UpdateAlertRule(
    $id: BigInteger
    $connectionId: BigInteger
    $rule: AlertRuleRequestInput
  ) {
    updateAlertRule(id: $id, connectionId: $connectionId, rule: $rule) {
      id
    }
  }
`;

const DELETE_RULE = `
  mutation DeleteAlertRule($id: BigInteger, $connectionId: BigInteger) {
    deleteAlertRule(id: $id, connectionId: $connectionId)
  }
`;

const CREATE_DELIVERY = `
  mutation CreateAlertDelivery($delivery: AlertDeliveryRequestInput) {
    createAlertDelivery(delivery: $delivery) {
      id
    }
  }
`;

const UPDATE_DELIVERY = `
  mutation UpdateAlertDelivery($id: BigInteger, $delivery: AlertDeliveryRequestInput) {
    updateAlertDelivery(id: $id, delivery: $delivery) {
      id
    }
  }
`;

const DELETE_DELIVERY = `
  mutation DeleteAlertDelivery($id: BigInteger) {
    deleteAlertDelivery(id: $id)
  }
`;

const CHECK_DELIVERY = `
  mutation CheckAlertDelivery($id: BigInteger) {
    checkAlertDelivery(id: $id) {
      working
      detail
    }
  }
`;

/** What has fired and what has cleared — for one rule, or all of them. */
export const useAlertEvents = (ruleId?: number): UseQueryResult<AlertEventSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...alertsQueryKey, 'events', ruleId ?? 'all'],
    queryFn: () =>
      graphql
        .query<{ alertEvents: AlertEventSummary[] }>(EVENTS, { ruleId: ruleId ?? null })
        .then((answer) => answer.alertEvents),
  });
};

export const useSaveAlertRule = (): UseMutationResult<
  { id: number },
  Error,
  { id?: number; request: AlertRuleRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAlerts();
  return useMutation({
    // The target rides along as its own argument as well as inside the request: the permission
    // check happens before the body is read, and it is a permission about that target.
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createAlertRule: { id: number } }>(CREATE_RULE, {
              connectionId: request.connectionId,
              rule: request,
            })
            .then((answer) => answer.createAlertRule)
        : graphql
            .query<{ updateAlertRule: { id: number } }>(UPDATE_RULE, {
              id,
              connectionId: request.connectionId,
              rule: request,
            })
            .then((answer) => answer.updateAlertRule),
    onSuccess: invalidate,
  });
};

export const useDeleteAlertRule = (): UseMutationResult<
  boolean,
  Error,
  { id: number; connectionId: number }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: ({ id, connectionId }) =>
      graphql
        .query<{ deleteAlertRule: boolean }>(DELETE_RULE, { id, connectionId })
        .then((answer) => answer.deleteAlertRule),
    onSuccess: invalidate,
  });
};

export const useSaveAlertDelivery = (): UseMutationResult<
  { id: number },
  Error,
  { id?: number; request: AlertDeliveryRequest }
> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: ({ id, request }) =>
      id === undefined
        ? graphql
            .query<{ createAlertDelivery: { id: number } }>(CREATE_DELIVERY, { delivery: request })
            .then((answer) => answer.createAlertDelivery)
        : graphql
            .query<{ updateAlertDelivery: { id: number } }>(UPDATE_DELIVERY, {
              id,
              delivery: request,
            })
            .then((answer) => answer.updateAlertDelivery),
    onSuccess: invalidate,
  });
};

export const useDeleteAlertDelivery = (): UseMutationResult<boolean, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  const invalidate = useInvalidateAlerts();
  return useMutation({
    mutationFn: (id) =>
      graphql
        .query<{ deleteAlertDelivery: boolean }>(DELETE_DELIVERY, { id })
        .then((answer) => answer.deleteAlertDelivery),
    onSuccess: invalidate,
  });
};

/** Sends a test message and reports what happened. A mutation: it leaves the building. */
export const useCheckAlertDelivery = (): UseMutationResult<AlertDeliveryCheck, Error, number> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: (id) =>
      graphql
        .query<{ checkAlertDelivery: AlertDeliveryCheck }>(CHECK_DELIVERY, { id })
        .then((answer) => answer.checkAlertDelivery),
  });
};

/**
 * Which destinations hear about Keydra itself.
 *
 * <p>Its own request rather than a field on the deliveries list: it is one instance-wide answer
 * rather than a property of each destination, and folding it into the list would make every row
 * carry a fact about the installation.
 */
export const instanceNoticesQueryKey = [...alertsQueryKey, 'instance-notices'] as const;

export const useInstanceNotices = (): UseQueryResult<number[], Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: instanceNoticesQueryKey,
    queryFn: () => api.doGet<number[]>('/alert-deliveries/instance-notices'),
  });
};

export const useSaveInstanceNotices = (): UseMutationResult<number[], Error, number[]> => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deliveryIds: number[]) =>
      api.doPut<number[]>('/alert-deliveries/instance-notices', deliveryIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: instanceNoticesQueryKey }),
  });
};

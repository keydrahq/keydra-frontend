import { createContext } from 'react';
import { ApiService } from './Api.service';
import { GraphQLService } from './GraphQL.service';
import { NotificationService } from './Notification.service';
import { SettingsService } from './Settings.service';

/**
 * Composition root for the service layer (cryostat-web's `Services.tsx`).
 * Services are constructed once and reached through a single React context.
 */
export interface Services {
  api: ApiService;
  /**
   * The second way to ask, for the pages whose question REST answers badly.
   *
   * <p>Beside `api` rather than replacing it: a page moves when its requests are the reason it is
   * slow, and it moves whole. Half a page on each surface would be two caches to reason about.
   */
  graphql: GraphQLService;
  notifications: NotificationService;
  settings: SettingsService;
}

const api = new ApiService();
const graphql = new GraphQLService();
const notifications = new NotificationService();
const settings = new SettingsService();

export const defaultServices: Services = { api, graphql, notifications, settings };

export const ServiceContext = createContext<Services>(defaultServices);

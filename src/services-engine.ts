import type { Action, Service, SubService } from './types/actions';

type SharedServiceConfig = {
  defaultMeta?: Record<string, any>;
};

type PureService = Omit<Service, 'subs' | 'autoService'>;
type ServiceMap = Record<string, Service>;

type ServiceEngineConfig = {
  services: PureService[];
  subServices?: SubService[];
  sharedServiceConfig?: SharedServiceConfig;
};

const servicesMap: ServiceMap = {};

/**
 * Creates a services engine that manages service registration and configuration.
 *
 * @param config - Configuration object containing services, sub-services, and shared settings
 * @returns An engine instance with methods to retrieve registered services
 *
 * @example
 * ```ts
 * const engine = createServicesEngine({
 *   services: [
 *     { name: 'auth', description: 'Authentication service', actions: authActions }
 *   ],
 *   subServices: [{ name: 'users', table: usersTable }],
 * });
 *
 * const services = engine.getServices();
 * ```
 */
export function createServicesEngine(config: ServiceEngineConfig) {
  const sharedServiceConfig = config.sharedServiceConfig || {
    defaultMeta: {},
  };

  const defaultSubsService: Service = {
    name: 'data-service',
    description: 'Main data service',
    actions: [],
    autoService: true,
    subs: config.subServices || [],
  };

  servicesMap[defaultSubsService.name] = defaultSubsService;

  // add services to the map
  config.services.forEach((service) => {
    servicesMap[service.name] = {
      name: service.name,
      description: service.description,
      actions: service.actions || [],
      subs: [],
      autoService: false,
      meta: service.meta || sharedServiceConfig.defaultMeta,
    };
  });

  function getServices(): Service[] {
    return Object.values(servicesMap);
  }

  return {
    getServices,
  };
}

/**
 * Helper function to create type-safe action definitions without importing the Action type.
 *
 * @param action - The action definition object
 * @returns The same action object with proper typing
 *
 * @example
 * ```ts
 * export const loginAction = createAction({
 *   name: 'login',
 *   handler: loginHandler,
 * ...other_action_properties
 * });
 * ```
 */
export function createAction(action: Action) {
  return action;
}

export type ServicesEngine = ReturnType<typeof createServicesEngine>;

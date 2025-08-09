import type { Context } from 'hono';
import type { SafeResult } from '../utils/safe-try';
import type { Validation } from '../utils/validation-utils';

export type HookDefinition = {
  canFail: boolean;
  name: string;
};

export type ActionResultConfig = {
  pipeline: boolean;
};

export type HookLogEntry = {
  name: string;
  input: any;
  output: any;
  passed: boolean;
};

export type HookContext = {
  actionName: string;
  input: any;
  output?: any;
  error?: Error;
  state: Record<string, any>;
  log: {
    before: HookLogEntry[];
    after: HookLogEntry[];
  };
};

export type Action = {
  name: string;
  description: string;
  isProtected?: boolean;
  isSpecial?: {
    contentType: 'multipart/form-data' | 'application/json' | 'other';
  };
  handler: ActionHandler;
  validation: Validation;
  hooks?: {
    before?: HookDefinition[];
    after?: HookDefinition[];
  };
  result?: ActionResultConfig;
};

export type Actions = Action[];

export type Service = {
  name: string;
  description: string;
  actions: Action[];
  subs?: SubService[];
  autoService?: boolean;
};

type ProtectedAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'deleteAll'
  | 'getOne'
  | 'getAll'
  | 'getEvery'
  | 'getMany'
  | 'getOneWithStrictly'
  | 'getOneWith'
  | 'getOneWithRelations'
  | 'getManyWith';

export type SubService = {
  name: string;
  description: string;
  actions: Action[];
  protectedActions?: ProtectedAction[];
  validation?: Validation;
  tableName: string;
  idName: string;
};

export type Services = Service[];
export type SubServices = SubService[];

export type ActionHandler = (
  data: Record<string, any> | any,
  context?: Context
) => Promise<SafeResult<any>>;

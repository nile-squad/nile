import { z } from 'zod';
import { createLog } from '../logging';
import type { Action, ActionHandler, SubService } from '../types/actions';
import { Ok, safeError } from '../utils';
import { getValidationSchema } from '../utils/validation-utils';
import { createModel, type Model, type ModelOptions } from './create-models';

export const newServiceActionsFactory = (
  sub: SubService,
  db: any,
  tables: any
) => {
  const actions: Action[] = [];
  const _errors: string[] = [];
  const tableName = sub.tableName;
  const table = tables[tableName as keyof typeof tables];
  const returnValue = { actions, errors: _errors };

  if (!(tableName && table)) {
    _errors.push(
      `Table ${tableName} does not exist in the database or tableName is not set on sub service ${sub.name}`
    );
    return returnValue;
  }
  const model = createModel({
    table,
    dbInstance: db,
  });

  const newCreateAction = generateCreateAction(sub, tableName, table, model);
  const newGetAllAction = generateGetAllAction(sub, tableName, table, model);
  const newGetOneAction = generateGetOneAction(sub, tableName, table, model);
  const newUpdateAction = generateUpdateAction(sub, tableName, table, model);
  const newDeleteAction = generateDeleteAction({
    sub,
    tableName,
    table,
    model,
  });
  const newEveryAction = generateGetEveryAction(sub, tableName, table, model);
  const newGetManyWithAction = generateGetManyWithAction(
    sub,
    tableName,
    table,
    model
  );
  const newGetOneWithAction = generateGetOneWithAction(
    sub,
    tableName,
    table,
    model
  );
  const newGetOneWithRelationsAction = generateGetOneWithRelationsAction(
    sub,
    tableName,
    table,
    model
  );
  const newDeleteAllAction = generateDeleteAllAction({
    sub,
    tableName,
    table,
    model,
  });
  console.log(
    '[FACTORY DEBUG] Generated deleteAll action:',
    newDeleteAllAction.name
  );

  actions.push(newCreateAction);
  actions.push(newGetAllAction);
  actions.push(newGetOneAction);
  actions.push(newUpdateAction);
  actions.push(newDeleteAction);
  actions.push(newEveryAction);
  actions.push(newGetManyWithAction);
  actions.push(newGetOneWithAction);
  actions.push(newGetOneWithRelationsAction);
  actions.push(newDeleteAllAction);

  return returnValue;
};

const itemsKeysToPatchOut = [
  'user_id',
  'organization_id',
  'userId',
  'organizationId',
];

const generateCreateAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const createActionHandler: ActionHandler = async (data) => {
    // Pass operation context to model
    const _options = sub.validation
      ? {
          validation: {
            ...sub.validation,
          } as ModelOptions['validation'],
        }
      : {
          validation: {
            context: {
              operation: 'create',
            },
          } as ModelOptions['validation'],
        };

    // patch out auto injected data items
    for (const item of itemsKeysToPatchOut) {
      delete data[item];
    }

    const { data: result, errors } = await model.createItem(data, _options);
    if (errors.length) {
      const error_id = createLog({
        message: `safeError creating new record in ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'createActionHandler',
        appName: 'main',
      });
      return safeError(`Error creating new record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };
  // Create action - generate validation schema from table
  const newAction: Action = {
    name: 'create',
    type: 'auto',
    description: `Create a new record in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('create'), // Protected by default, only public if explicitly listed
    handler: createActionHandler,
    validation: {
      zodSchema: getValidationSchema({
        inferTable: table,
        context: { operation: 'create' },
        ...sub.validation,
      }),
    },
  };

  return newAction;
};

const generateGetAllAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const getAllActionHandler: ActionHandler = async (data) => {
    if (!data.property || data.value === undefined) {
      const error_id = createLog({
        message: 'Missing property and value in payload',
        data,
        type: 'error',
        atFunction: 'getAllActionHandler',
        appName: 'main',
      });
      return safeError('Missing property and value in payload', error_id);
    }

    const { data: result, errors } = await model.getMany({
      basedOnProperty: data.property,
      withValue: data.value,
    });
    if (errors.length) {
      const error_id = createLog({
        message: `safeError getting all records from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getAllActionHandler',
        appName: 'main',
      });
      return safeError(
        `safeError getting all records from ${tableName}`,
        error_id
      );
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getAll',
    type: 'auto',
    description: `Get all records from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('getAll'), // Protected by default, only public if explicitly listed
    handler: getAllActionHandler,
    validation: {
      zodSchema: z.object({
        property: z.string().min(1, 'Property name is required'),
        value: z.any(),
      }),
    },
  };

  return newAction;
};

const generateGetEveryAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const getEveryActionHandler: ActionHandler = async (data) => {
    const { data: result, errors } = await model.getAll();
    if (errors.length) {
      const error_id = createLog({
        message: `safeError getting every record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getEveryActionHandler',
        appName: 'main',
      });
      return safeError(
        `safeError getting every record from ${tableName}`,
        error_id
      );
    }
    return Ok(result as any);
  };

  // GetEvery action - no validation needed
  const newAction: Action = {
    name: 'getEvery',
    type: 'auto',
    description: `Get every record from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('getEvery'), // Protected by default, only public if explicitly listed
    handler: getEveryActionHandler,
    validation: {},
  };

  return newAction;
};

const generateGetOneAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const getOneActionHandler: ActionHandler = async (data) => {
    if (!data[sub.idName]) {
      const error_id = createLog({
        message: `Missing ${sub.idName} in payload`,
        data,
        type: 'error',
        atFunction: 'getOneActionHandler',
        appName: 'main',
      });
      return safeError(`Missing ${sub.idName} in payload`, error_id);
    }
    const { data: result, errors } = await model.getOne({
      basedOnProperty: sub.idName,
      withValue: data[sub.idName],
    });
    if (errors.length) {
      const error_id = createLog({
        message: `safeError getting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getOneActionHandler',
        appName: 'main',
      });
      return safeError(`safeError getting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getOne',
    type: 'auto',
    description: `Get one record from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('getOne'), // Protected by default, only public if explicitly listed
    handler: getOneActionHandler,
    validation: {
      zodSchema: z.object({
        [sub.idName]: z.string().min(1, `${sub.idName} is required`),
      }),
    },
  };

  return newAction;
};

const generateUpdateAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const updateActionHandler: ActionHandler = async (data) => {
    if (!data[sub.idName]) {
      const error_id = createLog({
        message: `Missing ${sub.idName} in payload!`,
        data,
        type: 'error',
        atFunction: 'updateActionHandler',
        appName: 'main',
      });
      return safeError(`Missing ${sub.idName} in payload!`, error_id);
    }

    // patch out auto injected data items
    for (const item of itemsKeysToPatchOut) {
      delete data[item];
    }

    const { data: result, errors } = await model.updateItem({
      basedOnProperty: sub.idName,
      withValue: data[sub.idName],
      dataInput: data,
      options: {
        validation: {
          ...sub.validation,
          context: {
            operation: 'update',
          },
        },
      },
    });

    if (errors.length) {
      const error_id = createLog({
        message: `safeError updating record in ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'updateActionHandler',
        appName: 'main',
      });
      return safeError(`safeError updating record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };
  // Update action - generate validation schema with id field + partial table fields
  const newAction: Action = {
    name: 'update',
    type: 'auto',
    description: `Update a record in ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('update'), // Protected by default, only public if explicitly listed
    handler: updateActionHandler,
    validation: {
      zodSchema: getValidationSchema({
        inferTable: table,
        context: { operation: 'update' },
        customValidations: {
          [sub.idName]: z
            .string()
            .min(1, `${sub.idName} is required for update`),
        },
        ...sub.validation,
      }),
    },
  };

  return newAction;
};

export const generateDeleteAction = ({
  sub,
  tableName,
  table,
  model,
}: {
  sub: SubService;
  tableName: string;
  table: any;
  model: Model;
}) => {
  const deleteActionHandler: ActionHandler = async (data) => {
    if (!data[sub.idName]) {
      const error_id = createLog({
        message: `Missing ${sub.idName} in payload!`,
        data,
        type: 'error',
        atFunction: 'deleteActionHandler',
        appName: 'main',
      });
      return safeError(`Missing ${sub.idName} in payload!`, error_id);
    }
    const { data: result, errors } = await model.deleteOne({
      basedOnProperty: sub.idName,
      withValue: data[sub.idName],
    });
    if (errors.length) {
      const error_id = createLog({
        message: `safeError deleting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'deleteActionHandler',
        appName: 'main',
      });
      return safeError(`safeError deleting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'delete',
    type: 'auto',
    description: `Delete a record from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('delete'), // Protected by default, only public if explicitly listed
    handler: deleteActionHandler,
    validation: {
      zodSchema: z.object({
        [sub.idName]: z.string().min(1, `${sub.idName} is required`),
      }),
    },
  };

  return newAction;
};

export const generateDeleteAllAction = ({
  sub,
  tableName,
  table,
  model,
}: {
  sub: SubService;
  tableName: string;
  table: any;
  model: Model;
}) => {
  const deleteAllActionHandler: ActionHandler = async (data) => {
    const { data: result, errors } = await model.deleteAll();
    if (errors.length) {
      const error_id = createLog({
        message: `safeError deleting all records from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'deleteAllActionHandler',
        appName: 'main',
      });
      return safeError(
        `safeError deleting all records from ${tableName}`,
        error_id
      );
    }
    return Ok(result as any);
  };

  // DeleteAll action - no validation needed
  const newAction: Action = {
    name: 'deleteAll',
    type: 'auto',
    description: `Delete all records from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('deleteAll'), // Protected by default, only public if explicitly listed
    handler: deleteAllActionHandler,
    validation: {},
  };

  return newAction;
};

const generateGetManyWithAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const getManyWithActionHandler: ActionHandler = async (data) => {
    const { page, perPage, sort, filters } = data;

    const { data: result, errors } = await model.getManyWith({
      page,
      perPage,
      sort,
      filters,
    });
    if (errors.length) {
      const error_id = createLog({
        message: `safeError getting all records from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getManyWithActionHandler',
        appName: 'main',
      });
      return safeError(
        `safeError getting all records from ${tableName}`,
        error_id
      );
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getManyWith',
    type: 'auto',
    description: `Get all records from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('getManyWith'), // Protected by default, only public if explicitly listed
    handler: getManyWithActionHandler,
    validation: {
      zodSchema: z.object({
        page: z.number().int().positive().optional(),
        perPage: z.number().int().positive().optional(),
        sort: z
          .array(
            z.object({
              field: z.string(),
              direction: z.enum(['asc', 'desc']),
            })
          )
          .optional(),
        filters: z.record(z.string(), z.any()).optional(),
      }),
    },
  };

  return newAction;
};

const generateGetOneWithAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const getOneWithActionHandler: ActionHandler = async (data) => {
    const { filters } = data;

    const { data: result, errors } = await model.getOneWith({
      filters,
    });
    if (errors.length) {
      const error_id = createLog({
        message: `safeError getting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getOneWithActionHandler',
        appName: 'main',
      });
      return safeError(`safeError getting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getOneWith',
    type: 'auto',
    description: `Get one record from ${sub.tableName}`,
    isProtected: !sub.publicActions?.includes('getOneWith'), // Protected by default, only public if explicitly listed
    handler: getOneWithActionHandler,
    validation: {
      zodSchema: z.object({
        filters: z.record(z.string(), z.any()).optional(),
      }),
    },
  };

  return newAction;
};

const generateGetOneWithRelationsAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const getOneWithRelationsActionHandler: ActionHandler = async (data) => {
    const { id, with: withRelations } = data;

    const { data: result, errors } = await model.getOneWithRelations({
      id,
      tableName,
      with: withRelations,
    });
    if (errors.length) {
      const error_id = createLog({
        message: `safeError getting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getOneWithRelationsActionHandler',
        appName: 'main',
      });
      return safeError(`safeError getting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getOneWithRelations',
    type: 'auto',
    description: `Get one record from ${sub.tableName} with relations`,
    isProtected: !sub.publicActions?.includes('getOneWithRelations'), // Protected by default, only public if explicitly listed
    handler: getOneWithRelationsActionHandler,
    validation: {
      zodSchema: z.object({
        id: z.string().min(1, 'ID is required'),
        with: z.record(z.string(), z.any()).optional(),
      }),
    },
  };

  return newAction;
};

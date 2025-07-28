import { createLog } from '@nile/src/logging';
import type {
  Action,
  ActionHandler,
  SubService,
} from '@nile/src/types/actions';
// biome-ignore lint/suspicious/noShadowRestrictedNames: <shall fix later>
import { Error, Ok } from '@nile/src/utils/safe-try';
import { getValidationSchema } from '@nile/src/utils/validation-utils';
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
  const newDeleteAction = generateDeleteAction(sub, tableName, table, model);
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

  actions.push(newCreateAction);
  actions.push(newGetAllAction);
  actions.push(newGetOneAction);
  actions.push(newUpdateAction);
  actions.push(newDeleteAction);
  actions.push(newEveryAction);
  actions.push(newGetManyWithAction);
  actions.push(newGetOneWithAction);
  const newGetOneWithRelationsAction = generateGetOneWithRelationsAction(
    sub,
    tableName,
    table,
    model
  );

  actions.push(newGetOneWithRelationsAction);

  return returnValue;
};

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

    const { data: result, errors } = await model.createItem(data, _options);
    if (errors.length) {
      const error_id = createLog({
        message: `Error creating new record in ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'createActionHandler',
        appName: 'main',
      });
      return Error(`Error creating new record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };
  // Create action validation schema with create context
  const newAction: Action = {
    name: 'create',
    description: `Create a new record in ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('create') ?? false,
    handler: createActionHandler,
    validation: {
      ...sub.validation,
      zodSchema: getValidationSchema({ ...sub.validation, inferTable: table }),
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
    if (!data.company_id) {
      const error_id = createLog({
        message: 'Missing company_id in payload',
        data,
        type: 'error',
        atFunction: 'getAllActionHandler',
        appName: 'main',
      });
      return Error('Missing company_id in payload', error_id);
    }

    const { data: result, errors } = await model.getMany({
      basedOnProperty: 'company_id',
      withValue: data.company_id,
    });
    if (errors.length) {
      const error_id = createLog({
        message: `Error getting all records from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getAllActionHandler',
        appName: 'main',
      });
      return Error(`Error getting all records from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getAll',
    description: `Get all records from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('getAll') ?? false,
    handler: getAllActionHandler,
    validation: {},
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
        message: `Error getting every record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getEveryActionHandler',
        appName: 'main',
      });
      return Error(`Error getting every record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getEvery',
    description: `Get every record from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('getEvery') ?? false,
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
      return Error(`Missing ${sub.idName} in payload`, error_id);
    }
    const { data: result, errors } = await model.getOne({
      basedOnProperty: sub.idName,
      withValue: data[sub.idName],
    });
    if (errors.length) {
      const error_id = createLog({
        message: `Error getting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getOneActionHandler',
        appName: 'main',
      });
      return Error(`Error getting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getOne',
    description: `Get one record from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('getOne') ?? false,
    handler: getOneActionHandler,
    validation: {},
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
      return Error(`Missing ${sub.idName} in payload!`, error_id);
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
        message: `Error updating record in ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'updateActionHandler',
        appName: 'main',
      });
      return Error(`Error updating record in ${tableName}`, error_id);
    }
    return Ok(result as any);
  };
  // Update action validation schema with update context
  const newAction: Action = {
    name: 'update',
    description: `Update a record in ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('update') ?? false,
    handler: updateActionHandler,
    validation: {
      ...sub.validation,
      zodSchema: getValidationSchema({
        ...sub.validation,
        inferTable: table,
        context: { operation: 'update' },
      }),
    },
  };

  return newAction;
};

export const generateDeleteAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const deleteActionHandler: ActionHandler = async (data) => {
    if (!data[sub.idName]) {
      const error_id = createLog({
        message: `Missing ${sub.idName} in payload!`,
        data,
        type: 'error',
        atFunction: 'deleteActionHandler',
        appName: 'main',
      });
      return Error(`Missing ${sub.idName} in payload!`, error_id);
    }
    const { data: result, errors } = await model.deleteOne({
      basedOnProperty: sub.idName,
      withValue: data[sub.idName],
    });
    if (errors.length) {
      const error_id = createLog({
        message: `Error deleting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'deleteActionHandler',
        appName: 'main',
      });
      return Error(`Error deleting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'delete',
    description: `Delete a record from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('delete') ?? false,
    handler: deleteActionHandler,
    validation: {},
  };

  return newAction;
};

export const generateDeleteAllAction = (
  sub: SubService,
  tableName: string,
  table: any,
  model: Model
) => {
  const deleteAllActionHandler: ActionHandler = async (data) => {
    const { data: result, errors } = await model.deleteAll();
    if (errors.length) {
      const error_id = createLog({
        message: `Error deleting all records from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'deleteAllActionHandler',
        appName: 'main',
      });
      return Error(`Error deleting all records from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'deleteAll',
    description: `Delete all records from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('deleteAll') ?? false,
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
        message: `Error getting all records from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getManyWithActionHandler',
        appName: 'main',
      });
      return Error(`Error getting all records from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getManyWith',
    description: `Get all records from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('getManyWith') ?? false,
    handler: getManyWithActionHandler,
    validation: {},
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
        message: `Error getting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getOneWithActionHandler',
        appName: 'main',
      });
      return Error(`Error getting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getOneWith',
    description: `Get one record from ${sub.tableName}`,
    isProtected: sub.protectedActions?.includes('getOneWith') ?? false,
    handler: getOneWithActionHandler,
    validation: {},
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
        message: `Error getting record from ${tableName}`,
        data: errors,
        type: 'error',
        atFunction: 'getOneWithRelationsActionHandler',
        appName: 'main',
      });
      return Error(`Error getting record from ${tableName}`, error_id);
    }
    return Ok(result as any);
  };

  // create action
  const newAction: Action = {
    name: 'getOneWithRelations',
    description: `Get one record from ${sub.tableName} with relations`,
    isProtected: sub.protectedActions?.includes('getOneWithRelations') ?? false,
    handler: getOneWithRelationsActionHandler,
    validation: {},
  };

  return newAction;
};

import { expect, test, describe } from "vitest";
import { executeBeforeActionHook, executeAfterActionHook } from "./action-hooks.js";
import { Ok, safeError } from "../utils/safe-try";
import type {
	OnBeforeActionHandler,
	OnAfterActionHandler,
	ActionHookResult,
} from "../types/action-hook.js";
import type { Action } from "../types/actions.js";
import type { NileContext } from "../core/context.js";

describe("executeBeforeActionHook function tests", () => {
	const mockContext: NileContext = {
		authResult: { userId: "user123", organizationId: "org456" },
		_store: new Map(),
		getAuth: () => ({ userId: "user123", organizationId: "org456" }),
		getUser: () => ({ userId: "user123", organizationId: "org456" }),
		get: () => undefined,
		set: () => {},
	};

	const mockAction: Action = {
		name: "testAction",
		description: "Test action for unit tests",
		type: "custom",
		handler: async () => Ok({}, "Success"),
		validation: {},
		meta: {
			access: ["admin", "user"],
		},
	};

	test("should return Ok(true) when no handler provided", async () => {
		const result = await executeBeforeActionHook(undefined, mockContext, mockAction, {
			data: "test",
		});
		expect(result).toEqual(Ok(true, "No handler provided"));
	});

	test("should return Ok(true) when handler returns Ok(true)", async () => {
		const handler: OnBeforeActionHandler = () => Ok(true, "Handler returned Ok");
		const result = await executeBeforeActionHook(handler, mockContext, mockAction, {
			data: "test",
		});
		expect(result).toEqual(Ok(true, "Handler returned Ok"));
	});

	test("should return error when handler returns error object", async () => {
		const handler: OnBeforeActionHandler = () =>
			safeError("Access denied", "test-error-id");
		const result = await executeBeforeActionHook(handler, mockContext, mockAction, {
			data: "test",
		});

		expect(result).toEqual({
			status: false,
			message: "Access denied",
			data: expect.objectContaining({
				error_id: expect.any(String),
			}),
			isError: true,
			isOk: false,
		});
	});

	test("should handle async handler returning Ok(true)", async () => {
		const handler: OnBeforeActionHandler = async (): Promise<ActionHookResult> =>
			Ok(true, "Async handler returned Ok");
		const result = await executeBeforeActionHook(handler, mockContext, mockAction, {
			data: "test",
		});
		expect(result).toEqual(Ok(true, "Async handler returned Ok"));
	});

	test("should handle async handler returning error", async () => {
		const handler: OnBeforeActionHandler = async (): Promise<ActionHookResult> =>
			safeError("Async access denied", "test-async-error-id");
		const result = await executeBeforeActionHook(handler, mockContext, mockAction, {
			data: "test",
		});

		expect(result).toEqual({
			status: false,
			message: "Async access denied",
			data: expect.objectContaining({
				error_id: expect.any(String),
			}),
			isError: true,
			isOk: false,
		});
	});

	test("should throw error for invalid return value", async () => {
		const handler: OnBeforeActionHandler = () => "invalid" as any;

		await expect(
			executeBeforeActionHook(handler, mockContext, mockAction, { data: "test" }),
		).rejects.toEqual(
			expect.objectContaining({
				status: false,
				message: expect.stringContaining("Invalid action hook result"),
				data: expect.objectContaining({
					error_id: expect.any(String),
				}),
			}),
		);
	});

	test("should throw error for invalid object return value", async () => {
		const handler: OnBeforeActionHandler = () =>
			({ invalidProperty: "test" }) as any;

		await expect(
			executeBeforeActionHook(handler, mockContext, mockAction, { data: "test" }),
		).rejects.toEqual(
			expect.objectContaining({
				status: false,
				message: expect.stringContaining("Invalid action hook result"),
				data: expect.objectContaining({
					error_id: expect.any(String),
				}),
			}),
		);
	});

	test("should handle handler throwing regular error", async () => {
		const handler: OnBeforeActionHandler = () => {
			throw new Error("Handler error");
		};

		await expect(
			executeBeforeActionHook(handler, mockContext, mockAction, { data: "test" }),
		).rejects.toEqual(
			expect.objectContaining({
				status: false,
				message: "Before action hook execution failed",
				data: expect.objectContaining({
					error_id: expect.any(String),
				}),
			}),
		);
	});

	test("should re-throw safeError from handler", async () => {
		const safeErrorResult = {
			status: false,
			message: "Custom safe error",
			data: { error_id: "custom123" },
			isError: true,
			isOk: false,
		};

		const handler: OnBeforeActionHandler = () => {
			throw safeErrorResult;
		};

		await expect(
			executeBeforeActionHook(handler, mockContext, mockAction, { data: "test" }),
		).rejects.toEqual(safeErrorResult);
	});
});

describe("executeAfterActionHook function tests", () => {
	const mockContext: NileContext = {
		authResult: { userId: "user123", organizationId: "org456" },
		_store: new Map(),
		getAuth: () => ({ userId: "user123", organizationId: "org456" }),
		getUser: () => ({ userId: "user123", organizationId: "org456" }),
		get: () => undefined,
		set: () => {},
	};

	const mockAction: Action = {
		name: "testAction",
		description: "Test action for unit tests",
		type: "custom",
		handler: async () => Ok({}, "Success"),
		validation: {},
		meta: {
			access: ["admin", "user"],
		},
	};

	const mockResult = Ok({ data: "test result" }, "Action executed successfully");

	test("should return Ok(true) when no handler provided", async () => {
		const result = await executeAfterActionHook(
			undefined,
			mockContext,
			mockAction,
			{ data: "test" },
			mockResult,
		);
		expect(result).toEqual(Ok(true, "No handler provided"));
	});

	test("should return Ok(true) when handler returns Ok(true)", async () => {
		const handler: OnAfterActionHandler = () => Ok(true, "After hook passed");
		const result = await executeAfterActionHook(
			handler,
			mockContext,
			mockAction,
			{ data: "test" },
			mockResult,
		);
		expect(result).toEqual(Ok(true, "After hook passed"));
	});

	test("should return error when handler returns error object", async () => {
		const handler: OnAfterActionHandler = () =>
			safeError("After hook failed", "test-error-id");
		const result = await executeAfterActionHook(
			handler,
			mockContext,
			mockAction,
			{ data: "test" },
			mockResult,
		);

		expect(result).toEqual({
			status: false,
			message: "After hook failed",
			data: expect.objectContaining({
				error_id: expect.any(String),
			}),
			isError: true,
			isOk: false,
		});
	});

	test("should handle async handler returning Ok(true)", async () => {
		const handler: OnAfterActionHandler = async (): Promise<ActionHookResult> =>
			Ok(true, "Async after hook passed");
		const result = await executeAfterActionHook(
			handler,
			mockContext,
			mockAction,
			{ data: "test" },
			mockResult,
		);
		expect(result).toEqual(Ok(true, "Async after hook passed"));
	});

	test("should receive result parameter", async () => {
		let receivedResult: any;
		const handler: OnAfterActionHandler = async ({ result }) => {
			receivedResult = result;
			return Ok(true, "After hook received result");
		};

		await executeAfterActionHook(
			handler,
			mockContext,
			mockAction,
			{ data: "test" },
			mockResult,
		);

		expect(receivedResult).toEqual(mockResult);
	});

	test("should throw error for invalid return value", async () => {
		const handler: OnAfterActionHandler = () => "invalid" as any;

		await expect(
			executeAfterActionHook(
				handler,
				mockContext,
				mockAction,
				{ data: "test" },
				mockResult,
			),
		).rejects.toEqual(
			expect.objectContaining({
				status: false,
				message: expect.stringContaining("Invalid action hook result"),
				data: expect.objectContaining({
					error_id: expect.any(String),
				}),
			}),
		);
	});

	test("should handle handler throwing regular error", async () => {
		const handler: OnAfterActionHandler = () => {
			throw new Error("After hook error");
		};

		await expect(
			executeAfterActionHook(
				handler,
				mockContext,
				mockAction,
				{ data: "test" },
				mockResult,
			),
		).rejects.toEqual(
			expect.objectContaining({
				status: false,
				message: "After action hook execution failed",
				data: expect.objectContaining({
					error_id: expect.any(String),
				}),
			}),
		);
	});

	test("should re-throw safeError from handler", async () => {
		const safeErrorResult = {
			status: false,
			message: "Custom safe error in after hook",
			data: { error_id: "custom123" },
			isError: true,
			isOk: false,
		};

		const handler: OnAfterActionHandler = () => {
			throw safeErrorResult;
		};

		await expect(
			executeAfterActionHook(
				handler,
				mockContext,
				mockAction,
				{ data: "test" },
				mockResult,
			),
		).rejects.toEqual(safeErrorResult);
	});
});

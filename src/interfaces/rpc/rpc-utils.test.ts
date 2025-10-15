import { describe, expect, it } from "vitest";
import { createRPC } from "./index";

describe("RPC Utils Core Functionality", () => {
	describe("createRPC function creation", () => {
		it("should create RPC utils with default config", () => {
			const rpc = createRPC();

			expect(rpc).toBeDefined();
			expect(typeof rpc.getServices).toBe("function");
			expect(typeof rpc.getServiceDetails).toBe("function");
			expect(typeof rpc.getActionDetails).toBe("function");
			expect(typeof rpc.getSchemas).toBe("function");
			expect(typeof rpc.executeServiceAction).toBe("function");
		});

		it("should create RPC utils with custom config", () => {
			const rpc = createRPC({
				resultsMode: "json",
				agentMode: true,
			});

			expect(rpc).toBeDefined();
			expect(typeof rpc.getServices).toBe("function");
		});
	});

	describe("Configuration handling", () => {
		it("should accept different result modes", () => {
			const dataRpc = createRPC({ resultsMode: "data" });
			const jsonRpc = createRPC({ resultsMode: "json" });

			expect(dataRpc).toBeDefined();
			expect(jsonRpc).toBeDefined();
		});

		it("should accept agent mode configuration", () => {
			const userRpc = createRPC({ agentMode: false });
			const agentRpc = createRPC({ agentMode: true });

			expect(userRpc).toBeDefined();
			expect(agentRpc).toBeDefined();
		});
	});
});

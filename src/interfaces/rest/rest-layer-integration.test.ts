import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { serve } from "@hono/node-server";
import { createRestRPC } from "./rest-server";
import type { SubService } from "../../types/actions";
import type { ServerConfig } from "./rest-server";

const testUsersTable = sqliteTable("test_users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	age: integer("age"),
	balance: real("balance").default(0),
	organization_id: text("organization_id"),
	user_id: text("user_id"),
});

describe("REST Layer Integration Tests - Unified Execution", () => {
	let db: Database.Database;
	let drizzleDb: any;
	let serverInstance: any;
	let baseUrl: string;
	const testPort = 9876;

	beforeAll(async () => {
		db = new Database(":memory:");
		drizzleDb = drizzle(db);

		db.exec(`
      CREATE TABLE test_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        age INTEGER,
        balance REAL DEFAULT 0,
        organization_id TEXT,
        user_id TEXT
      )
    `);

		db.exec(`
      INSERT INTO test_users (id, name, email, age, balance, organization_id, user_id) VALUES
      ('user-1', 'John Doe', 'john@example.com', 30, 100.50, 'org-1', 'auth-user-1'),
      ('user-2', 'Jane Smith', 'jane@example.com', 25, 200.75, 'org-1', 'auth-user-2'),
      ('user-3', 'Bob Johnson', 'bob@example.com', 35, 150.25, 'org-2', 'auth-user-3')
    `);

		const testSubService: SubService = {
			name: "testUsers",
			description: "Test users service",
			tableName: "test_users",
			idName: "id",
			publicActions: [
				"create",
				"getAll",
				"getOne",
				"update",
				"delete",
				"getEvery",
				"getManyWith",
				"getOneWith",
			],
			actions: [],
			validation: {
				customValidations: {
					name: z.string().min(1, "Name is required"),
					email: z.string().email({ message: "Invalid email format" }),
					balance: z.number().optional(),
				},
			},
		};

		const serverConfig: ServerConfig = {
			serverName: "Test REST Server",
			baseUrl: "/test",
			apiVersion: "v1",
			services: [
				{
					name: "testUsers",
					description: "Test users service",
					actions: [],
					autoService: true,
					subs: [testSubService],
				},
			],
			host: "localhost",
			port: testPort.toString(),
			db: {
				instance: drizzleDb,
				tables: { test_users: testUsersTable },
			},
			allowedOrigins: ["*"],
		};

		const app = createRestRPC(serverConfig);

		console.log(
			"FINAL SERVICES:",
			serverConfig.services.map((s) => ({
				name: s.name,
				actionCount: s.actions.length,
			})),
		);

		serverInstance = serve(
			{
				fetch: app.fetch,
				port: testPort,
			},
			() => {
				console.log(`Test REST server running on http://localhost:${testPort}`);
			},
		);

		baseUrl = `http://localhost:${testPort}/test/v1/services`;

		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	afterAll(async () => {
		if (serverInstance) {
			serverInstance.close();
		}
		if (db) {
			db.close();
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	describe("Service Discovery via REST", () => {
		it("should list available services via GET", async () => {
			const response = await fetch(baseUrl);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data).toContain("testUsers");
		});

		it("should get service details via GET", async () => {
			const response = await fetch(`${baseUrl}/testUsers`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.name).toBe("testUsers");
			expect(Array.isArray(data.data.availableActions)).toBe(true);
		});

		it("should get action details via GET", async () => {
			const response = await fetch(`${baseUrl}/testUsers/create`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.name).toBe("create");
		});

		it("should get schemas via GET", async () => {
			const response = await fetch(`${baseUrl}/schema`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data.length).toBeGreaterThan(0);
		});
	});

	describe("CRUD Operations via REST POST", () => {
		it("should create a new user via POST", async () => {
			const newUser = {
				id: "user-4",
				name: "Alice Brown",
				email: "alice@example.com",
				age: 28,
				balance: 75.0,
				organization_id: "org-1",
				user_id: "auth-user-4",
			};

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "create",
					payload: newUser,
				}),
			});

			const data = await response.json();

			if (response.status !== 200) {
				console.log("CREATE ERROR:", JSON.stringify(data, null, 2));
			}

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data.id).toBe("user-4");
			expect(data.data.name).toBe("Alice Brown");
			expect(data.data.email).toBe("alice@example.com");
		});

		it("should get all users by organization via POST", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getAll",
					payload: {
						property: "organization_id",
						value: "org-1",
					},
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data).toHaveLength(3);
			expect(data.data[0].organization_id).toBe("org-1");
		});

		it("should get one user by ID via POST", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getOne",
					payload: { id: "user-1" },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.id).toBe("user-1");
			expect(data.data.name).toBe("John Doe");
			expect(data.data.email).toBe("john@example.com");
		});

		it("should update a user via POST", async () => {
			const updateData = {
				id: "user-1",
				name: "John Updated",
				age: 31,
			};

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "update",
					payload: updateData,
				}),
			});

			const data = await response.json();

			console.log("UPDATE RESPONSE:", JSON.stringify(data, null, 2));

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data).not.toBeNull();
			if (data.data) {
				expect(data.data.id).toBe("user-1");
				expect(data.data.name).toBe("John Updated");
				expect(data.data.age).toBe(31);
				expect(data.data.email).toBe("john@example.com");
			}
		});

		it("should delete a user via POST", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "delete",
					payload: { id: "user-3" },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);

			const getResponse = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getOne",
					payload: { id: "user-3" },
				}),
			});

			const getData = await getResponse.json();
			expect(getData.status).toBe(true);
			expect(getData.data).toBeNull();
		});

		it("should get every user via POST", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getEvery",
					payload: {},
				}),
			});

			const data = await response.json();

			if (response.status !== 200) {
				console.log("GETEVERY ERROR:", JSON.stringify(data, null, 2));
			}

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("Validation Tests via REST", () => {
		it("should reject invalid email format", async () => {
			const invalidUser = {
				id: "user-invalid",
				name: "Invalid User",
				email: "invalid-email",
				age: 25,
			};

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "create",
					payload: invalidUser,
				}),
			});

			const data = await response.json();

			expect(data.status).toBe(false);
			expect(data.message).toContain("Validation failed");
			expect(data.message).toContain("email");
		});

		it("should reject missing required fields", async () => {
			const incompleteUser = {
				id: "user-incomplete",
				age: 25,
			};

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "create",
					payload: incompleteUser,
				}),
			});

			const data = await response.json();

			expect(data.status).toBe(false);
			expect(data.message).toContain("Validation failed");
		});

		it("should reject update without ID", async () => {
			const updateData = {
				name: "Updated Name",
			};

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "update",
					payload: updateData,
				}),
			});

			const data = await response.json();

			expect(data.status).toBe(false);
			expect(data.message).toContain("Missing id in payload!");
		});

		it("should reject invalid service name", async () => {
			const response = await fetch(`${baseUrl}/invalidservice`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "create",
					payload: {},
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.status).toBe(false);
			expect(data.message).toContain("Route not found");
		});

		it("should reject invalid action name", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "invalidAction",
					payload: {},
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.status).toBe(false);
			expect(data.message).toContain("Action 'invalidAction' not found");
		});
	});

	describe("Request Structure Validation", () => {
		it("should reject request without action field", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					payload: { id: "user-1" },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.status).toBe(false);
		});

		it("should reject request without payload field", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getOne",
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.status).toBe(false);
		});

		it("should reject malformed JSON", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{invalid json}",
			});

			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.status).toBe(false);
		});
	});

	describe("Advanced Operations via REST", () => {
		it("should handle getManyWith pagination", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getManyWith",
					payload: {
						page: 1,
						perPage: 2,
						sort: [{ field: "name", direction: "asc" }],
						filters: { organization_id: "org-1" },
					},
				}),
			});

			const data = await response.json();

			if (response.status !== 200) {
				console.log("GETMANYWITH ERROR:", JSON.stringify(data, null, 2));
			}

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data).toHaveProperty("items");
			expect(data.data).toHaveProperty("meta");
			expect(Array.isArray(data.data.items)).toBe(true);
			expect(data.data.meta).toHaveProperty("totalItems");
			expect(data.data.meta).toHaveProperty("currentPage");
		});

		it("should handle getOneWith filters", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getOneWith",
					payload: {
						filters: { email: "jane@example.com" },
					},
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.email).toBe("jane@example.com");
			expect(data.data.name).toBe("Jane Smith");
		});
	});

	describe("Unified Execution Flow Verification", () => {
		it("should execute actions through unified executor", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getOne",
					payload: { id: "user-1" },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data).toBeDefined();
		});

		it("should handle errors consistently through unified executor", async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "getOne",
					payload: { id: "non-existent-user" },
				}),
			});

			const data = await response.json();

			expect(data.status).toBe(true);
			expect(data.data).toBeNull();
		});
	});
});

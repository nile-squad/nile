import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	setupTestDb,
	cleanupTestDb,
	createTestUser,
	testUsers,
	type TestUser,
} from "./test-setup-sqlite";
import { createModel } from "../orm";
import { sql } from "drizzle-orm";

describe("Enhanced Filter System", () => {
	let userModel: any;
	let testUserData: TestUser[] = [];
	let testStartTime: Date;

	beforeEach(async () => {
		testStartTime = new Date();
		const { db } = await setupTestDb();
		userModel = createModel({
			table: testUsers,
			dbInstance: db,
			config: { dialect: "sqlite", jsonMode: "stringify" },
		});

		// Create test users with different attributes
		const results = await Promise.all([
			userModel.create(
				createTestUser({
					username: "admin1",
					email: "admin1@example.com",
					status: "active",
					role: "admin",
					profile: { firstName: "Admin", lastName: "One" },
				}),
			),
			userModel.create(
				createTestUser({
					username: "admin2",
					email: "admin2@example.com",
					status: "active",
					role: "admin",
					profile: { firstName: "Admin", lastName: "Two" },
				}),
			),
			userModel.create(
				createTestUser({
					username: "moderator1",
					email: "moderator1@example.com",
					status: "active",
					role: "moderator",
					profile: { firstName: "Moderator", lastName: "One" },
				}),
			),
			userModel.create(
				createTestUser({
					username: "user1",
					email: "user1@example.com",
					status: "inactive",
					role: "user",
					profile: { firstName: "User", lastName: "One" },
				}),
			),
			userModel.create(
				createTestUser({
					username: "user2",
					email: "user2@example.com",
					status: "pending",
					role: "user",
					profile: { firstName: "User", lastName: "Two" },
				}),
			),
		]);
		testUserData = results.map((r) => r.data!);
	});

	afterEach(async () => {
		await cleanupTestDb();
	});

	describe("Basic Property Filters", () => {
		it("should filter with equals operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "status", equals: "active" }],
			});

			expect(users).toHaveLength(3);
			expect(users?.every((u: any) => u.status === "active")).toBe(true);
		});

		it("should filter with notEquals operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "status", notEquals: "active" }],
			});

			expect(users).toHaveLength(2);
			expect(users?.every((u: any) => u.status !== "active")).toBe(true);
		});

	it("should filter with greaterThan operator", async () => {
		const { data: users } = await userModel.findMany({
			filters: [
				{ where: "createdAt", greaterThan: new Date(testStartTime.getTime() - 1000) },
			],
		});

		expect(users).toHaveLength(5);
	});

	it("should filter with greaterThanOrEqual operator", async () => {
		const { data: users } = await userModel.findMany({
			filters: [
				{
					where: "createdAt",
					greaterThanOrEqual: new Date(testStartTime.getTime() - 1000),
				},
			],
		});

		expect(users).toHaveLength(5);
	});

	it("should filter with lessThan operator", async () => {
		const { data: users } = await userModel.findMany({
			filters: [
				{ where: "createdAt", lessThan: new Date(testStartTime.getTime() + 10000) },
			],
		});

		expect(users).toHaveLength(5);
	});

	it("should filter with lessThanOrEqual operator", async () => {
		const { data: users } = await userModel.findMany({
			filters: [
				{ where: "createdAt", lessThanOrEqual: new Date(testStartTime.getTime() + 10000) },
			],
		});

		expect(users).toHaveLength(5);
	});

		it("should filter with like operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "username", like: "%admin%" }],
			});

			expect(users).toHaveLength(2);
			expect(users?.every((u: any) => u.username.includes("admin"))).toBe(true);
		});

		it("should filter with ilike operator (case insensitive)", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "username", ilike: "%ADMIN%" }],
			});

			expect(users).toHaveLength(2);
			expect(
				users?.every((u: any) => u.username.toLowerCase().includes("admin")),
			).toBe(true);
		});

		it("should filter with in operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "role", in: ["admin", "moderator"] }],
			});

			expect(users).toHaveLength(3);
			expect(
				users?.every((u: any) => ["admin", "moderator"].includes(u.role)),
			).toBe(true);
		});

		it("should filter with notIn operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "role", notIn: ["admin", "moderator"] }],
			});

			expect(users).toHaveLength(2);
			expect(
				users?.every((u: any) => !["admin", "moderator"].includes(u.role)),
			).toBe(true);
		});

		it("should filter with isNull operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "deletedAt", isNull: true }],
			});

			expect(users).toHaveLength(5);
			expect(users?.every((u: any) => u.deletedAt === null)).toBe(true);
		});

		it("should filter with isNotNull operator", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "deletedAt", isNotNull: true }],
			});

			expect(users).toHaveLength(0);
		});

		it("should filter with between operator", async () => {
			const now = new Date();
			const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
			const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

			const { data: users } = await userModel.findMany({
				filters: [
					{ where: "createdAt", between: [oneHourAgo, oneHourFromNow] },
				],
			});

			expect(users).toHaveLength(5);
		});

		it("should filter with contains operator (case insensitive)", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "username", contains: "admin" }],
			});

			expect(users).toHaveLength(2);
			expect(users?.every((u: any) => u.username.includes("admin"))).toBe(true);
		});

		it("should filter with contains operator for partial email match", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "email", contains: "moderator" }],
			});

			expect(users).toHaveLength(1);
			expect(users![0].email).toBe("moderator1@example.com");
		});

		it("should filter with contains operator - case insensitive", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "username", contains: "ADMIN" }],
			});

			expect(users).toHaveLength(2);
			expect(
				users?.every((u: any) => u.username.toLowerCase().includes("admin")),
			).toBe(true);
		});
	});

	describe("Complex Nested Filters", () => {
		it("should handle OR conditions", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						or: [
							{ where: "role", equals: "admin" },
							{ where: "role", equals: "moderator" },
						],
					},
				],
			});

			expect(users).toHaveLength(3);
			expect(
				users?.every((u: any) => ["admin", "moderator"].includes(u.role)),
			).toBe(true);
		});

		it("should handle AND conditions", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						and: [
							{ where: "status", equals: "active" },
							{ where: "role", equals: "admin" },
						],
					},
				],
			});

			expect(users).toHaveLength(2);
			expect(
				users?.every((u: any) => u.status === "active" && u.role === "admin"),
			).toBe(true);
		});

		it("should handle nested OR and AND conditions", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						and: [
							{ where: "status", equals: "active" },
							{
								or: [
									{ where: "role", equals: "admin" },
									{ where: "role", equals: "moderator" },
								],
							},
						],
					},
				],
			});

			expect(users).toHaveLength(3);
			expect(
				users?.every(
					(u: any) =>
						u.status === "active" && ["admin", "moderator"].includes(u.role),
				),
			).toBe(true);
		});

		it("should handle multiple nested levels", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						and: [
							{ where: "status", equals: "active" },
							{
								or: [
									{
										and: [
											{ where: "role", equals: "admin" },
											{ where: "username", like: "%1" },
										],
									},
									{
										and: [
											{ where: "role", equals: "moderator" },
											{ where: "username", like: "%1" },
										],
									},
								],
							},
						],
					},
				],
			});

			expect(users).toHaveLength(2); // admin1 and moderator1
		});

		it("should handle complex mixed conditions", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						and: [
							{
								or: [
									{ where: "status", equals: "active" },
									{ where: "status", equals: "pending" },
								],
							},
							{
								or: [
									{ where: "role", equals: "admin" },
									{ where: "role", equals: "user" },
								],
							},
						],
					},
				],
			});

			expect(users).toHaveLength(3); // admin1, admin2, user2
		});
	});

	describe("Raw SQL Filters", () => {
		it("should handle raw SQL conditions", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{ sql: sql`role IN ('admin', 'moderator') AND status = 'active'` },
				],
			});

			expect(users).toHaveLength(3);
			expect(
				users?.every(
					(u: any) =>
						["admin", "moderator"].includes(u.role) && u.status === "active",
				),
			).toBe(true);
		});

		it("should handle raw SQL with parameters", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ sql: sql`role = ${"admin"} AND status = ${"active"}` }],
			});

			expect(users).toHaveLength(2);
			expect(
				users?.every((u: any) => u.role === "admin" && u.status === "active"),
			).toBe(true);
		});

		it("should handle complex raw SQL queries", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						sql: sql`
          (role = 'admin' OR role = 'moderator') 
          AND status = 'active' 
          AND username LIKE '%1'
        `,
					},
				],
			});

			expect(users).toHaveLength(2); // admin1 and moderator1
		});
	});

	describe("Filter Error Handling", () => {
		it("should throw error for non-existent column", async () => {
			const result = await userModel.findMany({
				filters: [{ where: "nonExistentColumn", equals: "value" }],
			});
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("does not exist");
		});

		it("should throw error for empty OR filter", async () => {
			const result = await userModel.findMany({
				filters: [{ or: [] }],
			});
			expect(result.error).toBeDefined();
		});

		it("should throw error for empty AND filter", async () => {
			const result = await userModel.findMany({
				filters: [{ and: [] }],
			});
			expect(result.error).toBeDefined();
		});

		it("should throw error for filter without operator", async () => {
			const result = await userModel.findMany({
				filters: [{ where: "status" }],
			});
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("No operator");
		});
	});

	describe("Filter Performance", () => {
		it("should handle large result sets efficiently", async () => {
			const start = Date.now();

			// Create many users
			const usersData = Array.from({ length: 100 }, (_, i) =>
				createTestUser({
					username: `perfuser${i}`,
					email: `perfuser${i}@example.com`,
					status: i % 2 === 0 ? "active" : "inactive",
					role: i % 3 === 0 ? "admin" : i % 3 === 1 ? "moderator" : "user",
				}),
			);

			await userModel.createMany(usersData);

			const filterStart = Date.now();

			const { data: activeUsers } = await userModel.findMany({
				filters: [
					{
						and: [
							{ where: "status", equals: "active" },
							{ where: "role", in: ["admin", "moderator"] },
						],
					},
				],
			});

			const filterDuration = Date.now() - filterStart;

			expect(activeUsers?.length).toBeGreaterThan(0);
			expect(filterDuration).toBeLessThan(1000); // Should complete within 1 second
		});

		it("should handle complex nested filters efficiently", async () => {
			const start = Date.now();

			const { data: users } = await userModel.findMany({
				filters: [
					{
						and: [
							{
								or: [
									{ where: "status", equals: "active" },
									{ where: "status", equals: "pending" },
								],
							},
							{
								or: [
									{ where: "role", equals: "admin" },
									{ where: "role", equals: "moderator" },
									{ where: "role", equals: "user" },
								],
							},
							{
								and: [
									{ where: "username", like: "%1" },
									{ sql: sql`profile->>'firstName' IS NOT NULL` },
								],
							},
						],
					},
				],
			});

			const duration = Date.now() - start;

			expect(users).toBeDefined();
			expect(duration).toBeLessThan(500); // Should complete within 500ms
		});
	});

	describe("Filter Combinations", () => {
		it("should combine filters with pagination", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "status", equals: "active" }],
				limit: 2,
				offset: 0,
			});

			expect(users).toHaveLength(2);
		});

		it("should combine filters with ordering", async () => {
			const { data: users } = await userModel.findMany({
				filters: [{ where: "role", equals: "admin" }],
				orderBy: [{ field: "username", direction: "asc" }],
			});

			expect(users).toHaveLength(2);
			expect(users![0].username).toBe("admin1");
			expect(users![1].username).toBe("admin2");
		});

		it("should combine complex filters with pagination and ordering", async () => {
			const { data: users } = await userModel.findMany({
				filters: [
					{
						and: [
							{ where: "status", equals: "active" },
							{ where: "role", in: ["admin", "moderator"] },
						],
					},
				],
				limit: 1,
				offset: 1,
				orderBy: [{ field: "username", direction: "asc" }],
			});

			expect(users).toHaveLength(1);
			expect(users![0].username).toBe("admin2");
		});
	});
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	setupTestDb,
	cleanupTestDb,
	testUsers,
	testPosts,
} from "./test-setup-sqlite";
import { createModel } from "../orm";

describe("Enhanced Model Interface - Integration Tests", () => {
	let userModel: any;
	let postModel: any;

	beforeEach(async () => {
		const { db } = await setupTestDb();

		userModel = createModel({
			table: testUsers,
			dbInstance: db,
			config: { dialect: "sqlite", jsonMode: "stringify" },
		});
		postModel = createModel({
			table: testPosts,
			dbInstance: db,
			config: { dialect: "sqlite", jsonMode: "stringify" },
		});
	});

	afterEach(async () => {
		await cleanupTestDb();
	});

	describe("Database Operations", () => {
		it("should create and read records", async () => {
			const newUser = {
				username: "testuser",
				email: "test@example.com",
				status: "active",
				role: "user",
				profile: { firstName: "John", lastName: "Doe" },
			};

			const { data: user, error } = await userModel.create(newUser);
			expect(error).toBeNull();
			expect(user).toBeDefined();
			expect(user?.username).toBe("testuser");
			expect(user?.email).toBe("test@example.com");
		});

		it("should handle JSON columns correctly", async () => {
			const profile = {
				firstName: "Jane",
				lastName: "Smith",
				preferences: {
					theme: "dark",
					notifications: true,
				},
			};

			const { data: user, error } = await userModel.create({
				username: "jane",
				email: "jane@example.com",
				status: "active",
				role: "user",
				profile,
				preferences: { language: "en" },
			});

			expect(error).toBeNull();
			expect(user?.profile).toBeDefined();
			expect(typeof user?.profile).toBe("object");
			if (user?.profile && typeof user.profile === "object") {
				expect((user.profile as any).firstName).toBe("Jane");
			}
		});
	});
});

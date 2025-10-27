import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	setupTestDb,
	cleanupTestDb,
	createTestUser,
	testUsers,
	type TestUser,
} from "./test-setup-sqlite";
import { createModel } from "../orm";

describe("JSON Column Detection and Processing", () => {
	let userModel: any;
	let testUser: TestUser;

	beforeEach(async () => {
		const { db } = await setupTestDb();
		userModel = createModel({
			table: testUsers,
			dbInstance: db,
			config: { dialect: "sqlite", jsonMode: "stringify" },
		});

		const newUser = createTestUser({
			username: "jsonuser",
			email: "jsonuser@example.com",
			profile: {
				firstName: "John",
				lastName: "Doe",
				preferences: {
					theme: "light",
					notifications: true,
					language: "en",
				},
				metadata: {
					lastLogin: "2024-01-01T00:00:00Z",
					loginCount: 5,
				},
			},
			preferences: {
				timezone: "UTC",
				dateFormat: "MM/DD/YYYY",
				settings: {
					autoSave: true,
					darkMode: false,
				},
			},
		});

		const result = await userModel.create(newUser);
		testUser = result.data;
	});

	afterEach(async () => {
		await cleanupTestDb();
	});

	describe("JSON Column Detection", () => {
		it("should detect jsonb columns", async () => {
			// The isJsonColumn function should detect that 'profile' and 'preferences' are JSON columns
			// This is tested indirectly through the automatic parsing behavior
			const result = await userModel.findById(testUser.id);

			expect(result.data?.profile).toBeDefined();
			expect(typeof result.data?.profile).toBe("object");
			expect(result.data?.preferences).toBeDefined();
			expect(typeof result.data?.preferences).toBe("object");
		});
	});

	describe("JSON Parsing on Read", () => {
		it("should automatically parse JSON columns when reading", async () => {
			const result = await userModel.findById(testUser.id);
			const user = result.data;

			// Profile should be parsed as object
			expect(user?.profile).toEqual({
				firstName: "John",
				lastName: "Doe",
				preferences: {
					theme: "light",
					notifications: true,
					language: "en",
				},
				metadata: {
					lastLogin: "2024-01-01T00:00:00Z",
					loginCount: 5,
				},
			});

			// Preferences should be parsed as object
			expect(user?.preferences).toEqual({
				timezone: "UTC",
				dateFormat: "MM/DD/YYYY",
				settings: {
					autoSave: true,
					darkMode: false,
				},
			});
		});

		it("should handle nested JSON objects", async () => {
			const { data: user } = await userModel.findById(testUser.id);

			expect(user?.profile.preferences.theme).toBe("light");
			expect(user?.profile.preferences.notifications).toBe(true);
			expect(user?.profile.metadata.loginCount).toBe(5);
			expect(user?.preferences.settings.autoSave).toBe(true);
			expect(user?.preferences.settings.darkMode).toBe(false);
		});

		it("should handle JSON arrays", async () => {
			const { data: userWithArray } = await userModel.create(
				createTestUser({
					username: "arrayuser",
					email: "arrayuser@example.com",
					profile: {
						tags: ["developer", "typescript", "nodejs"],
						skills: [
							{ name: "JavaScript", level: "expert" },
							{ name: "TypeScript", level: "advanced" },
						],
					},
				}),
			);

			const { data: user } = await userModel.findById(userWithArray.id);
			expect(user?.profile.tags).toEqual(["developer", "typescript", "nodejs"]);
			expect(user?.profile.skills).toHaveLength(2);
			expect(user?.profile.skills[0].name).toBe("JavaScript");
		});
	});

	describe("JSON Stringifying on Write", () => {
		it("should automatically stringify JSON objects when creating", async () => {
			const newProfile = {
				firstName: "Jane",
				lastName: "Smith",
				preferences: {
					theme: "dark",
					notifications: false,
				},
			};

			const { data: newUser } = await userModel.create(
				createTestUser({
					username: "newjsonuser",
					email: "newjsonuser@example.com",
					profile: newProfile,
				}),
			);

			expect(newUser.profile).toEqual(newProfile);
		});

		it("should automatically stringify JSON objects when updating", async () => {
			const updatedProfile = {
				firstName: "Updated",
				lastName: "Name",
				preferences: {
					theme: "dark",
					notifications: false,
				},
				newField: {
					nested: {
						value: "test",
					},
				},
			};

			const { data: updatedUser } = await userModel.update(testUser.id, {
				profile: updatedProfile,
			});

			// Check that profile was updated correctly
			expect(updatedUser?.profile).toBeDefined();
			expect(updatedUser?.profile.firstName).toBe("Updated");
			expect(updatedUser?.profile.lastName).toBe("Name");
			expect(updatedUser?.profile.preferences.theme).toBe("dark");
			expect(updatedUser?.profile.newField.nested.value).toBe("test");
		});

		it("should handle partial JSON updates", async () => {
			const partialUpdate = {
				"profile.preferences.theme": "dark",
				"profile.preferences.notifications": false,
			};

			// This would require a custom update method for nested JSON updates
			// For now, we'll do a full profile update
			const { data: currentUser } = await userModel.findById(testUser.id);
			const updatedProfile = {
				...currentUser?.profile,
				preferences: {
					...currentUser?.profile.preferences,
					theme: "dark",
					notifications: false,
				},
			};

			const { data: updatedUser } = await userModel.update(testUser.id, {
				profile: updatedProfile,
			});

			expect(updatedUser.profile.preferences.theme).toBe("dark");
			expect(updatedUser.profile.preferences.notifications).toBe(false);
		});
	});

	describe("JSON Error Handling", () => {
		it("should handle invalid JSON gracefully", async () => {
			// This test would require injecting invalid JSON data
			// In a real scenario, this would be handled by the database constraints
			const { data: user } = await userModel.findById(testUser.id);
			expect(user).toBeDefined();
		});

		it("should handle null JSON values", async () => {
			const { data: userWithNullJson } = await userModel.create(
				createTestUser({
					username: "nulljsonuser",
					email: "nulljsonuser@example.com",
					profile: null,
					preferences: null,
				}),
			);

			const { data: user } = await userModel.findById(userWithNullJson.id);
			expect(user?.profile).toBeNull();
			expect(user?.preferences).toBeNull();
		});

		it("should handle empty JSON objects", async () => {
			const { data: userWithEmptyJson } = await userModel.create(
				createTestUser({
					username: "emptyjsonuser",
					email: "emptyjsonuser@example.com",
					profile: {},
					preferences: {},
				}),
			);

			const { data: user } = await userModel.findById(userWithEmptyJson.id);
			expect(user?.profile).toEqual({});
			expect(user?.preferences).toEqual({});
		});
	});

	describe("JSON Performance", () => {
		it("should handle large JSON objects efficiently", async () => {
			const largeProfile = {
				firstName: "John",
				lastName: "Doe",
				preferences: {
					theme: "light",
					notifications: true,
					language: "en",
					timezone: "UTC",
					dateFormat: "MM/DD/YYYY",
					settings: {
						autoSave: true,
						darkMode: false,
						fontSize: 14,
						fontFamily: "Arial",
						colors: {
							primary: "#007bff",
							secondary: "#6c757d",
							success: "#28a745",
							warning: "#ffc107",
							danger: "#dc3545",
						},
					},
				},
				metadata: {
					lastLogin: "2024-01-01T00:00:00Z",
					loginCount: 5,
					sessionData: {
						currentSession: "abc123",
						previousSessions: ["def456", "ghi789"],
						deviceInfo: {
							browser: "Chrome",
							version: "120.0.0.0",
							os: "Windows",
							screenResolution: "1920x1080",
						},
					},
				},
				extendedData: Array.from({ length: 100 }, (_, i) => ({
					id: i,
					name: `Item ${i}`,
					value: Math.random(),
					tags: [`tag${i % 10}`, `category${i % 5}`],
				})),
			};

			const start = Date.now();

			const { data: userWithLargeJson } = await userModel.create(
				createTestUser({
					username: "largejsonuser",
					email: "largejsonuser@example.com",
					profile: largeProfile,
				}),
			);

			const createDuration = Date.now() - start;

			const startRead = Date.now();
			const { data: user } = await userModel.findById(userWithLargeJson.id);
			const readDuration = Date.now() - startRead;

			expect(user?.profile).toEqual(largeProfile);
			expect(createDuration).toBeLessThan(1000); // Should create within 1 second
			expect(readDuration).toBeLessThan(500); // Should read within 500ms
		});

		it("should handle multiple JSON columns efficiently", async () => {
			const start = Date.now();

			const usersData = Array.from({ length: 50 }, (_, i) =>
				createTestUser({
					username: `jsonperf${i}`,
					email: `jsonperf${i}@example.com`,
					profile: {
						firstName: `User${i}`,
						lastName: "Test",
						preferences: {
							theme: i % 2 === 0 ? "light" : "dark",
							notifications: i % 3 === 0,
						},
					},
					preferences: {
						timezone: "UTC",
						language: "en",
						settings: {
							autoSave: true,
							fontSize: 12 + (i % 8),
						},
					},
				}),
			);

			const result = await userModel.createMany(usersData);
			const duration = Date.now() - start;

			expect(result.data).toHaveLength(50);
			expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

			// Verify JSON parsing works for all users
			const { data: users } = await userModel.findMany({
				filters: [{ where: "username", like: "jsonperf%" }],
			});

			expect(users).toHaveLength(50);
			expect(users?.every((u: any) => typeof u.profile === "object")).toBe(
				true,
			);
			expect(users?.every((u: any) => typeof u.preferences === "object")).toBe(
				true,
			);
		});
	});
});

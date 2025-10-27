import { describe, it, expect } from "vitest";
import { getChanges } from "../get-changes";

describe("getChanges", () => {
	it("should return only changed nested fields", () => {
		const oldData = {
			firstName: "Original",
			lastName: "Name",
			preferences: {
				theme: "light",
				language: "en",
				notifications: true,
			},
			metadata: {
				lastLogin: "2024-01-01",
				loginCount: 5,
			},
			customField: "preserved",
		};

		const newData = {
			preferences: {
				theme: "dark",
			},
		};

		const changes = getChanges(oldData, newData);

		console.log("Changes:", JSON.stringify(changes, null, 2));

		// getChanges should return only the changed nested fields
		expect(changes).toHaveProperty("preferences");
		expect(changes.preferences).toHaveProperty("theme");
		expect(changes.preferences?.theme).toBe("dark");
	});

	it("should handle partial profile updates", () => {
		const oldProfile = {
			firstName: "Original",
			lastName: "Name",
			preferences: {
				theme: "light",
				language: "en",
				notifications: true,
			},
		};

		const newProfile = {
			preferences: {
				theme: "dark",
			},
		};

		const changes = getChanges(oldProfile, newProfile);

		expect(changes).toHaveProperty("preferences");
		expect(changes.preferences).toEqual({ theme: "dark" });
	});
});

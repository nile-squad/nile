import { describe, it, expect } from "vitest";
import { mergeChanges } from "../merge-changes";

describe("mergeChanges", () => {
	it("should merge simple object property changes", () => {
		const existing = { a: 1, b: 2 };
		const incoming = { a: 3 };

		const { diff, result } = mergeChanges(existing, incoming);

		expect(result).toEqual({ a: 3, b: 2 });
		expect(diff).toEqual([{ op: "replace", path: ["a"], value: 3 }]);
	});

	it("should merge nested object changes while preserving all fields", () => {
		const existing = {
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

		const incoming = {
			preferences: {
				theme: "dark",
			},
		};

		const { diff, result } = mergeChanges(existing, incoming);

		// All existing fields should be preserved
		expect(result.firstName).toBe("Original");
		expect(result.lastName).toBe("Name");
		expect(result.customField).toBe("preserved");

		// Preferences should be merged
		expect(result.preferences.theme).toBe("dark");
		expect(result.preferences.language).toBe("en");
		expect(result.preferences.notifications).toBe(true);

		// Metadata should be preserved
		expect(result.metadata.lastLogin).toBe("2024-01-01");
		expect(result.metadata.loginCount).toBe(5);

		// Diff should contain only the changed path
		expect(diff).toHaveLength(1);
		expect(diff[0].op).toBe("replace");
		expect(diff[0].path).toEqual(["preferences", "theme"]);
		expect(diff[0].value).toBe("dark");
	});

	it("should handle adding new fields", () => {
		const existing = { a: 1 };
		const incoming = { b: 2 };

		const { result } = mergeChanges(existing, incoming);

		expect(result).toEqual({ a: 1, b: 2 });
	});

	it("should handle removing fields", () => {
		const existing = { a: 1, b: 2, c: 3 };
		const incoming = { a: 1, c: 3 };

		const { result } = mergeChanges(existing, incoming);

		// Note: mergeChanges only adds/updates fields, doesn't remove them
		// This test verifies that b is preserved (not removed)
		expect(result.b).toBe(2);
		expect(result).toEqual({ a: 1, b: 2, c: 3 });
	});

	it("should not mutate the original objects", () => {
		const existing = { a: 1, b: { x: 2 } };
		const incoming = { b: { x: 3 } };

		const originalExisting = JSON.parse(JSON.stringify(existing));
		const originalIncoming = JSON.parse(JSON.stringify(incoming));

		mergeChanges(existing, incoming);

		expect(existing).toEqual(originalExisting);
		expect(incoming).toEqual(originalIncoming);
	});

	it("should return empty diff when objects are identical", () => {
		const obj = { a: 1, b: 2 };

		const { diff, result } = mergeChanges(obj, obj);

		expect(result).toEqual(obj);
		expect(diff).toEqual([]);
	});

	it("should handle deeply nested object updates", () => {
		const existing = {
			profile: {
				user: {
					settings: {
						display: {
							theme: "light",
							layout: "grid",
						},
					},
				},
			},
		};

		const incoming = {
			profile: {
				user: {
					settings: {
						display: {
							theme: "dark",
						},
					},
				},
			},
		};

		const { result } = mergeChanges(existing, incoming);

		expect(result.profile.user.settings.display.theme).toBe("dark");
		expect(result.profile.user.settings.display.layout).toBe("grid");
	});

	it("should handle array updates", () => {
		const existing = { tags: ["js", "ts", "node"] };
		const incoming = { tags: ["js", "ts", "react"] };

		const { result } = mergeChanges(existing, incoming);

		// Arrays are replaced entirely
		expect(result.tags).toEqual(["js", "ts", "react"]);
	});

	it("should handle real-world update scenario", () => {
		const oldProfile = {
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

		const { result } = mergeChanges(oldProfile, newData);

		expect(result.firstName).toBe("Original");
		expect(result.lastName).toBe("Name");
		expect(result.preferences.theme).toBe("dark");
		expect(result.preferences.language).toBe("en");
		expect(result.preferences.notifications).toBe(true);
		expect(result.metadata.lastLogin).toBe("2024-01-01");
		expect(result.metadata.loginCount).toBe(5);
		expect(result.customField).toBe("preserved");
	});
});

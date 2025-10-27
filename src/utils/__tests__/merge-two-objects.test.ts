import { describe, it, expect } from "vitest";
import { mergeTwoObjects } from "../merge-two-objects";

describe("mergeTwoObjects", () => {
	it("should merge simple nested objects", () => {
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

		const merged = mergeTwoObjects(oldProfile, newData);

		expect(merged.firstName).toBe("Original");
		expect(merged.lastName).toBe("Name");
		expect(merged.preferences.theme).toBe("dark");
		expect(merged.preferences.language).toBe("en");
		expect(merged.preferences.notifications).toBe(true);
		expect(merged.metadata.lastLogin).toBe("2024-01-01");
		expect(merged.metadata.loginCount).toBe(5);
		expect(merged.customField).toBe("preserved");
	});

	it("should deeply merge nested objects", () => {
		const original = {
			level1: {
				level2: {
					level3: {
						value: "original",
						preserved: "should remain",
					},
				},
				sibling: "preserved",
			},
		};

		const updates = {
			level1: {
				level2: {
					level3: {
						value: "updated",
					},
				},
			},
		};

		const merged = mergeTwoObjects(original, updates);

		expect(merged.level1.level2.level3.value).toBe("updated");
		expect(merged.level1.level2.level3.preserved).toBe("should remain");
		expect(merged.level1.sibling).toBe("preserved");
	});

	it("should replace arrays completely", () => {
		const original = {
			tags: ["tag1", "tag2", "tag3"],
			items: ["item1", "item2"],
		};

		const updates = {
			tags: ["new-tag"],
		};

		const merged = mergeTwoObjects(original, updates);

		expect(merged.tags).toEqual(["new-tag"]);
		expect(merged.items).toEqual(["item1", "item2"]);
	});

	it("should handle multiple JSON columns independently", () => {
		const original = {
			profile: {
				profileField: "profileValue",
			},
			preferences: {
				prefField: "prefValue",
			},
		};

		const updates = {
			profile: {
				newProfileField: "newValue",
			},
			preferences: {
				newPrefField: "newPrefValue",
			},
		};

		const merged = mergeTwoObjects(original, updates);

		expect(merged.profile.profileField).toBe("profileValue");
		expect(merged.profile.newProfileField).toBe("newValue");
		expect(merged.preferences.prefField).toBe("prefValue");
		expect(merged.preferences.newPrefField).toBe("newPrefValue");
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

		const merged = mergeTwoObjects(oldProfile, newData);

		console.log("Merged:", JSON.stringify(merged, null, 2));

		expect(merged.firstName).toBe("Original");
		expect(merged.lastName).toBe("Name");
		expect(merged.preferences.theme).toBe("dark");
		expect(merged.preferences.language).toBe("en");
		expect(merged.preferences.notifications).toBe(true);
		expect(merged.metadata.lastLogin).toBe("2024-01-01");
		expect(merged.metadata.loginCount).toBe(5);
		expect(merged.customField).toBe("preserved");
	});

	it("should handle null values", () => {
		const original = {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		};

		const updates = {
			field1: null,
		};

		const merged = mergeTwoObjects(original, updates) as any;

		expect(merged.field1).toBeNull();
		expect(merged.field2).toBe("value2");
		expect(merged.field3).toBe("value3");
	});
});

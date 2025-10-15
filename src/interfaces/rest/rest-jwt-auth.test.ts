import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sign } from 'hono/jwt';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { serve } from '@hono/node-server';
import { createRestRPC, useAppInstance } from './rest-server';
import type { SubService } from '../../types/actions';
import type { ServerConfig } from './rest-server';

const testUsersTable = sqliteTable('test_jwt_users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	organization_id: text('organization_id').notNull(),
	user_id: text('user_id').notNull(),
});

const TEST_PORT = 9877;
const TEST_SECRET = 'test-jwt-secret-key-for-auth-testing';

describe('REST Layer JWT Authentication Tests', () => {
	let db: Database.Database;
	let drizzleDb: any;
	let server: any;
	let baseUrl: string;

	beforeAll(async () => {
		db = new Database(':memory:');
		drizzleDb = drizzle(db);

		db.exec(`
      CREATE TABLE test_jwt_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL
      )
    `);

		drizzleDb
			.insert(testUsersTable)
			.values([
				{
					id: 'user-1',
					name: 'John Doe',
					email: 'john@example.com',
					organization_id: 'org-1',
					user_id: 'auth-user-1',
				},
				{
					id: 'user-2',
					name: 'Jane Smith',
					email: 'jane@example.com',
					organization_id: 'org-2',
					user_id: 'auth-user-2',
				},
			])
			.run();

		const testSubService: SubService = {
			name: 'testUsers',
			description: 'Test users service for JWT auth',
			tableName: 'test_jwt_users',
			idName: 'id',
			publicActions: [],
			actions: [],
		};

		const serverConfig: ServerConfig = {
			serverName: 'Test JWT Auth Server',
			baseUrl: '/test',
			apiVersion: 'v1',
			services: [
				{
					name: 'testUsers',
					description: 'Test users service',
					actions: [],
					autoService: true,
					subs: [testSubService],
				},
			],
			host: 'localhost',
			port: TEST_PORT.toString(),
			db: {
				instance: drizzleDb,
				tables: { test_jwt_users: testUsersTable },
			},
		allowedOrigins: ['*'],
		auth: {
			secret: TEST_SECRET,
			method: 'header',
			authHandler: 'jwt',
		},
		};

		baseUrl = `http://localhost:${TEST_PORT}/test/v1/services`;

		const app = createRestRPC(serverConfig);

		server = serve(
			{
				fetch: app.fetch,
				port: TEST_PORT,
			},
			() => {
				console.log(`Test JWT auth server running on ${baseUrl}`);
			}
		);

		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	afterAll(async () => {
		if (server) {
			server.close();
		}
		if (db) {
			db.close();
		}
	});

	describe('JWT Authentication - Header Method', () => {
		it('should reject protected action without token', async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.status).toBe(false);
		expect(data.message).toContain('JWT token');
		});

		it('should accept valid JWT token in Authorization header', async () => {
			const token = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.id).toBe('user-1');
			expect(data.data.name).toBe('John Doe');
		});

		it('should reject invalid JWT token', async () => {
			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer invalid-token-here',
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should reject expired JWT token', async () => {
			const expiredToken = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) - 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${expiredToken}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should reject token with missing userId', async () => {
			const tokenWithoutUserId = await sign(
				{
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${tokenWithoutUserId}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should reject token with missing organizationId', async () => {
			const tokenWithoutOrgId = await sign(
				{
					userId: 'auth-user-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${tokenWithoutOrgId}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should allow multiple requests with same token', async () => {
			const token = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const headers = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			};

			const response1 = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const response2 = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			expect(response1.status).toBe(200);
			expect(response2.status).toBe(200);

			const data1 = await response1.json();
			const data2 = await response2.json();

			expect(data1.data.id).toBe('user-1');
			expect(data2.data.id).toBe('user-1');
		});
	});

	describe('JWT Authentication - Cookie Method', () => {
		let cookieServer: any;
		let cookieDb: Database.Database;
		let cookieDrizzleDb: any;
		let cookieBaseUrl: string;

		beforeAll(async () => {
			cookieDb = new Database(':memory:');
			cookieDrizzleDb = drizzle(cookieDb);

			cookieDb.exec(`
        CREATE TABLE test_jwt_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          organization_id TEXT NOT NULL,
          user_id TEXT NOT NULL
        )
      `);

			cookieDrizzleDb
				.insert(testUsersTable)
				.values([
					{
						id: 'user-1',
						name: 'John Doe',
						email: 'john@example.com',
						organization_id: 'org-1',
						user_id: 'auth-user-1',
					},
					{
						id: 'user-2',
						name: 'Jane Smith',
						email: 'jane@example.com',
						organization_id: 'org-2',
						user_id: 'auth-user-2',
					},
				])
				.run();

			const testSubService: SubService = {
				name: 'testUsers',
				description: 'Test users service',
				tableName: 'test_jwt_users',
				idName: 'id',
				publicActions: [],
				actions: [],
			};

			const cookieConfig: ServerConfig = {
				serverName: 'Test JWT Cookie Server',
				baseUrl: '/test',
				apiVersion: 'v1',
				services: [
					{
						name: 'testUsers',
						description: 'Test users service',
						actions: [],
						autoService: true,
						subs: [testSubService],
					},
				],
				host: 'localhost',
				port: (TEST_PORT + 1).toString(),
				db: {
					instance: cookieDrizzleDb,
					tables: { test_jwt_users: testUsersTable },
				},
			allowedOrigins: ['*'],
			auth: {
				secret: TEST_SECRET,
				method: 'cookie',
				cookieName: 'auth_token',
				authHandler: 'jwt',
			},
			};

			const app = createRestRPC(cookieConfig);

			cookieServer = serve({
				fetch: app.fetch,
				port: TEST_PORT + 1,
			});

			cookieBaseUrl = `http://localhost:${TEST_PORT + 1}/test/v1/services`;
			await new Promise((resolve) => setTimeout(resolve, 500));
		});

		afterAll(() => {
			if (cookieServer) {
				cookieServer.close();
			}
			if (cookieDb) {
				cookieDb.close();
			}
		});

		it('should accept valid JWT token from cookie', async () => {
			const token = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${cookieBaseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `auth_token=${token}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.id).toBe('user-1');
		});

		it('should reject request without cookie', async () => {
			const response = await fetch(`${cookieBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should use custom cookie name if configured', async () => {
			const token = await sign(
				{
					userId: 'auth-user-2',
					organizationId: 'org-2',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${cookieBaseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: `auth_token=${token}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-2' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.id).toBe('user-2');
		});
	});

	describe('JWT Authentication - Payload Method', () => {
		let payloadServer: any;
		let payloadDb: Database.Database;
		let payloadDrizzleDb: any;
		let payloadBaseUrl: string;

		beforeAll(async () => {
			payloadDb = new Database(':memory:');
			payloadDrizzleDb = drizzle(payloadDb);

			payloadDb.exec(`
        CREATE TABLE test_jwt_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          organization_id TEXT NOT NULL,
          user_id TEXT NOT NULL
        )
      `);

			payloadDrizzleDb
				.insert(testUsersTable)
				.values([
					{
						id: 'user-1',
						name: 'John Doe',
						email: 'john@example.com',
						organization_id: 'org-1',
						user_id: 'auth-user-1',
					},
					{
						id: 'user-3',
						name: 'Bob Johnson',
						email: 'bob@example.com',
						organization_id: 'org-1',
						user_id: 'auth-user-3',
					},
				])
				.run();

			const testSubService: SubService = {
				name: 'testUsers',
				description: 'Test users service',
				tableName: 'test_jwt_users',
				idName: 'id',
				publicActions: [],
				actions: [],
			};

			const payloadConfig: ServerConfig = {
				serverName: 'Test JWT Payload Server',
				baseUrl: '/test',
				apiVersion: 'v1',
				services: [
					{
						name: 'testUsers',
						description: 'Test users service',
						actions: [],
						autoService: true,
						subs: [testSubService],
					},
				],
				host: 'localhost',
				port: (TEST_PORT + 2).toString(),
				db: {
					instance: payloadDrizzleDb,
					tables: { test_jwt_users: testUsersTable },
				},
			allowedOrigins: ['*'],
			auth: {
				secret: TEST_SECRET,
				method: 'payload',
				authHandler: 'jwt',
			},
			};

			const app = createRestRPC(payloadConfig);

			payloadServer = serve({
				fetch: app.fetch,
				port: TEST_PORT + 2,
			});

			payloadBaseUrl = `http://localhost:${TEST_PORT + 2}/test/v1/services`;
			await new Promise((resolve) => setTimeout(resolve, 500));
		});

		afterAll(() => {
			if (payloadServer) {
				payloadServer.close();
			}
			if (payloadDb) {
				payloadDb.close();
			}
		});

		it('should accept valid JWT token in request payload', async () => {
			const token = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${payloadBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
					auth: { token },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(data.data.id).toBe('user-1');
		});

		it('should reject request without auth payload', async () => {
			const response = await fetch(`${payloadBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should handle invalid token in payload', async () => {
			const response = await fetch(`${payloadBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
					auth: { token: 'invalid-token' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should support CRUD operations with payload auth', async () => {
			const token = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const updateResponse = await fetch(`${payloadBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update',
					payload: {
						id: 'user-3',
						name: 'Robert Johnson',
					},
					auth: { token },
				}),
			});

		const updateData = await updateResponse.json();

		expect(updateResponse.status).toBe(200);
		expect(updateData.status).toBe(true);
		expect(updateData.data.name).toBe('Robert Johnson');
		});
	});

	describe('JWT Token Validation Edge Cases', () => {
		it('should reject token signed with wrong secret', async () => {
			const wrongToken = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				'wrong-secret-key'
			);

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${wrongToken}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

	it('should reject Authorization header without Bearer prefix', async () => {
		const token = await sign(
			{
				userId: 'auth-user-1',
				organizationId: 'org-1',
				exp: Math.floor(Date.now() / 1000) + 3600,
			},
			TEST_SECRET
		);

		const response = await fetch(`${baseUrl}/testUsers`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: token,
			},
			body: JSON.stringify({
				action: 'getOne',
				payload: { id: 'user-1' },
			}),
		});

		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.status).toBe(false);
		expect(data.message).toContain('Bearer scheme');
	});

		it('should accept token with additional custom claims', async () => {
			const tokenWithCustomClaims = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					email: 'john@example.com',
					role: 'admin',
					permissions: ['read', 'write'],
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${baseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${tokenWithCustomClaims}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
		});
	});

	describe('Public Actions with JWT', () => {
		let publicServer: any;
		let publicDb: Database.Database;
		let publicDrizzleDb: any;
		let publicBaseUrl: string;

		beforeAll(async () => {
			publicDb = new Database(':memory:');
			publicDrizzleDb = drizzle(publicDb);

			publicDb.exec(`
        CREATE TABLE test_jwt_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          organization_id TEXT NOT NULL,
          user_id TEXT NOT NULL
        )
      `);

			publicDrizzleDb
				.insert(testUsersTable)
				.values([
					{
						id: 'user-1',
						name: 'John Doe',
						email: 'john@example.com',
						organization_id: 'org-1',
						user_id: 'auth-user-1',
					},
					{
						id: 'user-2',
						name: 'Jane Smith',
						email: 'jane@example.com',
						organization_id: 'org-2',
						user_id: 'auth-user-2',
					},
				])
				.run();

			const testSubService: SubService = {
				name: 'testUsers',
				description: 'Test users service',
				tableName: 'test_jwt_users',
				idName: 'id',
				publicActions: ['getEvery'],
				actions: [],
			};

			const publicConfig: ServerConfig = {
				serverName: 'Test Public Actions Server',
				baseUrl: '/test',
				apiVersion: 'v1',
				services: [
					{
						name: 'testUsers',
						description: 'Test users service',
						actions: [],
						autoService: true,
						subs: [testSubService],
					},
				],
				host: 'localhost',
				port: (TEST_PORT + 3).toString(),
				db: {
					instance: publicDrizzleDb,
					tables: { test_jwt_users: testUsersTable },
				},
			allowedOrigins: ['*'],
			auth: {
				secret: TEST_SECRET,
				method: 'header',
				authHandler: 'jwt',
			},
		};

			const app = createRestRPC(publicConfig);

			publicServer = serve({
				fetch: app.fetch,
				port: TEST_PORT + 3,
			});

			publicBaseUrl = `http://localhost:${TEST_PORT + 3}/test/v1/services`;
			await new Promise((resolve) => setTimeout(resolve, 500));
		});

		afterAll(() => {
			if (publicServer) {
				publicServer.close();
			}
			if (publicDb) {
				publicDb.close();
			}
		});

		it('should allow public actions without authentication', async () => {
			const response = await fetch(`${publicBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getEvery',
					payload: {},
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.status).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
		});

		it('should still require auth for protected actions', async () => {
			const response = await fetch(`${publicBaseUrl}/testUsers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.status).toBe(false);
		});

		it('should allow protected actions with valid token', async () => {
			const token = await sign(
				{
					userId: 'auth-user-1',
					organizationId: 'org-1',
					exp: Math.floor(Date.now() / 1000) + 3600,
				},
				TEST_SECRET
			);

			const response = await fetch(`${publicBaseUrl}/testUsers`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					action: 'getOne',
					payload: { id: 'user-1' },
				}),
			});

			const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe(true);
	});
});

describe('useAppInstance() Integration', () => {
	let db: Database.Database;
	let drizzleDb: any;
	let server: any;
	let baseUrl: string;
	const CUSTOM_PORT = 9881;

	beforeAll(async () => {
		db = new Database(':memory:');
		drizzleDb = drizzle(db);

		db.exec(`
      CREATE TABLE test_jwt_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL
      )
    `);

		const testSubService: SubService = {
			name: 'testUsers',
			description: 'Test users service',
			tableName: 'test_jwt_users',
			idName: 'id',
			publicActions: [],
			actions: [],
		};

		const serverConfig: ServerConfig = {
			serverName: 'Test Custom Route Server',
			baseUrl: '/test',
			apiVersion: 'v1',
			services: [
				{
					name: 'testUsers',
					description: 'Test users service',
					actions: [],
					autoService: true,
					subs: [testSubService],
				},
			],
			host: 'localhost',
			port: CUSTOM_PORT.toString(),
			db: {
				instance: drizzleDb,
				tables: { test_jwt_users: testUsersTable },
			},
			allowedOrigins: ['*'],
			auth: {
				secret: TEST_SECRET,
				method: 'header',
				authHandler: 'jwt',
			},
		};

		baseUrl = `http://localhost:${CUSTOM_PORT}`;

		const app = createRestRPC(serverConfig);

		const appInstance = useAppInstance();
		appInstance?.get('/custom-route', (c) => {
			return c.json({
				status: true,
				message: 'Custom route works!',
				data: { custom: true },
			});
		});

		server = serve({ fetch: app.fetch, port: CUSTOM_PORT });
		console.log(
			`Custom route test server running on ${baseUrl}`
		);
	});

	afterAll(() => {
		if (server) {
			server.close();
		}
		if (db) {
			db.close();
		}
	});

	it('should allow adding custom routes via useAppInstance', async () => {
		const response = await fetch(`${baseUrl}/custom-route`, {
			method: 'GET',
		});

		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe(true);
		expect(data.message).toBe('Custom route works!');
		expect(data.data.custom).toBe(true);
	});

	it('should still have access to generated service routes', async () => {
		const response = await fetch(`${baseUrl}/test/v1/services`, {
			method: 'GET',
		});

		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe(true);
		expect(Array.isArray(data.data)).toBe(true);
	});
});
});

import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-long';
process.env.OPENROUTER_DAILY_BUDGET = process.env.OPENROUTER_DAILY_BUDGET || '2.00';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { vi, test, expect } from 'vitest';
import { answer } from '@/lib/ai';

vi.mock('ai', () => ({ streamText: vi.fn(async () => 'mocked') }));

test('answer delegates to streamText', async () => {
  expect(await answer('hi')).toBe('mocked');
});

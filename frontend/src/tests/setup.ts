import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { resetHealthCache } from '../hooks/useHealthStatus';

beforeEach(() => {
  resetHealthCache();
});

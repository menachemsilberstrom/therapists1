import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup(); // unmount whatever the test rendered
  localStorage.clear(); // the login token lives here: tests must never leak a session into the next one
});

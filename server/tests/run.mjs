#!/usr/bin/env node
/**
 * `npm test` entry point: runs the whole Vitest suite.
 *
 * Why not simply call `vitest run`? On some Windows setups the Node runtime occasionally ABORTS a test worker by itself
 * (for example "Worker exited unexpectedly with exit code 3221226505") in the middle of an otherwise passing file, or the
 * whole run dies without printing a summary. That is a crash of the runtime, not a test failure, and it would make a
 * run fail at random. This runner recognises exactly those situations and re-runs (up to three times):
 *   - only the affected files, when Vitest reports which worker died, or
 *   - the whole run, when it ended without any summary or went completely silent for too long.
 *
 * It never hides real problems: if any test FAILS (an assertion, an error, a timeout), the run is not retried and the
 * exit code is non-zero. Extra arguments are passed straight to Vitest, e.g. `npm test -- tests/auth.test.ts`.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_RETRIES = 3;
const SILENCE_LIMIT_MS = 150_000; // a normal run prints something at least every few seconds
// eslint-disable-next-line no-control-regex
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

function runVitest(args) {
  return new Promise((resolve) => {
    const vitestEntry = path.join('node_modules', 'vitest', 'vitest.mjs');
    const child = spawn(process.execPath, [vitestEntry, 'run', ...args], { stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    let hung = false;
    let watchdog;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        hung = true;
        child.kill();
      }, SILENCE_LIMIT_MS);
    };
    arm();
    for (const [stream, sink] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', (chunk) => {
        arm();
        output += chunk;
        sink.write(chunk);
      });
    }
    child.on('close', (code) => {
      clearTimeout(watchdog);
      resolve({ code: code ?? 1, output: stripAnsi(output), hung });
    });
  });
}

function analyse({ output, hung }) {
  const crashed = [...output.matchAll(/Worker exited unexpectedly[^\n]*while running test file (\S[^\n]*?\.test\.ts)/g)].map((m) =>
    path.relative(process.cwd(), m[1].trim()).split(path.sep).join('/'),
  );
  const genuineFailure = /^\s*(Test Files|Tests)\s+.*\bfailed\b/m.test(output) || /^\s*FAIL\s/m.test(output);
  const noSummary = hung || !/^\s*Test Files\s/m.test(output);
  return { crashed: [...new Set(crashed)], genuineFailure, noSummary, hung };
}

const userArgs = process.argv.slice(2);
let result = await runVitest(userArgs);

for (let attempt = 1; attempt <= MAX_RETRIES && result.code !== 0; attempt += 1) {
  const { crashed, genuineFailure, noSummary, hung } = analyse(result);
  if (genuineFailure || (crashed.length === 0 && !noSummary)) break; // a real failure (or an unrelated error): never retry it

  if (crashed.length > 0) {
    console.log('\n[test runner] A worker process was aborted by the runtime (not a test failure) while running:');
    for (const file of crashed) console.log(`[test runner]   ${file}`);
    console.log(`[test runner] Re-running only those files (attempt ${attempt} of ${MAX_RETRIES})...\n`);
    result = await runVitest(crashed);
  } else {
    console.log(`\n[test runner] The run ${hung ? 'went silent and was stopped' : 'ended without a summary'} (the runtime crashed; no test failed).`);
    console.log(`[test runner] Running everything again (attempt ${attempt} of ${MAX_RETRIES})...\n`);
    result = await runVitest(userArgs);
  }
}

process.exit(result.code);

import { analyzeRepository } from './analyze.js';
import { VERSION } from './constants.js';
import { formatReport } from './report.js';

export async function runCli(argv) {
  const options = parseArgs(argv);

  if (options.help) {
    console.log(helpText());
    return;
  }

  if (options.version) {
    console.log(VERSION);
    return;
  }

  if (!options.targetPath) {
    console.error(helpText());
    process.exitCode = 1;
    return;
  }

  const result = await analyzeRepository(options.targetPath, { maxFiles: options.maxFiles });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const color = options.color && !process.env.NO_COLOR;
    console.log(formatReport(result, { color }));
  }

  if (
    options.minCoverage !== null &&
    result.coverage.percentage !== null &&
    result.coverage.percentage < options.minCoverage
  ) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    json: false,
    color: process.stdout.isTTY,
    help: false,
    version: false,
    targetPath: null,
    minCoverage: null,
    maxFiles: undefined
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--json') {
      options.json = true;
      options.color = false;
    } else if (arg === '--no-color') {
      options.color = false;
    } else if (arg === '--min-coverage') {
      const value = argv[i + 1];
      if (!value) throw new Error('--min-coverage requires a number from 0 to 100');
      options.minCoverage = parseCoverage(value);
      i += 1;
    } else if (arg.startsWith('--min-coverage=')) {
      options.minCoverage = parseCoverage(arg.slice('--min-coverage='.length));
    } else if (arg === '--max-files') {
      options.maxFiles = parsePositiveInteger(argv[i + 1], '--max-files');
      i += 1;
    } else if (arg.startsWith('--max-files=')) {
      options.maxFiles = parsePositiveInteger(arg.slice('--max-files='.length), '--max-files');
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.targetPath) {
      options.targetPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function parsePositiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return number;
}

function parseCoverage(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error('--min-coverage requires a number from 0 to 100');
  }
  return number;
}

function helpText() {
  return `eval-audit ${VERSION}

Usage:
  eval-audit [--json] [--no-color] [--min-coverage N] <path-to-repo>

Options:
  --json              Print machine-readable JSON.
  --no-color          Disable ANSI color in the terminal report.
  --min-coverage N    Exit non-zero when call-site coverage is below N percent.
  --max-files N       Stop walking after N readable files (default 8000).
  -h, --help          Show this help text.
  -v, --version       Print the CLI version.`;
}

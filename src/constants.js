export const VERSION = '0.1.0';

export const VERDICTS = {
  noEvals: 'No evals',
  smoke: 'Smoke only',
  partial: 'Partial coverage',
  well: 'Well covered',
  gated: 'Gated in CI'
};

export const IGNORED_DIRECTORIES = new Set([
  '.cache',
  '.claude',
  '.git',
  '.github',
  '.hg',
  '.idea',
  '.next',
  '.nuxt',
  '.parcel-cache',
  '.queue',
  '.svn',
  '.turbo',
  '.vercel',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'vendor'
]);

export const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'poetry.lock',
  'cargo.lock',
  'go.sum'
]);

export const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.cljs',
  '.clj',
  '.cs',
  '.csv',
  '.erl',
  '.ex',
  '.exs',
  '.go',
  '.graphql',
  '.gql',
  '.hrl',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsonc',
  '.jsonl',
  '.jsx',
  '.kt',
  '.md',
  '.mdx',
  '.mjs',
  '.php',
  '.prisma',
  '.prompt',
  '.py',
  '.rb',
  '.rs',
  '.scala',
  '.sql',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml'
]);

export const CODE_EXTENSIONS = new Set([
  '.cjs',
  '.cljs',
  '.clj',
  '.cs',
  '.erl',
  '.ex',
  '.exs',
  '.go',
  '.hrl',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.mjs',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.scala',
  '.swift',
  '.ts',
  '.tsx'
]);

export const LOCAL_IMPORT_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.md',
  '.txt',
  '.prompt'
];

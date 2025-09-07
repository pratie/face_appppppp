# Repository Guidelines

## Project Structure & Module Organization
- Root: orchestration scripts in `package.json`.
- Client (React/TS): `client/src`, static assets in `client/public`.
- Server (Node/Express TS): `server/src`, compiled output in `server/dist`.
- Generated/data: `server/logs`, `server/runs`, media in `server/images` and `server/video`.
- Docs and assets: `docs/`, `images/`, `app_prd.md`.

## Build, Test, and Development Commands
- Dev (both): `npm run dev` — runs server and client concurrently.
- Install all: `npm run install:all` — installs root, `server`, and `client` deps.
- Client: `cd client && npm start` (dev), `npm run build` (production build).
- Server: `cd server && npm run dev` (watch via ts-node-dev), `npm run build` (tsc), `npm start` (run built `dist`).
- Production: `npm run build` (root) then `npm start`.

## Coding Style & Naming Conventions
- Language: TypeScript in `server`, React + TS in `client`.
- Indentation: 2 spaces; use semicolons; prefer `const`/`let`.
- Filenames: server services/utilities `camelCase.ts` (e.g., `videoGenerator.ts`); React components `PascalCase.tsx`.
- Linting/formatting: CRA ESLint is enabled in `client` (`react-app` config). Keep code Prettier-compatible; align with existing patterns.

## Testing Guidelines
- Client: Jest via CRA — run `cd client && npm test`.
- Server: Jest is configured; add tests as `*.test.ts` near sources (e.g., `server/src/services/videoGenerator.test.ts`). Run with `cd server && npm test`.
- Aim to cover core services (`openai`, `ideogram`, `kling`, `ffmpeg`) with unit tests; mock external APIs and filesystem.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (max ~72 chars). Example: `feat(server): add service health checks`.
- PRs: include summary, rationale, and scope; link issues; screenshots or logs for UI/flows; checklist that `npm run build` succeeds and tests pass.
- Keep PRs focused and small; update docs when behavior changes.

## Security & Configuration Tips
- Secrets: use `.env` and `server/.env` (see `.env.example`). Never commit real keys.
- Required services: API keys for OpenAI, Replicate (Kling), ElevenLabs, FAL; local `ffmpeg` must be available for video/audio processing.

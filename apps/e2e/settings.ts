/*
 * Where the UI tests run. Ports differ from `yarn dev` (3000 and 5173), so both can run at once, and the database is
 * a separate one that every run empties and seeds again: your development data is never touched.
 */

export const API_PORT = 3100;
export const WEB_PORT = 5174;

export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

/** The database from `yarn db:up`, under another name. Override with E2E_DATABASE_URL (its name must end in _e2e). */
export const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://studylog:studylog@localhost:5432/studylog_e2e';

/** Mailpit's web API (docker-compose.yml), where the emails the API sends end up. */
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

/** Every dummy user's password (see `yarn cli db:seed`). */
export const PASSWORD = 'password123';

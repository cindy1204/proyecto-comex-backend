/* Único punto de salida a consola de la API: el resto del código usa este logger. */
/* eslint-disable no-console */

export interface Logger {
  info(message: string): void;
  error(message: string, error?: unknown): void;
}

export const logger: Logger = {
  info: (message) => console.log(message),
  error: (message, error) => (error === undefined ? console.error(message) : console.error(message, error)),
};

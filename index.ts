/**
 * TOVYR - A fast, polished AI coding agent for your terminal
 * Main entry point
 */

export { default as TOVYR } from './cli/index';
export * from './types';
export * from './providers';
export * from './services';

// Version information
export const VERSION = '1.2.0';

// Main export
export default {
  version: VERSION,
  name: 'tovyrcode',
  description: 'A fast, polished AI coding agent for your terminal'
};
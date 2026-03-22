// Polyfill for jest-environment-jsdom (required by react-router-dom)
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

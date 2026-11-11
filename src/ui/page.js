// The page's fixed parts: #app (every page is drawn into it), #modal (the one dialog), and the 3D gym (#scene).
// The language and settings load first, because the gym and every page read them.
import { initLanguage } from '../i18n/index.js';
import { initSettings } from '../settings.js';
import { Arena } from '../arena.js';

export const $ = s => document.querySelector(s);
await initLanguage();
initSettings();
export const app = $('#app');
export const modal = $('#modal');
export const host = $('#scene');
export const arena = new Arena(host);

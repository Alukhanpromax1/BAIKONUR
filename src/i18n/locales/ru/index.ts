import type { MessageKey } from '../en';
import { common } from './common';
import { scenes1 } from './scenes1';
import { engine } from './engine';
import { ops } from './ops';
import { ready } from './ready';
import { debrief } from './debrief';
import { ai } from './ai';
import { data } from './data';

/**
 * Русский перевод. Тип Record<MessageKey, string> заставляет компилятор отвергнуть сборку,
 * если какой-либо ключ английского словаря не переведён или переведён под неверным именем.
 */
export const ru: Record<MessageKey, string> = {
  ...common,
  ...scenes1,
  ...engine,
  ...ops,
  ...ready,
  ...debrief,
  ...ai,
  ...data,
};

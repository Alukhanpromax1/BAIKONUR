import { Fragment, type ReactNode } from 'react';
import { t, useLangStore, type MessageKey, type Params } from './index';

type Renderers = Record<string, (children: ReactNode) => ReactNode>;

const TAG = /<(\w+)>(.*?)<\/\1>|<(\w+)\/>/gs;

/**
 * Rich-text translation: the whole sentence is one message, so word order can differ between
 * languages, and tags mark where components go.
 *   <T k="briefing.lead" tags={{ b: (c) => <b>{c}</b> }} />
 * <b> is available by default.
 */
export function T({ k, params, tags }: { k: MessageKey; params?: Params; tags?: Renderers }) {
  useLangStore((s) => s.lang);
  const text = t(k, params);
  const renderers: Renderers = { b: (c) => <b>{c}</b>, ...tags };
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const name = m[1] ?? m[3];
    const render = renderers[name];
    out.push(<Fragment key={i++}>{render ? render(m[2] ?? '') : (m[2] ?? '')}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

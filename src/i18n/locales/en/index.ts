import { app } from './app';
import { briefing } from './briefing';
import { budget } from './budget';
import { comp } from './comp';
import { crew } from './crew';
import { dash } from './dash';
import { debrief } from './debrief';
import { design } from './design';
import { fallback } from './fallback';
import { fmt } from './fmt';
import { intro } from './intro';
import { issue } from './issue';
import { launch } from './launch';
import { mass } from './mass';
import { mistake } from './mistake';
import { objective } from './objective';
import { ops } from './ops';
import { orbit } from './orbit';
import { panel } from './panel';
import { power } from './power';
import { ready } from './ready';
import { review } from './review';
import { science } from './science';
import { score } from './score';
import { source } from './source';
import { state } from './state';
import { tag } from './tag';
import { team } from './team';
import { term } from './term';
import { timeline } from './timeline';
import { top } from './top';
import { u } from './u';
import { vehicle } from './vehicle';
import { verdict } from './verdict';

/** English is the source language: its keys define what every other language must provide. */
export const en = {
  ...app,
  ...briefing,
  ...budget,
  ...comp,
  ...crew,
  ...dash,
  ...debrief,
  ...design,
  ...fallback,
  ...fmt,
  ...intro,
  ...issue,
  ...launch,
  ...mass,
  ...mistake,
  ...objective,
  ...ops,
  ...orbit,
  ...panel,
  ...power,
  ...ready,
  ...review,
  ...science,
  ...score,
  ...source,
  ...state,
  ...tag,
  ...team,
  ...term,
  ...timeline,
  ...top,
  ...u,
  ...vehicle,
  ...verdict,
};

export type MessageKey = keyof typeof en;

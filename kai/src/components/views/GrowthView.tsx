/* GROWTH view (§13.1 route-split chunk). InstagramPanel (charts) stays
   lazy inside so the recharts/d3 chunk only loads with this view. */
import { lazy, Suspense } from 'react';
import GartenCodexPanel from '../panels/GartenCodexPanel';
import LektionPanel from '../panels/LektionPanel';
import CrownPanel from '../panels/CrownPanel';
import ContentQueuePanel from '../panels/ContentQueuePanel';
import IgFeedPanel from '../panels/IgFeedPanel';
import ScribePanel from '../panels/ScribePanel';

const InstagramPanel = lazy(() => import('../panels/InstagramPanel'));

export default function GrowthView() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <GartenCodexPanel />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
        <LektionPanel delay={0.08} />
        <CrownPanel delay={0.10} />
        <ContentQueuePanel delay={0.15} />
        <Suspense fallback={<div className="glass rounded-lg p-5 text-steel font-mono text-xs">loading charts…</div>}>
          <InstagramPanel delay={0.20} />
        </Suspense>
        <IgFeedPanel delay={0.25} />
        <ScribePanel delay={0.30} />
      </div>
    </div>
  );
}

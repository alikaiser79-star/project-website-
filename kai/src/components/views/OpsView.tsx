/* OPERATIONS view (§13.1 route-split chunk). */
import DeadlinesPanel from '../panels/DeadlinesPanel';
import MissionPanel from '../panels/MissionPanel';
import LeadsPanel from '../panels/LeadsPanel';
import GardenPanel from '../panels/GardenPanel';
import MakadiPanel from '../panels/MakadiPanel';
import LedgerPanel from '../panels/LedgerPanel';
import PrioritiesPanel from '../panels/PrioritiesPanel';
import { MirrorPanel } from '../../lib/kai/mirror';

export default function OpsView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
      <DeadlinesPanel delay={0.05} />
      <MissionPanel delay={0.06} />
      <LeadsPanel delay={0.08} />
      <GardenPanel delay={0.10} />
      <MakadiPanel delay={0.15} />
      <LedgerPanel delay={0.20} />
      <MirrorPanel delay={0.25} />
      <PrioritiesPanel delay={0.30} />
    </div>
  );
}

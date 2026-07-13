/* COMMS view (§13.1 route-split chunk). */
import AutopilotPanel from '../panels/AutopilotPanel';
import InboxPanel from '../panels/InboxPanel';
import SitePanel from '../panels/SitePanel';
import WatchtowerPanel from '../panels/WatchtowerPanel';
import EnvoyPanel from '../panels/EnvoyPanel';
import FeldzugPanel from '../panels/FeldzugPanel';
import DelegatePanel from '../panels/DelegatePanel';
import VaultPanel from '../panels/VaultPanel';

export default function CommsView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
      <AutopilotPanel delay={0.10} />
      <InboxPanel delay={0.15} />
      <SitePanel delay={0.25} />
      <WatchtowerPanel delay={0.30} />
      <EnvoyPanel delay={0.35} />
      <FeldzugPanel delay={0.38} />
      <DelegatePanel delay={0.40} />
      <VaultPanel delay={0.45} />
    </div>
  );
}

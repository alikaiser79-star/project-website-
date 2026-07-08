/* MONEY view (§13.1 route-split chunk). */
import EscapeVelocityPanel from '../panels/EscapeVelocityPanel';
import AnalystPanel from '../panels/AnalystPanel';
import TollgatePanel from '../panels/TollgatePanel';
import IncomePanel from '../panels/IncomePanel';
import DebtPanel from '../panels/DebtPanel';
import ExpensesPanel from '../panels/ExpensesPanel';
import LedgerOfWinsPanel from '../panels/LedgerOfWinsPanel';

export default function MoneyView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
      <EscapeVelocityPanel delay={0.06} />
      <AnalystPanel delay={0.08} />
      <TollgatePanel delay={0.10} />
      <IncomePanel delay={0.15} />
      <DebtPanel delay={0.20} />
      <ExpensesPanel delay={0.25} />
      <LedgerOfWinsPanel />
    </div>
  );
}

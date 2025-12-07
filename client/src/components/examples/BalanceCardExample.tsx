import { BalanceCard } from "../client/BalanceCard";

export default function BalanceCardExample() {
  return (
    <BalanceCard 
      available={12.40} 
      pending={2.00}
      pendingUnlockDays={5}
    />
  );
}

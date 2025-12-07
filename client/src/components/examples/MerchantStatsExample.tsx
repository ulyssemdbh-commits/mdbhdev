import { MerchantStats } from "../merchant/MerchantStats";

export default function MerchantStatsExample() {
  return (
    <MerchantStats
      weeklyTransactions={47}
      weeklySales={1250.80}
      weeklyCommission={162.60}
      totalClients={32}
    />
  );
}

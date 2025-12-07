import { AdminStats } from "../admin/AdminStats";

export default function AdminStatsExample() {
  return (
    <AdminStats
      totalTransactions={1847}
      totalMerchants={24}
      totalClients={892}
      totalCommissions={8450.30}
      transactionGrowth={12}
      merchantGrowth={8}
    />
  );
}

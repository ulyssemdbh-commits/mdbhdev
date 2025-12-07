import { TransactionList, type Transaction } from "../client/TransactionList";

const mockTransactions: Transaction[] = [
  { id: "1", merchantName: "Boulangerie Antoine", amount: 2.0, status: "pending", date: "Aujourd'hui, 10:32" },
  { id: "2", merchantName: "Café Marcel", amount: 3.0, status: "used", date: "Hier, 14:15" },
  { id: "3", merchantName: "Supermarché Bio", amount: 5.4, status: "earned", date: "5 déc., 18:45" },
  { id: "4", merchantName: "Pharmacie Centrale", amount: 1.2, status: "earned", date: "3 déc., 09:20" },
];

export default function TransactionListExample() {
  return <TransactionList transactions={mockTransactions} />;
}

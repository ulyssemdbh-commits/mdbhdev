import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("client"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const merchants = pgTable("merchants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  imageUrl: text("image_url"),
  cashbackRate: decimal("cashback_rate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  phone: text("phone"),
  email: text("email"),
  siret: text("siret"),
  contactName: text("contact_name"),
  bankIban: text("bank_iban"),
  bankBic: text("bank_bic"),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  merchantId: varchar("merchant_id").references(() => merchants.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  cashbackAmount: decimal("cashback_amount", { precision: 10, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
});

export const cashbackBalances = pgTable("cashback_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  merchantId: varchar("merchant_id").references(() => merchants.id).notNull(),
  availableBalance: decimal("available_balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  pendingBalance: decimal("pending_balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
});

export const cashbackEntries = pgTable("cashback_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").references(() => transactions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  merchantId: varchar("merchant_id").references(() => merchants.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  unlocksAt: timestamp("unlocks_at").notNull(),
  unlockedAt: timestamp("unlocked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cashbackTransfers = pgTable("cashback_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id).notNull(),
  merchantId: varchar("merchant_id").references(() => merchants.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const upsertUserSchema = createInsertSchema(users);

export type UpsertUser = typeof users.$inferInsert;

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  cancelledAt: true,
});

export const insertCashbackBalanceSchema = createInsertSchema(cashbackBalances).omit({
  id: true,
});

export const insertCashbackEntrySchema = createInsertSchema(cashbackEntries).omit({
  id: true,
  unlockedAt: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;

export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchants.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertCashbackBalance = z.infer<typeof insertCashbackBalanceSchema>;
export type CashbackBalance = typeof cashbackBalances.$inferSelect;

export type InsertCashbackEntry = z.infer<typeof insertCashbackEntrySchema>;
export type CashbackEntry = typeof cashbackEntries.$inferSelect;

export const insertCashbackTransferSchema = createInsertSchema(cashbackTransfers).omit({
  id: true,
  createdAt: true,
});

export type InsertCashbackTransfer = z.infer<typeof insertCashbackTransferSchema>;
export type CashbackTransfer = typeof cashbackTransfers.$inferSelect;

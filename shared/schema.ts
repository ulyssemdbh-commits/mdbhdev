import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Generate unique REV ID: REVid- + 6 alphanumeric characters
export function generateRevId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REVid-${code}`;
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  revId: varchar("rev_id", { length: 12 }).unique(),
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
}, (table) => [
  uniqueIndex("cashback_balances_user_merchant_idx").on(table.userId, table.merchantId),
]);

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

export const merchantCategories = pgTable("merchant_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: decimal("display_order", { precision: 5, scale: 0 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Merchant billing periods - bills generated on 15th and 30th of each month
export const merchantBillings = pgTable("merchant_billings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").references(() => merchants.id).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).default("0.00").notNull(),
  cashbackAmount: decimal("cashback_amount", { precision: 10, scale: 2 }).default("0.00").notNull(), // 10%
  revFeeAmount: decimal("rev_fee_amount", { precision: 10, scale: 2 }).default("0.00").notNull(), // 3%
  tvaAmount: decimal("tva_amount", { precision: 10, scale: 2 }).default("0.00").notNull(), // 20% of rev fee
  totalBilled: decimal("total_billed", { precision: 10, scale: 2 }).default("0.00").notNull(), // total 13%
  status: text("status").notNull().default("pending"), // pending, paid, overdue
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("merchant_billings_merchant_period_idx").on(table.merchantId, table.periodStart, table.periodEnd),
]);

// Notifications for users
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // transfer_sent, transfer_received, cashback_earned, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const insertMerchantCategorySchema = createInsertSchema(merchantCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertMerchantCategory = z.infer<typeof insertMerchantCategorySchema>;
export type MerchantCategory = typeof merchantCategories.$inferSelect;

export const insertMerchantBillingSchema = createInsertSchema(merchantBillings).omit({
  id: true,
  createdAt: true,
  paidAt: true,
});

export type InsertMerchantBilling = z.infer<typeof insertMerchantBillingSchema>;
export type MerchantBilling = typeof merchantBillings.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Bons Plans - Merchant promotions/offers
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").references(() => merchants.id).notNull(),
  type: text("type").notNull(), // cashback_boost, free_article, discount_percent
  title: text("title").notNull(),
  description: text("description"),
  // For cashback_boost: the boosted rate (e.g., 15% instead of 10%)
  cashbackBoostRate: decimal("cashback_boost_rate", { precision: 5, scale: 2 }),
  // For free_article: name of the free item
  freeArticle: text("free_article"),
  // For discount_percent: the discount percentage
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  createdAt: true,
});

export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;

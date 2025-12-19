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
  dateOfBirth: timestamp("date_of_birth"),
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
  promotionCharges: decimal("promotion_charges", { precision: 10, scale: 2 }).default("0.00").notNull(), // 19€/week per active promotion
  promotionWeeks: decimal("promotion_weeks", { precision: 5, scale: 0 }).default("0").notNull(), // Number of promotion-weeks billed
  totalBilled: decimal("total_billed", { precision: 10, scale: 2 }).default("0.00").notNull(), // total including promotions
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

// Gift Cards - REV gift cards with 15% cashback
export const giftCards = pgTable("gift_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }).notNull(), // Card value (e.g., 50€, 100€)
  cashbackRate: decimal("cashback_rate", { precision: 5, scale: 2 }).default("15.00").notNull(), // 15% cashback
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Gift Card Purchases - When a user buys a gift card
export const giftCardPurchases = pgTable("gift_card_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").references(() => users.id).notNull(),
  giftCardId: varchar("gift_card_id").references(() => giftCards.id).notNull(),
  purchaseAmount: decimal("purchase_amount", { precision: 10, scale: 2 }).notNull(), // Face value paid
  cashbackAmount: decimal("cashback_amount", { precision: 10, scale: 2 }).notNull(), // 15% of face value
  status: text("status").notNull().default("active"), // active, used, cancelled, transferred
  createdAt: timestamp("created_at").defaultNow().notNull(),
  unlocksAt: timestamp("unlocks_at").notNull(), // 7 business days after purchase
});

// Gift Card Balances - Current ownership of gift cards
export const giftCardBalances = pgTable("gift_card_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  giftCardId: varchar("gift_card_id").references(() => giftCards.id).notNull(),
  purchaseId: varchar("purchase_id").references(() => giftCardPurchases.id).notNull(),
  remainingValue: decimal("remaining_value", { precision: 10, scale: 2 }).notNull(), // Remaining usable value
  status: text("status").notNull().default("active"), // active, used, expired
  receivedFromUserId: varchar("received_from_user_id").references(() => users.id), // If received as gift
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Gift Card Transfers - When a user gifts a card to another user
export const giftCardTransfers = pgTable("gift_card_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  balanceId: varchar("balance_id").references(() => giftCardBalances.id).notNull(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("completed"), // completed, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGiftCardSchema = createInsertSchema(giftCards).omit({
  id: true,
  createdAt: true,
});

export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;
export type GiftCard = typeof giftCards.$inferSelect;

export const insertGiftCardPurchaseSchema = createInsertSchema(giftCardPurchases).omit({
  id: true,
  createdAt: true,
});

export type InsertGiftCardPurchase = z.infer<typeof insertGiftCardPurchaseSchema>;
export type GiftCardPurchase = typeof giftCardPurchases.$inferSelect;

export const insertGiftCardBalanceSchema = createInsertSchema(giftCardBalances).omit({
  id: true,
  createdAt: true,
});

export type InsertGiftCardBalance = z.infer<typeof insertGiftCardBalanceSchema>;
export type GiftCardBalance = typeof giftCardBalances.$inferSelect;

export const insertGiftCardTransferSchema = createInsertSchema(giftCardTransfers).omit({
  id: true,
  createdAt: true,
});

export type InsertGiftCardTransfer = z.infer<typeof insertGiftCardTransferSchema>;
export type GiftCardTransfer = typeof giftCardTransfers.$inferSelect;

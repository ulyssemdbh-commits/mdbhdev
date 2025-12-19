import {
  users,
  merchants,
  transactions,
  cashbackBalances,
  cashbackEntries,
  cashbackTransfers,
  merchantCategories,
  merchantBillings,
  notifications,
  promotions,
  charities,
  cashbackDonations,
  giftCards,
  giftCardPurchases,
  giftCardBalances,
  giftCardTransfers,
  generateRevId,
  type User,
  type UpsertUser,
  type Merchant,
  type InsertMerchant,
  type Transaction,
  type InsertTransaction,
  type CashbackBalance,
  type InsertCashbackBalance,
  type CashbackEntry,
  type InsertCashbackEntry,
  type CashbackTransfer,
  type InsertCashbackTransfer,
  type MerchantCategory,
  type InsertMerchantCategory,
  type MerchantBilling,
  type InsertMerchantBilling,
  type Notification,
  type InsertNotification,
  type Promotion,
  type InsertPromotion,
  type Charity,
  type InsertCharity,
  type CashbackDonation,
  type InsertCashbackDonation,
  type GiftCard,
  type InsertGiftCard,
  type GiftCardPurchase,
  type InsertGiftCardPurchase,
  type GiftCardBalance,
  type InsertGiftCardBalance,
  type GiftCardTransfer,
  type InsertGiftCardTransfer,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByRevId(revId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  
  // Merchant operations
  getMerchant(id: string): Promise<Merchant | undefined>;
  getMerchantByUserId(userId: string): Promise<Merchant | undefined>;
  getMerchants(): Promise<Merchant[]>;
  getMerchantsByCategory(category: string): Promise<Merchant[]>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;
  updateMerchant(id: string, merchant: Partial<InsertMerchant>): Promise<Merchant | undefined>;
  deleteMerchant(id: string): Promise<boolean>;
  
  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByMerchant(merchantId: string): Promise<Transaction[]>;
  getTransactionsByClient(clientId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  cancelTransaction(id: string): Promise<Transaction | undefined>;
  
  // Cashback balance operations
  getCashbackBalance(userId: string, merchantId: string): Promise<CashbackBalance | undefined>;
  getCashbackBalancesByUser(userId: string): Promise<CashbackBalance[]>;
  upsertCashbackBalance(balance: InsertCashbackBalance): Promise<CashbackBalance>;
  
  // Cashback entry operations
  getCashbackEntry(id: string): Promise<CashbackEntry | undefined>;
  getCashbackEntriesByUser(userId: string): Promise<CashbackEntry[]>;
  getPendingCashbackEntries(): Promise<CashbackEntry[]>;
  createCashbackEntry(entry: InsertCashbackEntry): Promise<CashbackEntry>;
  unlockCashbackEntry(id: string): Promise<CashbackEntry | undefined>;
  
  // Cashback transfer operations
  createCashbackTransfer(transfer: InsertCashbackTransfer): Promise<CashbackTransfer>;
  getCashbackTransfersByUser(userId: string): Promise<CashbackTransfer[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // Admin operations
  getAdminStats(): Promise<{
    totalTransactions: number;
    totalMerchants: number;
    totalClients: number;
    totalCommissions: number;
    totalSales: number;
  }>;
  getAllTransactions(): Promise<Transaction[]>;
  getAllMerchantsWithStats(): Promise<any[]>;
  getAllMerchantsForAdmin(): Promise<Merchant[]>;
  getAllClients(): Promise<User[]>;
  getAllMerchantUsers(): Promise<User[]>;
  
  // Admin CRUD operations
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  adminCancelTransaction(id: string): Promise<Transaction | undefined>;
  
  // Merchant category operations
  getCategories(): Promise<MerchantCategory[]>;
  getActiveCategories(): Promise<MerchantCategory[]>;
  getCategory(id: string): Promise<MerchantCategory | undefined>;
  createCategory(category: InsertMerchantCategory): Promise<MerchantCategory>;
  updateCategory(id: string, data: Partial<InsertMerchantCategory>): Promise<MerchantCategory | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  // Merchant billing operations
  getAllBillings(): Promise<MerchantBilling[]>;
  getBillingsByMerchant(merchantId: string): Promise<MerchantBilling[]>;
  getBilling(id: string): Promise<MerchantBilling | undefined>;
  createBilling(billing: InsertMerchantBilling): Promise<MerchantBilling>;
  updateBillingStatus(id: string, status: string, paidAt?: Date): Promise<MerchantBilling | undefined>;
  getTransactionsForPeriod(merchantId: string, periodStart: Date, periodEnd: Date): Promise<Transaction[]>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Promotion operations (Bons Plans)
  getPromotion(id: string): Promise<Promotion | undefined>;
  getPromotionsByMerchant(merchantId: string): Promise<Promotion[]>;
  getActivePromotions(): Promise<Promotion[]>;
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;
  deletePromotion(id: string): Promise<boolean>;
  getPromotionWeeksForPeriod(merchantId: string, periodStart: Date, periodEnd: Date): Promise<number>;
  
  // Charity operations
  getCharities(): Promise<Charity[]>;
  getActiveCharities(): Promise<Charity[]>;
  getCharity(id: string): Promise<Charity | undefined>;
  createCharity(charity: InsertCharity): Promise<Charity>;
  updateCharity(id: string, data: Partial<InsertCharity>): Promise<Charity | undefined>;
  deleteCharity(id: string): Promise<boolean>;
  
  // Cashback donation operations
  createCashbackDonation(donation: InsertCashbackDonation): Promise<CashbackDonation>;
  getDonationsByUser(userId: string): Promise<CashbackDonation[]>;
  getDonationsByCharity(charityId: string): Promise<CashbackDonation[]>;
  getTotalDonationsByCharity(charityId: string): Promise<number>;
  
  // Atomic donation with balance deduction
  processCashbackDonation(
    userId: string,
    charityId: string,
    merchantId: string,
    amount: string,
    charityName: string
  ): Promise<{ donation: CashbackDonation; notification: Notification }>;
  
  // Gift Card operations
  getGiftCards(): Promise<GiftCard[]>;
  getActiveGiftCards(): Promise<GiftCard[]>;
  getGiftCard(id: string): Promise<GiftCard | undefined>;
  createGiftCard(giftCard: InsertGiftCard): Promise<GiftCard>;
  updateGiftCard(id: string, data: Partial<InsertGiftCard>): Promise<GiftCard | undefined>;
  deleteGiftCard(id: string): Promise<boolean>;
  
  // Gift Card Purchase operations
  createGiftCardPurchase(purchase: InsertGiftCardPurchase): Promise<GiftCardPurchase>;
  getGiftCardPurchasesByUser(userId: string): Promise<GiftCardPurchase[]>;
  getGiftCardPurchase(id: string): Promise<GiftCardPurchase | undefined>;
  
  // Gift Card Balance operations
  createGiftCardBalance(balance: InsertGiftCardBalance): Promise<GiftCardBalance>;
  getGiftCardBalancesByUser(userId: string): Promise<GiftCardBalance[]>;
  getGiftCardBalance(id: string): Promise<GiftCardBalance | undefined>;
  updateGiftCardBalance(id: string, data: Partial<InsertGiftCardBalance>): Promise<GiftCardBalance | undefined>;
  
  // Gift Card Transfer operations
  createGiftCardTransfer(transfer: InsertGiftCardTransfer): Promise<GiftCardTransfer>;
  getGiftCardTransfersByUser(userId: string): Promise<GiftCardTransfer[]>;
  
  // Atomic gift card purchase with balance creation
  purchaseGiftCard(
    buyerId: string,
    giftCardId: string,
    faceValue: string,
    cashbackRate: string
  ): Promise<{ purchase: GiftCardPurchase; balance: GiftCardBalance; notification: Notification }>;
  
  // Atomic gift card transfer to another user
  transferGiftCard(
    fromUserId: string,
    toRevId: string,
    balanceId: string
  ): Promise<{ transfer: GiftCardTransfer; newBalance: GiftCardBalance; notifications: Notification[] }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByRevId(revId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`${users.revId} = ${revId}`);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user exists to determine if we need to generate a revId
    const existingUser = userData.id ? await this.getUser(userData.id) : undefined;
    
    // Generate a unique REVid if needed
    let revId = existingUser?.revId;
    if (!revId) {
      // Keep generating until we find a unique one
      let attempts = 0;
      do {
        revId = generateRevId();
        const existing = await this.getUserByRevId(revId);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);
    }
    
    const dataWithRevId = {
      ...userData,
      revId,
    };
    
    const [user] = await db
      .insert(users)
      .values(dataWithRevId)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Merchant operations
  async getMerchant(id: string): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id));
    return merchant;
  }

  async getMerchantByUserId(userId: string): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.userId, userId));
    return merchant;
  }

  async getMerchants(): Promise<Merchant[]> {
    return db.select().from(merchants).where(eq(merchants.isActive, true));
  }

  async getMerchantsByCategory(category: string): Promise<Merchant[]> {
    return db.select().from(merchants).where(
      and(eq(merchants.category, category), eq(merchants.isActive, true))
    );
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const [created] = await db.insert(merchants).values(merchant).returning();
    return created;
  }

  async updateMerchant(id: string, merchant: Partial<InsertMerchant>): Promise<Merchant | undefined> {
    const [updated] = await db
      .update(merchants)
      .set(merchant)
      .where(eq(merchants.id, id))
      .returning();
    return updated;
  }

  async deleteMerchant(id: string): Promise<boolean> {
    const result = await db
      .delete(merchants)
      .where(eq(merchants.id, id));
    return true;
  }

  // Transaction operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async getTransactionsByMerchant(merchantId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.merchantId, merchantId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByClient(clientId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.clientId, clientId))
      .orderBy(desc(transactions.createdAt));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async cancelTransaction(id: string): Promise<Transaction | undefined> {
    const [cancelled] = await db
      .update(transactions)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return cancelled;
  }

  // Cashback balance operations
  async getCashbackBalance(userId: string, merchantId: string): Promise<CashbackBalance | undefined> {
    const [balance] = await db
      .select()
      .from(cashbackBalances)
      .where(and(eq(cashbackBalances.userId, userId), eq(cashbackBalances.merchantId, merchantId)));
    return balance;
  }

  async getCashbackBalancesByUser(userId: string): Promise<CashbackBalance[]> {
    return db.select().from(cashbackBalances).where(eq(cashbackBalances.userId, userId));
  }

  async upsertCashbackBalance(balance: InsertCashbackBalance): Promise<CashbackBalance> {
    const existing = await this.getCashbackBalance(balance.userId, balance.merchantId);
    
    if (existing) {
      const [updated] = await db
        .update(cashbackBalances)
        .set({
          availableBalance: balance.availableBalance,
          pendingBalance: balance.pendingBalance,
        })
        .where(eq(cashbackBalances.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(cashbackBalances).values(balance).returning();
    return created;
  }

  // Cashback entry operations
  async getCashbackEntry(id: string): Promise<CashbackEntry | undefined> {
    const [entry] = await db.select().from(cashbackEntries).where(eq(cashbackEntries.id, id));
    return entry;
  }

  async getCashbackEntriesByUser(userId: string): Promise<CashbackEntry[]> {
    return db
      .select()
      .from(cashbackEntries)
      .where(eq(cashbackEntries.userId, userId))
      .orderBy(desc(cashbackEntries.createdAt));
  }

  async getPendingCashbackEntries(): Promise<CashbackEntry[]> {
    return db
      .select()
      .from(cashbackEntries)
      .where(and(
        eq(cashbackEntries.status, "pending"),
        sql`${cashbackEntries.unlocksAt} <= NOW()`
      ));
  }

  async createCashbackEntry(entry: InsertCashbackEntry): Promise<CashbackEntry> {
    const [created] = await db.insert(cashbackEntries).values(entry).returning();
    return created;
  }

  async unlockCashbackEntry(id: string): Promise<CashbackEntry | undefined> {
    const [unlocked] = await db
      .update(cashbackEntries)
      .set({ status: "available", unlockedAt: new Date() })
      .where(eq(cashbackEntries.id, id))
      .returning();
    return unlocked;
  }

  // Cashback transfer operations
  async createCashbackTransfer(transfer: InsertCashbackTransfer): Promise<CashbackTransfer> {
    const [created] = await db.insert(cashbackTransfers).values(transfer).returning();
    return created;
  }

  async getCashbackTransfersByUser(userId: string): Promise<CashbackTransfer[]> {
    return db
      .select()
      .from(cashbackTransfers)
      .where(
        sql`${cashbackTransfers.fromUserId} = ${userId} OR ${cashbackTransfers.toUserId} = ${userId}`
      )
      .orderBy(desc(cashbackTransfers.createdAt));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  // Admin operations
  async getAdminStats(): Promise<{
    totalTransactions: number;
    totalMerchants: number;
    totalClients: number;
    totalCommissions: number;
    totalSales: number;
  }> {
    const allTxs = await db.select().from(transactions);
    const allMerchants = await db.select().from(merchants).where(eq(merchants.isActive, true));
    const allUsers = await db.select().from(users).where(eq(users.role, "client"));

    const completedTxs = allTxs.filter(tx => tx.status === "completed");
    const totalSales = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const totalCommissions = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.commissionAmount), 0);

    return {
      totalTransactions: allTxs.length,
      totalMerchants: allMerchants.length,
      totalClients: allUsers.length,
      totalCommissions,
      totalSales,
    };
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getAllMerchantsWithStats(): Promise<any[]> {
    const allMerchants = await db.select().from(merchants);
    const allTxs = await db.select().from(transactions);

    return allMerchants.map(m => {
      const merchantTxs = allTxs.filter(tx => tx.merchantId === m.id && tx.status === "completed");
      const totalSales = merchantTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      return {
        ...m,
        totalSales,
        transactionCount: merchantTxs.length,
      };
    });
  }

  async getAllMerchantsForAdmin(): Promise<Merchant[]> {
    return db.select().from(merchants).orderBy(desc(merchants.createdAt));
  }

  async getAllClients(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "client")).orderBy(desc(users.createdAt));
  }

  async getAllMerchantUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "merchant")).orderBy(desc(users.createdAt));
  }

  // Admin CRUD operations
  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Soft-delete by changing role to "archived" to preserve referential integrity
    const [archived] = await db
      .update(users)
      .set({ role: "archived", updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return !!archived;
  }

  async adminCancelTransaction(id: string): Promise<Transaction | undefined> {
    const [cancelled] = await db
      .update(transactions)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return cancelled;
  }

  // Merchant category operations
  async getCategories(): Promise<MerchantCategory[]> {
    return db.select().from(merchantCategories).orderBy(merchantCategories.displayOrder);
  }

  async getActiveCategories(): Promise<MerchantCategory[]> {
    return db.select().from(merchantCategories)
      .where(eq(merchantCategories.isActive, true))
      .orderBy(merchantCategories.displayOrder);
  }

  async getCategory(id: string): Promise<MerchantCategory | undefined> {
    const [category] = await db.select().from(merchantCategories).where(eq(merchantCategories.id, id));
    return category;
  }

  async createCategory(category: InsertMerchantCategory): Promise<MerchantCategory> {
    const [created] = await db.insert(merchantCategories).values(category).returning();
    return created;
  }

  async updateCategory(id: string, data: Partial<InsertMerchantCategory>): Promise<MerchantCategory | undefined> {
    const [updated] = await db
      .update(merchantCategories)
      .set(data)
      .where(eq(merchantCategories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const [deleted] = await db
      .delete(merchantCategories)
      .where(eq(merchantCategories.id, id))
      .returning();
    return !!deleted;
  }

  // Merchant billing operations
  async getAllBillings(): Promise<MerchantBilling[]> {
    return db.select().from(merchantBillings).orderBy(desc(merchantBillings.createdAt));
  }

  async getBillingsByMerchant(merchantId: string): Promise<MerchantBilling[]> {
    return db.select().from(merchantBillings)
      .where(eq(merchantBillings.merchantId, merchantId))
      .orderBy(desc(merchantBillings.createdAt));
  }

  async getBilling(id: string): Promise<MerchantBilling | undefined> {
    const [billing] = await db.select().from(merchantBillings).where(eq(merchantBillings.id, id));
    return billing;
  }

  async createBilling(billing: InsertMerchantBilling): Promise<MerchantBilling> {
    const [created] = await db.insert(merchantBillings).values(billing).returning();
    return created;
  }

  async updateBillingStatus(id: string, status: string, paidAt?: Date): Promise<MerchantBilling | undefined> {
    const updateData: any = { status };
    if (paidAt) {
      updateData.paidAt = paidAt;
    }
    const [updated] = await db
      .update(merchantBillings)
      .set(updateData)
      .where(eq(merchantBillings.id, id))
      .returning();
    return updated;
  }

  async getTransactionsForPeriod(merchantId: string, periodStart: Date, periodEnd: Date): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(and(
        eq(transactions.merchantId, merchantId),
        eq(transactions.status, "completed"),
        gte(transactions.createdAt, periodStart),
        sql`${transactions.createdAt} <= ${periodEnd}`
      ))
      .orderBy(desc(transactions.createdAt));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  }

  // Promotion operations (Bons Plans)
  async getPromotion(id: string): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion;
  }

  async getPromotionsByMerchant(merchantId: string): Promise<Promotion[]> {
    return db.select().from(promotions)
      .where(eq(promotions.merchantId, merchantId))
      .orderBy(desc(promotions.createdAt));
  }

  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date();
    return db.select().from(promotions)
      .where(and(
        eq(promotions.isActive, true),
        sql`${promotions.startDate} <= ${now}`,
        sql`${promotions.endDate} >= ${now}`
      ))
      .orderBy(desc(promotions.createdAt));
  }

  async getAllPromotions(): Promise<Promotion[]> {
    return db.select().from(promotions).orderBy(desc(promotions.createdAt));
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [created] = await db.insert(promotions).values(promotion).returning();
    return created;
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db
      .update(promotions)
      .set(data)
      .where(eq(promotions.id, id))
      .returning();
    return updated;
  }

  async deletePromotion(id: string): Promise<boolean> {
    const result = await db.delete(promotions).where(eq(promotions.id, id));
    return true;
  }

  async getPromotionWeeksForPeriod(merchantId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    const merchantPromos = await db.select().from(promotions)
      .where(and(
        eq(promotions.merchantId, merchantId),
        eq(promotions.isActive, true),
        sql`${promotions.startDate} <= ${periodEnd}`,
        sql`${promotions.endDate} >= ${periodStart}`
      ));
    
    let totalWeeks = 0;
    const periodStartTime = periodStart.getTime();
    const periodEndTime = periodEnd.getTime();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    
    for (const promo of merchantPromos) {
      const promoStart = new Date(promo.startDate).getTime();
      const promoEnd = new Date(promo.endDate).getTime();
      
      const overlapStart = Math.max(periodStartTime, promoStart);
      const overlapEnd = Math.min(periodEndTime, promoEnd);
      
      if (overlapEnd > overlapStart) {
        const overlapMs = overlapEnd - overlapStart;
        const weeks = Math.ceil(overlapMs / msPerWeek);
        totalWeeks += weeks;
      }
    }
    
    return totalWeeks;
  }

  // Charity operations
  async getCharities(): Promise<Charity[]> {
    return db.select().from(charities).orderBy(charities.name);
  }

  async getActiveCharities(): Promise<Charity[]> {
    return db.select().from(charities)
      .where(eq(charities.isActive, true))
      .orderBy(charities.name);
  }

  async getCharity(id: string): Promise<Charity | undefined> {
    const [charity] = await db.select().from(charities).where(eq(charities.id, id));
    return charity;
  }

  async createCharity(charity: InsertCharity): Promise<Charity> {
    const [created] = await db.insert(charities).values(charity).returning();
    return created;
  }

  async updateCharity(id: string, data: Partial<InsertCharity>): Promise<Charity | undefined> {
    const [updated] = await db
      .update(charities)
      .set(data)
      .where(eq(charities.id, id))
      .returning();
    return updated;
  }

  async deleteCharity(id: string): Promise<boolean> {
    await db.delete(charities).where(eq(charities.id, id));
    return true;
  }

  // Cashback donation operations
  async createCashbackDonation(donation: InsertCashbackDonation): Promise<CashbackDonation> {
    const [created] = await db.insert(cashbackDonations).values(donation).returning();
    return created;
  }

  async getDonationsByUser(userId: string): Promise<CashbackDonation[]> {
    return db.select().from(cashbackDonations)
      .where(eq(cashbackDonations.userId, userId))
      .orderBy(desc(cashbackDonations.createdAt));
  }

  async getDonationsByCharity(charityId: string): Promise<CashbackDonation[]> {
    return db.select().from(cashbackDonations)
      .where(eq(cashbackDonations.charityId, charityId))
      .orderBy(desc(cashbackDonations.createdAt));
  }

  async getTotalDonationsByCharity(charityId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${cashbackDonations.amount}), 0)` })
      .from(cashbackDonations)
      .where(and(
        eq(cashbackDonations.charityId, charityId),
        eq(cashbackDonations.status, "completed")
      ));
    return Number(result[0]?.total || 0);
  }

  async processCashbackDonation(
    userId: string,
    charityId: string,
    merchantId: string,
    amount: string,
    charityName: string
  ): Promise<{ donation: CashbackDonation; notification: Notification }> {
    const donationAmount = parseFloat(amount);
    
    return await db.transaction(async (tx) => {
      const [balance] = await tx
        .select()
        .from(cashbackBalances)
        .where(and(
          eq(cashbackBalances.userId, userId),
          eq(cashbackBalances.merchantId, merchantId)
        ))
        .for("update");
      
      if (!balance || parseFloat(balance.availableBalance) < donationAmount) {
        throw new Error("Insufficient cashback balance");
      }
      
      const newBalance = parseFloat(balance.availableBalance) - donationAmount;
      
      await tx
        .update(cashbackBalances)
        .set({ availableBalance: newBalance.toFixed(2) })
        .where(eq(cashbackBalances.id, balance.id));
      
      const [donation] = await tx
        .insert(cashbackDonations)
        .values({
          userId,
          charityId,
          merchantId,
          amount: donationAmount.toFixed(2),
          status: "completed",
        })
        .returning();
      
      const [notification] = await tx
        .insert(notifications)
        .values({
          userId,
          type: "donation_made",
          title: "Don effectué",
          message: `Vous avez donné ${donationAmount.toFixed(2)}€ à ${charityName}`,
          isRead: false,
          metadata: JSON.stringify({ charityId, donationId: donation.id }),
        })
        .returning();
      
      return { donation, notification };
    });
  }

  // Gift Card operations
  async getGiftCards(): Promise<GiftCard[]> {
    return db.select().from(giftCards).orderBy(desc(giftCards.createdAt));
  }

  async getActiveGiftCards(): Promise<GiftCard[]> {
    return db.select().from(giftCards).where(eq(giftCards.isActive, true)).orderBy(desc(giftCards.createdAt));
  }

  async getGiftCard(id: string): Promise<GiftCard | undefined> {
    const [giftCard] = await db.select().from(giftCards).where(eq(giftCards.id, id));
    return giftCard;
  }

  async createGiftCard(giftCard: InsertGiftCard): Promise<GiftCard> {
    const [created] = await db.insert(giftCards).values(giftCard).returning();
    return created;
  }

  async updateGiftCard(id: string, data: Partial<InsertGiftCard>): Promise<GiftCard | undefined> {
    const [updated] = await db.update(giftCards).set(data).where(eq(giftCards.id, id)).returning();
    return updated;
  }

  async deleteGiftCard(id: string): Promise<boolean> {
    await db.delete(giftCards).where(eq(giftCards.id, id));
    return true;
  }

  // Gift Card Purchase operations
  async createGiftCardPurchase(purchase: InsertGiftCardPurchase): Promise<GiftCardPurchase> {
    const [created] = await db.insert(giftCardPurchases).values(purchase).returning();
    return created;
  }

  async getGiftCardPurchasesByUser(userId: string): Promise<GiftCardPurchase[]> {
    return db.select().from(giftCardPurchases).where(eq(giftCardPurchases.buyerId, userId)).orderBy(desc(giftCardPurchases.createdAt));
  }

  async getGiftCardPurchase(id: string): Promise<GiftCardPurchase | undefined> {
    const [purchase] = await db.select().from(giftCardPurchases).where(eq(giftCardPurchases.id, id));
    return purchase;
  }

  // Gift Card Balance operations
  async createGiftCardBalance(balance: InsertGiftCardBalance): Promise<GiftCardBalance> {
    const [created] = await db.insert(giftCardBalances).values(balance).returning();
    return created;
  }

  async getGiftCardBalancesByUser(userId: string): Promise<GiftCardBalance[]> {
    return db.select().from(giftCardBalances).where(and(
      eq(giftCardBalances.ownerId, userId),
      eq(giftCardBalances.status, "active")
    )).orderBy(desc(giftCardBalances.createdAt));
  }

  async getGiftCardBalance(id: string): Promise<GiftCardBalance | undefined> {
    const [balance] = await db.select().from(giftCardBalances).where(eq(giftCardBalances.id, id));
    return balance;
  }

  async updateGiftCardBalance(id: string, data: Partial<InsertGiftCardBalance>): Promise<GiftCardBalance | undefined> {
    const [updated] = await db.update(giftCardBalances).set(data).where(eq(giftCardBalances.id, id)).returning();
    return updated;
  }

  // Gift Card Transfer operations
  async createGiftCardTransfer(transfer: InsertGiftCardTransfer): Promise<GiftCardTransfer> {
    const [created] = await db.insert(giftCardTransfers).values(transfer).returning();
    return created;
  }

  async getGiftCardTransfersByUser(userId: string): Promise<GiftCardTransfer[]> {
    return db.select().from(giftCardTransfers).where(
      sql`${giftCardTransfers.fromUserId} = ${userId} OR ${giftCardTransfers.toUserId} = ${userId}`
    ).orderBy(desc(giftCardTransfers.createdAt));
  }

  // Atomic gift card purchase with balance creation
  async purchaseGiftCard(
    buyerId: string,
    giftCardId: string,
    faceValue: string,
    cashbackRate: string
  ): Promise<{ purchase: GiftCardPurchase; balance: GiftCardBalance; notification: Notification }> {
    const purchaseAmount = parseFloat(faceValue);
    // No cashback for gift card purchases
    const cashbackAmount = 0;
    
    // Calculate unlock date (7 business days)
    const unlocksAt = new Date();
    let businessDays = 0;
    while (businessDays < 7) {
      unlocksAt.setDate(unlocksAt.getDate() + 1);
      const dayOfWeek = unlocksAt.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
    }
    
    return await db.transaction(async (tx) => {
      const [purchase] = await tx
        .insert(giftCardPurchases)
        .values({
          buyerId,
          giftCardId,
          purchaseAmount: purchaseAmount.toFixed(2),
          cashbackAmount: cashbackAmount.toFixed(2),
          status: "active",
          unlocksAt,
        })
        .returning();
      
      const [balance] = await tx
        .insert(giftCardBalances)
        .values({
          ownerId: buyerId,
          giftCardId,
          purchaseId: purchase.id,
          remainingValue: purchaseAmount.toFixed(2),
          status: "active",
        })
        .returning();
      
      const [notification] = await tx
        .insert(notifications)
        .values({
          userId: buyerId,
          type: "giftcard_purchased",
          title: "Carte cadeau achetée",
          message: `Vous avez acheté une carte cadeau de ${purchaseAmount.toFixed(2)}€`,
          isRead: false,
          metadata: JSON.stringify({ purchaseId: purchase.id, balanceId: balance.id }),
        })
        .returning();
      
      return { purchase, balance, notification };
    });
  }

  // Atomic gift card transfer to another user
  async transferGiftCard(
    fromUserId: string,
    toRevId: string,
    balanceId: string
  ): Promise<{ transfer: GiftCardTransfer; newBalance: GiftCardBalance; notifications: Notification[] }> {
    return await db.transaction(async (tx) => {
      // Find recipient by REVid
      const [recipient] = await tx
        .select()
        .from(users)
        .where(sql`${users.revId} = ${toRevId}`);
      
      if (!recipient) {
        throw new Error("Destinataire non trouvé");
      }
      
      if (recipient.id === fromUserId) {
        throw new Error("Vous ne pouvez pas vous envoyer une carte cadeau");
      }
      
      // Get and lock the balance
      const [balance] = await tx
        .select()
        .from(giftCardBalances)
        .where(and(
          eq(giftCardBalances.id, balanceId),
          eq(giftCardBalances.ownerId, fromUserId),
          eq(giftCardBalances.status, "active")
        ))
        .for("update");
      
      if (!balance) {
        throw new Error("Carte cadeau non trouvée ou déjà utilisée");
      }
      
      // Check if the gift card purchase is unlocked (7 business days have passed)
      const [purchase] = await tx
        .select()
        .from(giftCardPurchases)
        .where(eq(giftCardPurchases.id, balance.purchaseId));
      
      if (purchase && purchase.unlocksAt && new Date() < new Date(purchase.unlocksAt)) {
        throw new Error("Cette carte cadeau est encore en période de blocage");
      }
      
      // Get sender info
      const [sender] = await tx.select().from(users).where(eq(users.id, fromUserId));
      const senderName = sender ? `${sender.firstName || ""} ${(sender.lastName || "").charAt(0)}.`.trim() : "Un utilisateur";
      
      // Mark old balance as transferred
      await tx
        .update(giftCardBalances)
        .set({ status: "transferred" })
        .where(eq(giftCardBalances.id, balanceId));
      
      // Create new balance for recipient
      const [newBalance] = await tx
        .insert(giftCardBalances)
        .values({
          ownerId: recipient.id,
          giftCardId: balance.giftCardId,
          purchaseId: balance.purchaseId,
          remainingValue: balance.remainingValue,
          status: "active",
          receivedFromUserId: fromUserId,
        })
        .returning();
      
      // Create transfer record
      const [transfer] = await tx
        .insert(giftCardTransfers)
        .values({
          balanceId,
          fromUserId,
          toUserId: recipient.id,
          status: "completed",
        })
        .returning();
      
      // Create notifications for both parties
      const [senderNotification] = await tx
        .insert(notifications)
        .values({
          userId: fromUserId,
          type: "giftcard_sent",
          title: "Carte cadeau envoyée",
          message: `Vous avez offert une carte cadeau de ${balance.remainingValue}€ à ${recipient.firstName || "un utilisateur"}`,
          isRead: false,
          metadata: JSON.stringify({ transferId: transfer.id, recipientId: recipient.id }),
        })
        .returning();
      
      const [recipientNotification] = await tx
        .insert(notifications)
        .values({
          userId: recipient.id,
          type: "giftcard_received",
          title: "Carte cadeau reçue",
          message: `${senderName} vous a offert une carte cadeau de ${balance.remainingValue}€`,
          isRead: false,
          metadata: JSON.stringify({ transferId: transfer.id, senderId: fromUserId }),
        })
        .returning();
      
      return { transfer, newBalance, notifications: [senderNotification, recipientNotification] };
    });
  }
}

export const storage = new DatabaseStorage();

import {
  users,
  merchants,
  transactions,
  cashbackBalances,
  cashbackEntries,
  cashbackTransfers,
  merchantCategories,
  merchantBillings,
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
    
    const dataWithRevId = {
      ...userData,
      revId: existingUser?.revId || generateRevId(),
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
}

export const storage = new DatabaseStorage();

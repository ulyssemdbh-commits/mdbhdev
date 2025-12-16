import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Merchants API
  app.get('/api/merchants', async (req, res) => {
    try {
      const { category } = req.query;
      let merchantsList;
      if (category && typeof category === 'string') {
        merchantsList = await storage.getMerchantsByCategory(category);
      } else {
        merchantsList = await storage.getMerchants();
      }
      res.json(merchantsList);
    } catch (error) {
      console.error("Error fetching merchants:", error);
      res.status(500).json({ message: "Failed to fetch merchants" });
    }
  });

  app.get('/api/merchants/:id', async (req, res) => {
    try {
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      console.error("Error fetching merchant:", error);
      res.status(500).json({ message: "Failed to fetch merchant" });
    }
  });

  app.get('/api/merchant/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant profile not found" });
      }
      res.json(merchant);
    } catch (error) {
      console.error("Error fetching merchant profile:", error);
      res.status(500).json({ message: "Failed to fetch merchant profile" });
    }
  });

  // Transactions API
  app.get('/api/transactions/merchant', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant profile not found" });
      }
      const txs = await storage.getTransactionsByMerchant(merchant.id);
      res.json(txs);
    } catch (error) {
      console.error("Error fetching merchant transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/transactions/client', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const txs = await storage.getTransactionsByClient(userId);
      res.json(txs);
    } catch (error) {
      console.error("Error fetching client transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Only merchants can create transactions" });
      }

      const { clientId, amount } = req.body;
      if (!clientId || !amount) {
        return res.status(400).json({ message: "clientId and amount are required" });
      }

      const amountNum = parseFloat(amount);
      const cashbackAmount = amountNum * 0.10; // 10% cashback for customer
      const commissionAmount = amountNum * 0.13; // 13% total commission (10% + 3% REV)

      // Create transaction
      const transaction = await storage.createTransaction({
        clientId,
        merchantId: merchant.id,
        amount: amountNum.toFixed(2),
        cashbackAmount: cashbackAmount.toFixed(2),
        commissionAmount: commissionAmount.toFixed(2),
        status: "completed",
      });

      // Create pending cashback entry (unlocks after 7 days)
      const unlocksAt = new Date();
      unlocksAt.setDate(unlocksAt.getDate() + 7);

      await storage.createCashbackEntry({
        transactionId: transaction.id,
        userId: clientId,
        merchantId: merchant.id,
        amount: cashbackAmount.toFixed(2),
        status: "pending",
        unlocksAt,
      });

      // Update pending balance
      const existingBalance = await storage.getCashbackBalance(clientId, merchant.id);
      const currentPending = parseFloat(existingBalance?.pendingBalance || "0");
      const currentAvailable = parseFloat(existingBalance?.availableBalance || "0");

      await storage.upsertCashbackBalance({
        userId: clientId,
        merchantId: merchant.id,
        pendingBalance: (currentPending + cashbackAmount).toFixed(2),
        availableBalance: currentAvailable.toFixed(2),
      });

      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.post('/api/transactions/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Only merchants can cancel transactions" });
      }

      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.merchantId !== merchant.id) {
        return res.status(403).json({ message: "Cannot cancel another merchant's transaction" });
      }

      // Check 2-hour cancellation window
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      if (transaction.createdAt < twoHoursAgo) {
        return res.status(400).json({ message: "Cancellation window expired (2 hours)" });
      }

      if (transaction.status === "cancelled") {
        return res.status(400).json({ message: "Transaction already cancelled" });
      }

      const cancelled = await storage.cancelTransaction(req.params.id);
      res.json(cancelled);
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      res.status(500).json({ message: "Failed to cancel transaction" });
    }
  });

  // Cashback API
  app.get('/api/cashback/balances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balances = await storage.getCashbackBalancesByUser(userId);
      res.json(balances);
    } catch (error) {
      console.error("Error fetching cashback balances:", error);
      res.status(500).json({ message: "Failed to fetch cashback balances" });
    }
  });

  app.get('/api/cashback/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getCashbackEntriesByUser(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching cashback entries:", error);
      res.status(500).json({ message: "Failed to fetch cashback entries" });
    }
  });

  // Use cashback at merchant
  app.post('/api/cashback/use', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { merchantId, amount } = req.body;

      if (!merchantId || !amount) {
        return res.status(400).json({ message: "merchantId and amount are required" });
      }

      const balance = await storage.getCashbackBalance(userId, merchantId);
      if (!balance) {
        return res.status(400).json({ message: "No cashback balance for this merchant" });
      }

      const available = parseFloat(balance.availableBalance);
      const amountToUse = parseFloat(amount);

      if (amountToUse > available) {
        return res.status(400).json({ message: "Insufficient cashback balance" });
      }

      const newAvailable = available - amountToUse;
      await storage.upsertCashbackBalance({
        userId,
        merchantId,
        availableBalance: newAvailable.toFixed(2),
        pendingBalance: balance.pendingBalance,
      });

      res.json({ success: true, newBalance: newAvailable });
    } catch (error) {
      console.error("Error using cashback:", error);
      res.status(500).json({ message: "Failed to use cashback" });
    }
  });

  // Admin API - Get stats for admin dashboard
  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin API - Get all transactions for admin panel
  app.get('/api/admin/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const txs = await storage.getAllTransactions();
      res.json(txs);
    } catch (error) {
      console.error("Error fetching admin transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin API - Get all merchants for admin panel (including inactive)
  app.get('/api/admin/merchants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      const merchantsList = await storage.getAllMerchantsForAdmin();
      res.json(merchantsList);
    } catch (error) {
      console.error("Error fetching merchants for admin:", error);
      res.status(500).json({ message: "Failed to fetch merchants" });
    }
  });

  app.post('/api/admin/merchants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const merchantData = {
        ...req.body,
        userId: req.body.userId || userId,
      };
      const merchant = await storage.createMerchant(merchantData);
      res.json(merchant);
    } catch (error) {
      console.error("Error creating merchant:", error);
      res.status(500).json({ message: "Failed to create merchant" });
    }
  });

  app.patch('/api/admin/merchants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const merchant = await storage.updateMerchant(req.params.id, req.body);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      console.error("Error updating merchant:", error);
      res.status(500).json({ message: "Failed to update merchant" });
    }
  });

  app.delete('/api/admin/merchants/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const deleted = await storage.deleteMerchant(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting merchant:", error);
      res.status(500).json({ message: "Failed to delete merchant" });
    }
  });

  app.get('/api/admin/merchants/:id/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }

      const transactions = await storage.getTransactionsByMerchant(req.params.id);
      const completedTxs = transactions.filter(tx => tx.status === "completed");
      
      const totalSales = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const totalCashback = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.cashbackAmount || "0"), 0);
      const totalCommission = completedTxs.reduce((sum, tx) => sum + parseFloat(tx.commissionAmount || "0"), 0);

      const monthlyData: Record<string, { sales: number; transactions: number }> = {};
      completedTxs.forEach(tx => {
        const month = new Date(tx.createdAt).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        if (!monthlyData[month]) {
          monthlyData[month] = { sales: 0, transactions: 0 };
        }
        monthlyData[month].sales += parseFloat(tx.amount);
        monthlyData[month].transactions += 1;
      });

      res.json({
        merchant,
        totalTransactions: completedTxs.length,
        totalSales,
        totalCashback,
        totalCommission,
        monthlyData: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data,
        })),
        recentTransactions: transactions.slice(0, 10),
      });
    } catch (error) {
      console.error("Error fetching merchant stats:", error);
      res.status(500).json({ message: "Failed to fetch merchant stats" });
    }
  });

  // Unlock pending cashback entries (to be called by cron job)
  app.post('/api/cron/unlock-cashback', async (req, res) => {
    try {
      const pendingEntries = await storage.getPendingCashbackEntries();
      
      for (const entry of pendingEntries) {
        await storage.unlockCashbackEntry(entry.id);
        
        const balance = await storage.getCashbackBalance(entry.userId, entry.merchantId);
        if (balance) {
          const currentAvailable = parseFloat(balance.availableBalance);
          const currentPending = parseFloat(balance.pendingBalance);
          const entryAmount = parseFloat(entry.amount);
          
          await storage.upsertCashbackBalance({
            userId: entry.userId,
            merchantId: entry.merchantId,
            availableBalance: (currentAvailable + entryAmount).toFixed(2),
            pendingBalance: Math.max(0, currentPending - entryAmount).toFixed(2),
          });
        }
      }

      res.json({ success: true, unlockedCount: pendingEntries.length });
    } catch (error) {
      console.error("Error unlocking cashback:", error);
      res.status(500).json({ message: "Failed to unlock cashback" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emitTransactionUpdate, emitStatsUpdate, emitMerchantUpdate, emitClientUpdate } from "./socket";

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

      emitTransactionUpdate(transaction);
      emitStatsUpdate();
      
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
      
      emitTransactionUpdate(cancelled);
      emitStatsUpdate();
      
      res.json(cancelled);
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      res.status(500).json({ message: "Failed to cancel transaction" });
    }
  });

  // Get client cashback info for merchants
  app.get('/api/merchant/client/:clientId/cashback', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Only merchants can access this endpoint" });
      }

      const clientId = req.params.clientId;
      const balances = await storage.getCashbackBalancesByUser(clientId);
      
      // Calculate total available cashback across all merchants
      const totalAvailable = balances.reduce((sum, b) => sum + parseFloat(b.availableBalance || "0"), 0);
      const totalPending = balances.reduce((sum, b) => sum + parseFloat(b.pendingBalance || "0"), 0);
      
      // Get client user info if available
      const clientUser = await storage.getUser(clientId);
      
      res.json({
        clientId,
        clientName: clientUser ? `${clientUser.firstName || ""} ${clientUser.lastName || ""}`.trim() || clientUser.email : null,
        totalAvailable: totalAvailable.toFixed(2),
        totalPending: totalPending.toFixed(2),
        totalBalance: (totalAvailable + totalPending).toFixed(2),
      });
    } catch (error) {
      console.error("Error fetching client cashback:", error);
      res.status(500).json({ message: "Failed to fetch client cashback" });
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

  // Cashback Transfers API
  app.get('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/cashback/transfer', isAuthenticated, async (req: any, res) => {
    try {
      const fromUserId = req.user.claims.sub;
      const { toUserId, merchantId, amount } = req.body;

      if (!toUserId || !merchantId || !amount) {
        return res.status(400).json({ message: "toUserId, merchantId, and amount are required" });
      }

      if (fromUserId === toUserId) {
        return res.status(400).json({ message: "Cannot transfer cashback to yourself" });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Invalid transfer amount" });
      }

      // Check sender has enough balance for this merchant
      const senderBalance = await storage.getCashbackBalance(fromUserId, merchantId);
      if (!senderBalance) {
        return res.status(400).json({ message: "No cashback balance for this merchant" });
      }

      const senderAvailable = parseFloat(senderBalance.availableBalance);
      if (amountNum > senderAvailable) {
        return res.status(400).json({ message: "Insufficient cashback balance" });
      }

      // Verify recipient exists
      const recipient = await storage.getUser(toUserId);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient user not found" });
      }

      // Deduct from sender
      await storage.upsertCashbackBalance({
        userId: fromUserId,
        merchantId,
        availableBalance: (senderAvailable - amountNum).toFixed(2),
        pendingBalance: senderBalance.pendingBalance,
      });

      // Add to recipient
      const recipientBalance = await storage.getCashbackBalance(toUserId, merchantId);
      const recipientAvailable = parseFloat(recipientBalance?.availableBalance || "0");
      const recipientPending = recipientBalance?.pendingBalance || "0.00";

      await storage.upsertCashbackBalance({
        userId: toUserId,
        merchantId,
        availableBalance: (recipientAvailable + amountNum).toFixed(2),
        pendingBalance: recipientPending,
      });

      // Record the transfer
      const transfer = await storage.createCashbackTransfer({
        fromUserId,
        toUserId,
        merchantId,
        amount: amountNum.toFixed(2),
        status: "completed",
      });

      res.json(transfer);
    } catch (error) {
      console.error("Error transferring cashback:", error);
      res.status(500).json({ message: "Failed to transfer cashback" });
    }
  });

  app.get('/api/cashback/transfers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transfers = await storage.getCashbackTransfersByUser(userId);
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching cashback transfers:", error);
      res.status(500).json({ message: "Failed to fetch transfers" });
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

  // Admin API - Get all clients for admin panel
  app.get('/api/admin/clients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients for admin:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // Admin API - Update client
  app.patch('/api/admin/clients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Prevent admin from modifying themselves through this endpoint
      if (req.params.id === userId) {
        return res.status(400).json({ message: "Cannot modify your own account through this endpoint" });
      }

      const { firstName, lastName, email, role } = req.body;
      const updated = await storage.updateUser(req.params.id, {
        firstName,
        lastName,
        email,
        role,
      });
      emitClientUpdate();
      emitStatsUpdate();
      res.json(updated);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Admin API - Delete client
  app.delete('/api/admin/clients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Prevent admin from deleting themselves
      if (req.params.id === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(req.params.id);
      emitClientUpdate();
      emitStatsUpdate();
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Admin API - Cancel transaction (admin override, no time limit)
  app.post('/api/admin/transactions/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status === "cancelled") {
        return res.status(400).json({ message: "Transaction already cancelled" });
      }

      const cancelled = await storage.adminCancelTransaction(req.params.id);
      
      emitTransactionUpdate(cancelled);
      emitStatsUpdate();
      
      res.json(cancelled);
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      res.status(500).json({ message: "Failed to cancel transaction" });
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
      emitMerchantUpdate();
      emitStatsUpdate();
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
      emitMerchantUpdate();
      emitStatsUpdate();
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
      emitMerchantUpdate();
      emitStatsUpdate();
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

  // Merchant Categories - Public route for active categories
  app.get('/api/merchant-categories', async (req, res) => {
    try {
      const categories = await storage.getActiveCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Admin Category Management
  app.get('/api/admin/merchant-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/admin/merchant-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { name, description, displayOrder, isActive } = req.body;
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ message: "Category name must be at least 2 characters" });
      }

      const category = await storage.createCategory({
        name: name.trim(),
        description: description || null,
        displayOrder: displayOrder || "0",
        isActive: isActive !== false,
      });
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch('/api/admin/merchant-categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { name, description, displayOrder, isActive } = req.body;
      const updateData: any = {};
      
      if (name !== undefined) {
        if (name.trim().length < 2) {
          return res.status(400).json({ message: "Category name must be at least 2 characters" });
        }
        updateData.name = name.trim();
      }
      if (description !== undefined) updateData.description = description;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
      if (isActive !== undefined) updateData.isActive = isActive;

      const category = await storage.updateCategory(req.params.id, updateData);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/admin/merchant-categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Check if any merchants are using this category
      const allMerchants = await storage.getMerchants();
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const merchantsUsingCategory = allMerchants.filter(m => m.category === category.name);
      if (merchantsUsingCategory.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete category: ${merchantsUsingCategory.length} merchant(s) are using it` 
        });
      }

      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Merchant billing routes
  app.get('/api/admin/billings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const billings = await storage.getAllBillings();
      res.json(billings);
    } catch (error) {
      console.error("Error fetching billings:", error);
      res.status(500).json({ message: "Failed to fetch billings" });
    }
  });

  app.get('/api/admin/billings/:merchantId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const billings = await storage.getBillingsByMerchant(req.params.merchantId);
      res.json(billings);
    } catch (error) {
      console.error("Error fetching merchant billings:", error);
      res.status(500).json({ message: "Failed to fetch merchant billings" });
    }
  });

  // Generate billings for all merchants for the current period
  // Called on 15th and 30th of each month
  app.post('/api/admin/billings/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth();
      const year = now.getFullYear();

      // Determine billing period
      let periodStart: Date, periodEnd: Date;
      if (day <= 15) {
        // Period: 1st to 15th
        periodStart = new Date(year, month, 1, 0, 0, 0);
        periodEnd = new Date(year, month, 15, 23, 59, 59);
      } else {
        // Period: 16th to end of month
        periodStart = new Date(year, month, 16, 0, 0, 0);
        periodEnd = new Date(year, month + 1, 0, 23, 59, 59);
      }

      // Due date is 7 days after period end
      const dueDate = new Date(periodEnd);
      dueDate.setDate(dueDate.getDate() + 7);

      const allMerchants = await storage.getAllMerchantsForAdmin();
      const existingBillings = await storage.getAllBillings();
      const createdBillings = [];
      const skippedCount = { duplicate: 0, noTransactions: 0 };

      for (const merchant of allMerchants) {
        if (!merchant.isActive) continue;

        // Check for duplicate billing for this merchant and period
        const existingBilling = existingBillings.find(b => 
          b.merchantId === merchant.id &&
          new Date(b.periodStart).getTime() === periodStart.getTime() &&
          new Date(b.periodEnd).getTime() === periodEnd.getTime()
        );
        
        if (existingBilling) {
          skippedCount.duplicate++;
          continue;
        }

        const periodTransactions = await storage.getTransactionsForPeriod(
          merchant.id,
          periodStart,
          periodEnd
        );

        if (periodTransactions.length === 0) {
          skippedCount.noTransactions++;
          continue;
        }

        // Calculate totals:
        // - 10% cashback (given to customer)
        // - 3% REV fee (before TVA)
        // - 20% TVA on the REV fee = 0.6% of sales
        // - Total ~13.6% of sales
        const totalSales = periodTransactions.reduce(
          (sum, tx) => sum + parseFloat(tx.amount),
          0
        );
        const cashbackAmount = totalSales * 0.10; // 10% cashback
        const revFeeAmount = totalSales * 0.03; // 3% REV fee
        const tvaAmount = revFeeAmount * 0.20; // 20% TVA on REV fee only
        const totalBilled = cashbackAmount + revFeeAmount + tvaAmount;

        const billing = await storage.createBilling({
          merchantId: merchant.id,
          periodStart,
          periodEnd,
          totalSales: totalSales.toFixed(2),
          cashbackAmount: cashbackAmount.toFixed(2),
          revFeeAmount: revFeeAmount.toFixed(2),
          tvaAmount: tvaAmount.toFixed(2),
          totalBilled: totalBilled.toFixed(2),
          status: "pending",
          dueDate,
        });

        createdBillings.push(billing);
      }

      res.json({ 
        success: true, 
        createdCount: createdBillings.length,
        billings: createdBillings,
        period: { start: periodStart, end: periodEnd }
      });
    } catch (error) {
      console.error("Error generating billings:", error);
      res.status(500).json({ message: "Failed to generate billings" });
    }
  });

  app.patch('/api/admin/billings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status } = req.body;
      if (!["pending", "paid", "overdue"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const paidAt = status === "paid" ? new Date() : undefined;
      const billing = await storage.updateBillingStatus(req.params.id, status, paidAt);
      if (!billing) {
        return res.status(404).json({ message: "Billing not found" });
      }
      res.json(billing);
    } catch (error) {
      console.error("Error updating billing status:", error);
      res.status(500).json({ message: "Failed to update billing status" });
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

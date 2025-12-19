import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireRole } from "./replitAuth";
import { emitTransactionUpdate, emitStatsUpdate, emitMerchantUpdate, emitClientUpdate } from "./socket";
import { z } from "zod";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault, isPayPalConfigured } from "./paypal";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

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

  // Update user profile (date of birth for clients)
  app.patch('/api/auth/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const profileSchema = z.object({
        dateOfBirth: z.string().refine((val) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        }, { message: "Invalid date format" }),
      });

      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const updated = await storage.updateUser(userId, {
        dateOfBirth: new Date(parsed.data.dateOfBirth),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
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

  app.get('/api/merchant/me', isAuthenticated, requireRole('merchant', 'admin'), async (req: any, res) => {
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
  app.get('/api/transactions/merchant', isAuthenticated, requireRole('merchant', 'admin'), async (req: any, res) => {
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

  app.get('/api/transactions/client', isAuthenticated, requireRole('client', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const txs = await storage.getTransactionsByClient(userId);
      res.json(txs);
    } catch (error) {
      console.error("Error fetching client transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Zod schema for transaction validation
  const createTransactionSchema = z.object({
    clientId: z.string().min(1, "Client ID is required"),
    amount: z.union([z.string(), z.number()]).refine(
      (val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num > 0;
      },
      { message: "Amount must be a positive number" }
    ),
  });

  app.post('/api/transactions', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Merchant profile not found" });
      }

      const validation = createTransactionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { clientId, amount } = validation.data;
      const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
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

  app.post('/api/transactions/:id/cancel', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Merchant profile not found" });
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
  app.get('/api/merchant/client/:clientId/cashback', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Merchant profile not found" });
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

  // Merchant billings API
  app.get('/api/merchant/billings', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(403).json({ message: "Merchant profile not found" });
      }

      const billings = await storage.getBillingsByMerchant(merchant.id);
      res.json(billings);
    } catch (error) {
      console.error("Error fetching merchant billings:", error);
      res.status(500).json({ message: "Failed to fetch merchant billings" });
    }
  });

  // Cashback API
  app.get('/api/cashback/balances', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balances = await storage.getCashbackBalancesByUser(userId);
      res.json(balances);
    } catch (error) {
      console.error("Error fetching cashback balances:", error);
      res.status(500).json({ message: "Failed to fetch cashback balances" });
    }
  });

  app.get('/api/cashback/entries', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getCashbackEntriesByUser(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching cashback entries:", error);
      res.status(500).json({ message: "Failed to fetch cashback entries" });
    }
  });

  // Zod schema for cashback use validation
  const useCashbackSchema = z.object({
    merchantId: z.string().min(1, "Merchant ID is required"),
    amount: z.union([z.string(), z.number()]).refine(
      (val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num > 0;
      },
      { message: "Amount must be a positive number" }
    ),
  });

  // Use cashback at merchant
  app.post('/api/cashback/use', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validation = useCashbackSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { merchantId, amount } = validation.data;

      const balance = await storage.getCashbackBalance(userId, merchantId);
      if (!balance) {
        return res.status(400).json({ message: "No cashback balance for this merchant" });
      }

      const available = parseFloat(balance.availableBalance);
      const amountToUse = typeof amount === 'string' ? parseFloat(amount) : amount;

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
  // Lookup user by REV ID (e.g., REVID12345678) or regular ID
  app.get('/api/users/:id', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      let user;
      
      // Check if it's a REV ID format (REVid- + 6 alphanumeric)
      if (id.startsWith('REVid-') && id.length === 12) {
        user = await storage.getUserByRevId(id);
      } else {
        user = await storage.getUser(id);
      }
      
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

  // Zod schema for cashback transfer validation
  const transferCashbackSchema = z.object({
    toUserId: z.string().min(1, "Recipient ID is required"),
    merchantId: z.string().min(1, "Merchant ID is required"),
    amount: z.union([z.string(), z.number()]).refine(
      (val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num > 0;
      },
      { message: "Amount must be a positive number" }
    ),
  });

  app.post('/api/cashback/transfer', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const fromUserId = req.user.claims.sub;
      
      const validation = transferCashbackSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { toUserId, merchantId, amount } = validation.data;

      if (fromUserId === toUserId) {
        return res.status(400).json({ message: "Cannot transfer cashback to yourself" });
      }

      const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;

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

      // Get merchant name for notifications
      const merchant = await storage.getMerchant(merchantId);
      const merchantName = merchant?.name || "un commerçant";
      
      // Get sender info for recipient notification
      const sender = await storage.getUser(fromUserId);
      const senderName = sender ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email || "Un utilisateur" : "Un utilisateur";
      
      // Get recipient info for sender notification
      const recipientName = `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim() || recipient.email || "Un utilisateur";

      // Create notification for sender
      await storage.createNotification({
        userId: fromUserId,
        type: "transfer_sent",
        title: "Transfert envoyé",
        message: `Vous avez envoyé ${amountNum.toFixed(2)}€ de cashback à ${recipientName} (${merchantName})`,
        isRead: false,
      });

      // Create notification for recipient
      await storage.createNotification({
        userId: toUserId,
        type: "transfer_received",
        title: "Cashback reçu",
        message: `Vous avez reçu ${amountNum.toFixed(2)}€ de cashback de ${senderName} (${merchantName})`,
        isRead: false,
      });

      res.json(transfer);
    } catch (error) {
      console.error("Error transferring cashback:", error);
      res.status(500).json({ message: "Failed to transfer cashback" });
    }
  });

  app.get('/api/cashback/transfers', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transfers = await storage.getCashbackTransfersByUser(userId);
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching cashback transfers:", error);
      res.status(500).json({ message: "Failed to fetch transfers" });
    }
  });

  // Notifications API
  app.get('/api/notifications', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifs = await storage.getNotificationsByUser(userId);
      res.json(notifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get('/api/notifications/unread-count', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.post('/api/notifications/:id/read', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const notif = await storage.markNotificationAsRead(req.params.id);
      if (!notif) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notif);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  app.post('/api/notifications/mark-all-read', isAuthenticated, requireRole('client', 'merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  // Promotions API (Bons Plans)
  // Get all active promotions (for clients) - includes merchant info
  app.get('/api/promotions', async (req, res) => {
    try {
      const promos = await storage.getActivePromotions();
      // Enrich with merchant info
      const enrichedPromos = await Promise.all(promos.map(async (promo) => {
        const merchant = await storage.getMerchant(promo.merchantId);
        return {
          ...promo,
          merchantName: merchant?.name || "Commerçant",
          merchantCategory: merchant?.category || "Commerce",
        };
      }));
      res.json(enrichedPromos);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      res.status(500).json({ message: "Failed to fetch promotions" });
    }
  });

  // Get promotions for current merchant
  app.get('/api/merchant/promotions', isAuthenticated, requireRole('merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant profile not found" });
      }
      const promos = await storage.getPromotionsByMerchant(merchant.id);
      res.json(promos);
    } catch (error) {
      console.error("Error fetching merchant promotions:", error);
      res.status(500).json({ message: "Failed to fetch promotions" });
    }
  });

  // Create a promotion (merchant only)
  app.post('/api/merchant/promotions', isAuthenticated, requireRole('merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant profile not found" });
      }

      const promotionSchema = z.object({
        type: z.enum(['cashback_boost', 'free_article', 'discount_percent']),
        title: z.string().min(1),
        description: z.string().optional(),
        cashbackBoostRate: z.string().optional(),
        freeArticle: z.string().optional(),
        discountPercent: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        isActive: z.boolean().optional().default(true),
      });

      const parsed = promotionSchema.parse(req.body);
      const promo = await storage.createPromotion({
        ...parsed,
        merchantId: merchant.id,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
      });
      res.status(201).json(promo);
    } catch (error) {
      console.error("Error creating promotion:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid promotion data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create promotion" });
    }
  });

  // Update a promotion
  app.patch('/api/merchant/promotions/:id', isAuthenticated, requireRole('merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant profile not found" });
      }

      const promo = await storage.getPromotion(req.params.id);
      if (!promo || promo.merchantId !== merchant.id) {
        return res.status(404).json({ message: "Promotion not found" });
      }

      const updateData: any = { ...req.body };
      if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

      const updated = await storage.updatePromotion(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating promotion:", error);
      res.status(500).json({ message: "Failed to update promotion" });
    }
  });

  // Delete a promotion
  app.delete('/api/merchant/promotions/:id', isAuthenticated, requireRole('merchant', 'admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant profile not found" });
      }

      const promo = await storage.getPromotion(req.params.id);
      if (!promo || promo.merchantId !== merchant.id) {
        return res.status(404).json({ message: "Promotion not found" });
      }

      await storage.deletePromotion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting promotion:", error);
      res.status(500).json({ message: "Failed to delete promotion" });
    }
  });

  // Admin API - Get stats for admin dashboard
  app.get('/api/admin/stats', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin API - Get all transactions for admin panel
  app.get('/api/admin/transactions', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const txs = await storage.getAllTransactions();
      res.json(txs);
    } catch (error) {
      console.error("Error fetching admin transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin API - Get all merchants for admin panel (including inactive)
  app.get('/api/admin/merchants', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const merchantsList = await storage.getAllMerchantsForAdmin();
      res.json(merchantsList);
    } catch (error) {
      console.error("Error fetching merchants for admin:", error);
      res.status(500).json({ message: "Failed to fetch merchants" });
    }
  });

  // Admin API - Get all clients for admin panel
  app.get('/api/admin/clients', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients for admin:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // Admin API - Get all merchant users for admin panel
  app.get('/api/admin/merchant-users', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const merchantUsers = await storage.getAllMerchantUsers();
      res.json(merchantUsers);
    } catch (error) {
      console.error("Error fetching merchant users for admin:", error);
      res.status(500).json({ message: "Failed to fetch merchant users" });
    }
  });

  // Admin API - Update client
  app.patch('/api/admin/clients/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "Client not found" });
      }

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
  app.delete('/api/admin/clients/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "Client not found" });
      }

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
  app.post('/api/admin/transactions/:id/cancel', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
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

  // Zod schema for merchant creation validation
  const createMerchantSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    category: z.string().min(1, "Category is required"),
    address: z.string().min(1, "Address is required"),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    siret: z.string().optional(),
    contactName: z.string().optional(),
    bankIban: z.string().optional(),
    bankBic: z.string().optional(),
    cashbackRate: z.string().optional(),
    isActive: z.boolean().optional(),
    userId: z.string().optional(),
  });

  app.post('/api/admin/merchants', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validation = createMerchantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const merchantData = {
        ...validation.data,
        userId: validation.data.userId || userId,
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

  app.patch('/api/admin/merchants/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
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

  app.delete('/api/admin/merchants/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
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

  app.get('/api/admin/merchants/:id/stats', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {

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
  app.get('/api/admin/merchant-categories', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Zod schema for category validation
  const createCategorySchema = z.object({
    name: z.string().min(2, "Category name must be at least 2 characters"),
    description: z.string().optional().nullable(),
    displayOrder: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.post('/api/admin/merchant-categories', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const validation = createCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { name, description, displayOrder, isActive } = validation.data;
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

  app.patch('/api/admin/merchant-categories/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
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

  app.delete('/api/admin/merchant-categories/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
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

  // Admin Promotions (Bons Plans) Management
  app.get('/api/admin/promotions', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const promos = await storage.getAllPromotions();
      const enrichedPromos = await Promise.all(promos.map(async (promo) => {
        const merchant = await storage.getMerchant(promo.merchantId);
        return {
          ...promo,
          merchantName: merchant?.name || "Inconnu",
          merchantCategory: merchant?.category || "Non categorise",
        };
      }));
      res.json(enrichedPromos);
    } catch (error) {
      console.error("Error fetching all promotions:", error);
      res.status(500).json({ message: "Failed to fetch promotions" });
    }
  });

  app.delete('/api/admin/promotions/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      await storage.deletePromotion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting promotion:", error);
      res.status(500).json({ message: "Failed to delete promotion" });
    }
  });

  app.patch('/api/admin/promotions/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const { isActive } = req.body;
      const updated = await storage.updatePromotion(req.params.id, { isActive });
      res.json(updated);
    } catch (error) {
      console.error("Error updating promotion:", error);
      res.status(500).json({ message: "Failed to update promotion" });
    }
  });

  // Merchant billing routes
  app.get('/api/admin/billings', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const billings = await storage.getAllBillings();
      res.json(billings);
    } catch (error) {
      console.error("Error fetching billings:", error);
      res.status(500).json({ message: "Failed to fetch billings" });
    }
  });

  app.get('/api/admin/billings/:merchantId', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const billings = await storage.getBillingsByMerchant(req.params.merchantId);
      res.json(billings);
    } catch (error) {
      console.error("Error fetching merchant billings:", error);
      res.status(500).json({ message: "Failed to fetch merchant billings" });
    }
  });

  // Generate billings for all merchants for the current period
  // Called on 15th and 30th of each month
  app.post('/api/admin/billings/generate', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {

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
        // - 19€ per week per active promotion (before TVA)
        // - 20% TVA on REV fee + Bons Plans
        const totalSales = periodTransactions.reduce(
          (sum, tx) => sum + parseFloat(tx.amount),
          0
        );
        const cashbackAmount = totalSales * 0.10; // 10% cashback
        const revFeeAmount = totalSales * 0.03; // 3% REV fee (HT)
        
        // Calculate promotion charges: 19€ per week per active promotion (HT)
        const promotionWeeks = await storage.getPromotionWeeksForPeriod(
          merchant.id,
          periodStart,
          periodEnd
        );
        const promotionCharges = promotionWeeks * 19; // 19€ per promotion-week (HT)
        
        // TVA 20% applies to REV fee AND Bons Plans
        const tvaAmount = (revFeeAmount + promotionCharges) * 0.20;
        
        const totalBilled = cashbackAmount + revFeeAmount + promotionCharges + tvaAmount;

        const billing = await storage.createBilling({
          merchantId: merchant.id,
          periodStart,
          periodEnd,
          totalSales: totalSales.toFixed(2),
          cashbackAmount: cashbackAmount.toFixed(2),
          revFeeAmount: revFeeAmount.toFixed(2),
          tvaAmount: tvaAmount.toFixed(2),
          promotionCharges: promotionCharges.toFixed(2),
          promotionWeeks: promotionWeeks.toString(),
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

  // Zod schema for billing status validation
  const updateBillingStatusSchema = z.object({
    status: z.enum(["pending", "paid", "overdue"], { 
      errorMap: () => ({ message: "Status must be pending, paid, or overdue" }) 
    }),
  });

  app.patch('/api/admin/billings/:id/status', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const validation = updateBillingStatusSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { status } = validation.data;
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

  // ========================
  // Gift Card API Endpoints
  // ========================

  // Get all gift cards (for clients)
  app.get('/api/gift-cards', async (req, res) => {
    try {
      const giftCards = await storage.getActiveGiftCards();
      res.json(giftCards);
    } catch (error) {
      console.error("Error fetching gift cards:", error);
      res.status(500).json({ message: "Failed to fetch gift cards" });
    }
  });

  // Admin: Get all gift cards
  app.get('/api/admin/gift-cards', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const giftCards = await storage.getGiftCards();
      res.json(giftCards);
    } catch (error) {
      console.error("Error fetching gift cards:", error);
      res.status(500).json({ message: "Failed to fetch gift cards" });
    }
  });

  // Admin: Get all gift card purchases
  app.get('/api/admin/gift-cards/purchases', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const purchases = await storage.getAllGiftCardPurchases();
      const purchasesWithDetails = await Promise.all(
        purchases.map(async (purchase) => {
          const giftCard = await storage.getGiftCard(purchase.giftCardId);
          const buyer = await storage.getUser(purchase.buyerId);
          return {
            ...purchase,
            giftCard,
            buyerName: buyer ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || buyer.email : 'Inconnu',
            buyerEmail: buyer?.email || '',
          };
        })
      );
      res.json(purchasesWithDetails);
    } catch (error) {
      console.error("Error fetching gift card purchases:", error);
      res.status(500).json({ message: "Failed to fetch gift card purchases" });
    }
  });

  // Admin: Get gift card analytics
  app.get('/api/admin/gift-cards/analytics', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const analytics = await storage.getGiftCardAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching gift card analytics:", error);
      res.status(500).json({ message: "Failed to fetch gift card analytics" });
    }
  });

  // Admin: Create gift card
  const createGiftCardSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    faceValue: z.union([z.string(), z.number()]).refine(
      (val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return !isNaN(num) && num > 0;
      },
      { message: "Face value must be a positive number" }
    ),
    cashbackRate: z.union([z.string(), z.number()]).optional().default("15.00"),
    imageUrl: z.string().optional(),
    isActive: z.boolean().optional().default(true),
  });

  app.post('/api/admin/gift-cards', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const validation = createGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { title, description, faceValue, cashbackRate, imageUrl, isActive } = validation.data;
      const faceValueNum = typeof faceValue === 'string' ? parseFloat(faceValue) : faceValue;
      const cashbackRateNum = typeof cashbackRate === 'string' ? parseFloat(cashbackRate) : cashbackRate;

      const giftCard = await storage.createGiftCard({
        title,
        description: description || null,
        faceValue: faceValueNum.toFixed(2),
        cashbackRate: cashbackRateNum.toFixed(2),
        imageUrl: imageUrl || null,
        isActive: isActive ?? true,
      });
      res.status(201).json(giftCard);
    } catch (error) {
      console.error("Error creating gift card:", error);
      res.status(500).json({ message: "Failed to create gift card" });
    }
  });

  // Admin: Update gift card
  app.patch('/api/admin/gift-cards/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const validation = createGiftCardSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const data = validation.data;
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.faceValue !== undefined) {
        const faceValueNum = typeof data.faceValue === 'string' ? parseFloat(data.faceValue) : data.faceValue;
        updateData.faceValue = faceValueNum.toFixed(2);
      }
      if (data.cashbackRate !== undefined) {
        const cashbackRateNum = typeof data.cashbackRate === 'string' ? parseFloat(data.cashbackRate) : data.cashbackRate;
        updateData.cashbackRate = cashbackRateNum.toFixed(2);
      }
      if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const giftCard = await storage.updateGiftCard(req.params.id, updateData);
      if (!giftCard) {
        return res.status(404).json({ message: "Gift card not found" });
      }
      res.json(giftCard);
    } catch (error) {
      console.error("Error updating gift card:", error);
      res.status(500).json({ message: "Failed to update gift card" });
    }
  });

  // Admin: Delete gift card
  app.delete('/api/admin/gift-cards/:id', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      await storage.deleteGiftCard(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting gift card:", error);
      res.status(500).json({ message: "Failed to delete gift card" });
    }
  });

  // ==================== PAYMENT CONFIGURATION ====================

  // Get available payment methods
  app.get('/api/payments/config', async (req, res) => {
    try {
      const stripeKey = await getStripePublishableKey();
      res.json({
        stripe: { enabled: true, publishableKey: stripeKey },
        paypal: { enabled: isPayPalConfigured() },
      });
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.json({
        stripe: { enabled: false },
        paypal: { enabled: isPayPalConfigured() },
      });
    }
  });

  // ==================== PAYPAL ROUTES ====================

  app.get("/api/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });

  // ==================== STRIPE GIFT CARD CHECKOUT ====================

  // Create Stripe checkout session for gift card purchase
  app.post('/api/gift-cards/checkout/stripe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { giftCardId } = req.body;

      if (!giftCardId) {
        return res.status(400).json({ message: "Gift card ID is required" });
      }

      const giftCard = await storage.getGiftCard(giftCardId);
      if (!giftCard) {
        return res.status(404).json({ message: "Carte cadeau non trouvée" });
      }

      if (!giftCard.isActive) {
        return res.status(400).json({ message: "Cette carte cadeau n'est plus disponible" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: giftCard.title,
                description: giftCard.description || `Carte cadeau REV - ${giftCard.faceValue}€`,
              },
              unit_amount: Math.round(parseFloat(giftCard.faceValue) * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${baseUrl}/gift-cards/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/gift-cards/cancel`,
        metadata: {
          userId,
          giftCardId,
          faceValue: giftCard.faceValue,
          cashbackRate: giftCard.cashbackRate,
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("Error creating Stripe checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Verify Stripe payment and complete gift card purchase
  app.post('/api/gift-cards/checkout/stripe/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ message: "Le paiement n'a pas été effectué" });
      }

      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Session non autorisée" });
      }

      const giftCardId = session.metadata?.giftCardId;
      const faceValue = session.metadata?.faceValue;
      const cashbackRate = session.metadata?.cashbackRate;

      if (!giftCardId || !faceValue || !cashbackRate) {
        return res.status(400).json({ message: "Données de session invalides" });
      }

      const result = await storage.purchaseGiftCard(
        userId,
        giftCardId,
        faceValue,
        cashbackRate
      );

      res.status(201).json(result);
    } catch (error) {
      console.error("Error verifying Stripe payment:", error);
      res.status(500).json({ message: "Failed to verify payment" });
    }
  });

  // ==================== PAYPAL GIFT CARD CHECKOUT ====================

  // Complete gift card purchase after PayPal payment
  app.post('/api/gift-cards/checkout/paypal/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { giftCardId, paypalOrderId } = req.body;

      if (!giftCardId || !paypalOrderId) {
        return res.status(400).json({ message: "Gift card ID and PayPal order ID are required" });
      }

      const giftCard = await storage.getGiftCard(giftCardId);
      if (!giftCard) {
        return res.status(404).json({ message: "Carte cadeau non trouvée" });
      }

      const result = await storage.purchaseGiftCard(
        userId,
        giftCardId,
        giftCard.faceValue,
        giftCard.cashbackRate
      );

      res.status(201).json(result);
    } catch (error) {
      console.error("Error completing PayPal gift card purchase:", error);
      res.status(500).json({ message: "Failed to complete purchase" });
    }
  });

  // Client: Purchase gift card (legacy - kept for compatibility)
  const purchaseGiftCardSchema = z.object({
    giftCardId: z.string().min(1, "Gift card ID is required"),
  });

  app.post('/api/gift-cards/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = purchaseGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { giftCardId } = validation.data;
      const giftCard = await storage.getGiftCard(giftCardId);
      if (!giftCard) {
        return res.status(404).json({ message: "Carte cadeau non trouvée" });
      }

      if (!giftCard.isActive) {
        return res.status(400).json({ message: "Cette carte cadeau n'est plus disponible" });
      }

      const result = await storage.purchaseGiftCard(
        userId,
        giftCardId,
        giftCard.faceValue,
        giftCard.cashbackRate
      );

      res.status(201).json(result);
    } catch (error) {
      console.error("Error purchasing gift card:", error);
      res.status(500).json({ message: "Failed to purchase gift card" });
    }
  });

  // Client: Get my gift card balances
  app.get('/api/gift-cards/my-balances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balances = await storage.getGiftCardBalancesByUser(userId);
      
      // Get gift card details for each balance
      const balancesWithDetails = await Promise.all(
        balances.map(async (balance) => {
          const giftCard = await storage.getGiftCard(balance.giftCardId);
          const purchase = await storage.getGiftCardPurchase(balance.purchaseId);
          return {
            ...balance,
            giftCard,
            purchase,
          };
        })
      );
      
      res.json(balancesWithDetails);
    } catch (error) {
      console.error("Error fetching gift card balances:", error);
      res.status(500).json({ message: "Failed to fetch gift card balances" });
    }
  });

  // Client: Get my gift card purchase history
  app.get('/api/gift-cards/my-purchases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const purchases = await storage.getGiftCardPurchasesByUser(userId);
      
      const purchasesWithDetails = await Promise.all(
        purchases.map(async (purchase) => {
          const giftCard = await storage.getGiftCard(purchase.giftCardId);
          return {
            ...purchase,
            giftCard,
          };
        })
      );
      
      res.json(purchasesWithDetails);
    } catch (error) {
      console.error("Error fetching gift card purchases:", error);
      res.status(500).json({ message: "Failed to fetch gift card purchases" });
    }
  });

  // Client: Transfer gift card to another user via REVid
  const transferGiftCardSchema = z.object({
    balanceId: z.string().min(1, "Balance ID is required"),
    recipientRevId: z.string().min(1, "Recipient REVid is required"),
  });

  app.post('/api/gift-cards/transfer', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = transferGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }

      const { balanceId, recipientRevId } = validation.data;
      
      // Pre-verify ownership before calling storage to avoid enumeration attacks
      const balance = await storage.getGiftCardBalance(balanceId);
      if (!balance || balance.ownerId !== userId || balance.status !== "active") {
        return res.status(404).json({ message: "Carte cadeau non trouvee" });
      }
      
      const result = await storage.transferGiftCard(userId, recipientRevId, balanceId);
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error transferring gift card:", error);
      // Return generic error message to avoid information leakage
      const message = error.message?.includes("non trouve") || error.message?.includes("not found") 
        ? "Operation impossible" 
        : (error.message || "Echec du transfert");
      res.status(400).json({ message });
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

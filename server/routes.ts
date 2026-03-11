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

  // ==================== USER FAVORITES ====================

  // Get user favorites
  app.get('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Add favorite - validate merchantId exists, idempotent (returns 200 if already exists)
  app.post('/api/favorites/:merchantId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchantId = req.params.merchantId;
      
      if (!merchantId || typeof merchantId !== 'string' || merchantId.length < 1) {
        return res.status(400).json({ message: "Invalid merchant ID" });
      }
      
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      
      const favorite = await storage.addUserFavorite(userId, merchantId);
      res.status(200).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  // Remove favorite
  app.delete('/api/favorites/:merchantId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchantId = req.params.merchantId;
      
      if (!merchantId || typeof merchantId !== 'string') {
        return res.status(400).json({ message: "Invalid merchant ID" });
      }
      
      await storage.removeUserFavorite(userId, merchantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // ==================== MERCHANT ANALYTICS ====================

  // Get merchant analytics
  app.get('/api/merchant/analytics', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      const analytics = await storage.getMerchantAnalytics(merchant.id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching merchant analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get promotion performance
  app.get('/api/merchant/promotions/:id/performance', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const performance = await storage.getPromotionPerformance(req.params.id);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching promotion performance:", error);
      res.status(500).json({ message: "Failed to fetch performance" });
    }
  });

  // Get merchant goal
  app.get('/api/merchant/goals/:month/:year', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      const goal = await storage.getMerchantGoal(
        merchant.id, 
        parseInt(req.params.month), 
        parseInt(req.params.year)
      );
      res.json(goal || null);
    } catch (error) {
      console.error("Error fetching merchant goal:", error);
      res.status(500).json({ message: "Failed to fetch goal" });
    }
  });

  // Set merchant goal
  app.post('/api/merchant/goals', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      const { month, year, salesGoal } = req.body;
      const goal = await storage.setMerchantGoal({
        merchantId: merchant.id,
        month: month.toString(),
        year: year.toString(),
        salesGoal: salesGoal.toString(),
      });
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error setting merchant goal:", error);
      res.status(500).json({ message: "Failed to set goal" });
    }
  });

  // ==================== RECURRING PROMOTIONS ====================

  // Get recurring promotions for merchant
  app.get('/api/merchant/recurring-promotions', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      const promotions = await storage.getRecurringPromotionsByMerchant(merchant.id);
      res.json(promotions);
    } catch (error) {
      console.error("Error fetching recurring promotions:", error);
      res.status(500).json({ message: "Failed to fetch recurring promotions" });
    }
  });

  // Create recurring promotion
  app.post('/api/merchant/recurring-promotions', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const merchant = await storage.getMerchantByUserId(userId);
      if (!merchant) {
        return res.status(404).json({ message: "Merchant not found" });
      }
      const promotion = await storage.createRecurringPromotion({
        ...req.body,
        merchantId: merchant.id,
      });
      res.status(201).json(promotion);
    } catch (error) {
      console.error("Error creating recurring promotion:", error);
      res.status(500).json({ message: "Failed to create recurring promotion" });
    }
  });

  // Update recurring promotion
  app.patch('/api/merchant/recurring-promotions/:id', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      const promotion = await storage.updateRecurringPromotion(req.params.id, req.body);
      res.json(promotion);
    } catch (error) {
      console.error("Error updating recurring promotion:", error);
      res.status(500).json({ message: "Failed to update recurring promotion" });
    }
  });

  // Delete recurring promotion
  app.delete('/api/merchant/recurring-promotions/:id', isAuthenticated, requireRole('merchant'), async (req: any, res) => {
    try {
      await storage.deleteRecurringPromotion(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting recurring promotion:", error);
      res.status(500).json({ message: "Failed to delete recurring promotion" });
    }
  });

  // ==================== ADMIN KPIs & ANALYTICS ====================

  // Get admin KPIs
  app.get('/api/admin/kpis', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const kpis = await storage.getAdminKPIs();
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching admin KPIs:", error);
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  });

  // Get suspicious transfers
  app.get('/api/admin/suspicious-transfers', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const transfers = await storage.getSuspiciousTransfers();
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching suspicious transfers:", error);
      res.status(500).json({ message: "Failed to fetch suspicious transfers" });
    }
  });

  // Get merchant compliance status
  app.get('/api/admin/compliance', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const compliance = await storage.getMerchantComplianceStatus();
      res.json(compliance);
    } catch (error) {
      console.error("Error fetching compliance status:", error);
      res.status(500).json({ message: "Failed to fetch compliance status" });
    }
  });

  // Get audit logs
  app.get('/api/admin/audit-logs', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ==================== AUDIT REPORT PDF ====================

  app.get('/api/admin/audit-report-pdf', isAuthenticated, requireRole('admin'), async (req: any, res) => {
    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 0;

      const allMerchants = await storage.getAllMerchantsForAdmin();
      const allUsers = await storage.getAllUsers();
      const allTransactions = await storage.getAllTransactions();
      const allBillings = await storage.getAllBillings();
      const clients = allUsers.filter(u => u.role === 'client');
      const totalSales = allTransactions.reduce((sum, t) => sum + parseFloat(String(t.amount || '0')), 0);
      const totalCommissions = allTransactions.reduce((sum, t) => sum + parseFloat(String(t.commissionAmount || '0')), 0);
      const totalCashback = allTransactions.reduce((sum, t) => sum + parseFloat(String(t.cashbackAmount || '0')), 0);

      const colors = {
        primary: [41, 98, 255] as [number, number, number],
        dark: [30, 30, 46] as [number, number, number],
        text: [55, 65, 81] as [number, number, number],
        lightBg: [243, 244, 246] as [number, number, number],
        green: [16, 185, 129] as [number, number, number],
        red: [239, 68, 68] as [number, number, number],
        orange: [245, 158, 11] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      };

      function addPageFooter() {
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(...colors.text);
          doc.text(`REV - Retour En Ville | Rapport d'Audit Confidentiel`, margin, pageHeight - 10);
          doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
      }

      function checkNewPage(needed: number) {
        if (y + needed > pageHeight - 25) {
          doc.addPage();
          y = 25;
        }
      }

      function addSectionTitle(title: string, number: string) {
        checkNewPage(20);
        doc.setFillColor(...colors.primary);
        doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
        doc.setFontSize(13);
        doc.setTextColor(...colors.white);
        doc.setFont('helvetica', 'bold');
        doc.text(`${number}. ${title}`, margin + 5, y + 7);
        y += 16;
        doc.setTextColor(...colors.text);
        doc.setFont('helvetica', 'normal');
      }

      function addSubTitle(title: string) {
        checkNewPage(14);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.dark);
        doc.text(title, margin + 2, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.text);
      }

      function addParagraph(text: string, indent = 0) {
        doc.setFontSize(9.5);
        doc.setTextColor(...colors.text);
        const lines = doc.splitTextToSize(text, contentWidth - indent);
        for (const line of lines) {
          checkNewPage(6);
          doc.text(line, margin + indent, y);
          y += 5;
        }
        y += 2;
      }

      function addBullet(text: string, icon = '•', color?: [number, number, number]) {
        doc.setFontSize(9.5);
        checkNewPage(6);
        if (color) doc.setTextColor(...color);
        else doc.setTextColor(...colors.text);
        doc.text(icon, margin + 4, y);
        doc.setTextColor(...colors.text);
        const lines = doc.splitTextToSize(text, contentWidth - 14);
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) checkNewPage(5);
          doc.text(lines[i], margin + 10, y);
          if (i < lines.length - 1) y += 5;
        }
        y += 6;
      }

      function addKPI(label: string, value: string) {
        checkNewPage(16);
        doc.setFillColor(...colors.lightBg);
        doc.roundedRect(margin + 2, y - 2, contentWidth - 4, 12, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setTextColor(...colors.text);
        doc.text(label, margin + 6, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.primary);
        doc.text(value, pageWidth - margin - 6, y + 5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 14;
      }

      // ===== PAGE DE GARDE =====
      doc.setFillColor(...colors.dark);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFillColor(...colors.primary);
      doc.roundedRect(margin, 40, contentWidth, 3, 1, 1, 'F');

      doc.setFontSize(42);
      doc.setTextColor(...colors.white);
      doc.setFont('helvetica', 'bold');
      doc.text('REV', pageWidth / 2, 65, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Retour En Ville', pageWidth / 2, 75, { align: 'center' });

      doc.setFillColor(...colors.primary);
      doc.roundedRect(pageWidth / 2 - 30, 82, 60, 0.5, 0, 0, 'F');

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.white);
      doc.text("RAPPORT D'AUDIT", pageWidth / 2, 100, { align: 'center' });
      doc.setFontSize(13);
      doc.text('TECHNIQUE & STRATÉGIQUE', pageWidth / 2, 110, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 180, 200);

      const today = new Date();
      const dateStr = today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(`Date : ${dateStr}`, pageWidth / 2, 135, { align: 'center' });
      doc.text('Document confidentiel', pageWidth / 2, 142, { align: 'center' });

      doc.setFillColor(...colors.primary);
      doc.roundedRect(margin, pageHeight - 50, contentWidth, 30, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(...colors.white);
      doc.text('Plateforme de cashback pour le commerce local français', pageWidth / 2, pageHeight - 38, { align: 'center' });
      doc.text(`${allMerchants.length} commerçants | ${clients.length} clients | ${allTransactions.length} transactions`, pageWidth / 2, pageHeight - 31, { align: 'center' });

      // ===== SOMMAIRE =====
      doc.addPage();
      y = 30;
      doc.setFillColor(...colors.dark);
      doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setTextColor(...colors.white);
      doc.setFont('helvetica', 'bold');
      doc.text('SOMMAIRE', pageWidth / 2, y + 8.5, { align: 'center' });
      y += 22;

      const sommaire = [
        { num: '1', title: 'Présentation du projet REV', page: '3' },
        { num: '2', title: 'Architecture technique', page: '4' },
        { num: '3', title: 'Fonctionnalités implémentées', page: '5' },
        { num: '4', title: 'Points positifs', page: '7' },
        { num: '5', title: 'Points négatifs & axes d\'amélioration', page: '8' },
        { num: '6', title: 'Développements futurs planifiés', page: '9' },
        { num: '7', title: 'Analyse du modèle économique', page: '10' },
        { num: '8', title: 'Avis général & recommandations', page: '11' },
      ];

      for (const item of sommaire) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.primary);
        doc.text(`${item.num}.`, margin + 5, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.dark);
        doc.text(item.title, margin + 14, y);
        doc.setTextColor(...colors.text);
        const dots = '.'.repeat(80);
        const titleW = doc.getTextWidth(item.title);
        doc.setFontSize(8);
        doc.text(dots, margin + 14 + titleW + 2, y, { maxWidth: contentWidth - 30 - titleW });
        doc.setFontSize(11);
        doc.text(item.page, pageWidth - margin - 5, y, { align: 'right' });
        y += 10;
      }

      // ===== 1. PRÉSENTATION DU PROJET =====
      doc.addPage();
      y = 25;
      addSectionTitle('PRÉSENTATION DU PROJET REV', '1');

      addSubTitle('Vision');
      addParagraph("REV (Retour En Ville) est une plateforme de fidélisation par cashback conçue spécifiquement pour le commerce de proximité français. Elle permet aux consommateurs d'accumuler du cashback lors de leurs achats chez les commerçants partenaires, créant ainsi un écosystème vertueux de fidélisation locale.");

      addSubTitle('Marché cible');
      addParagraph("Le marché cible principal est constitué des commerces de proximité en France : boulangeries, restaurants, boutiques de vêtements, salons de coiffure, et tout commerce local souhaitant fidéliser sa clientèle face à la concurrence des grandes surfaces et du e-commerce.");

      addSubTitle('Modèle économique');
      addBullet("Le client reçoit 10% de cashback sur chaque achat chez un commerçant partenaire");
      addBullet("Le commerçant paie une commission de 13% sur chaque transaction (10% cashback + 3% frais REV)");
      addBullet("Le cashback est bloqué pendant 7 jours avant d'être utilisable (protection anti-fraude)");
      addBullet("Le cashback est transférable entre utilisateurs via le code REVid unique");
      addBullet("Les Bons Plans permettent aux commerçants de créer des promotions temporaires facturées séparément");
      addBullet("Les cartes cadeaux sont achetables via Stripe ou PayPal avec une période de déblocage de 7 jours");

      addSubTitle('Proposition de valeur');
      addParagraph("Pour les commerçants : un outil de fidélisation clé en main, sans investissement matériel, avec un tableau de bord analytique complet. Pour les clients : un système de récompenses transparent et interopérable entre tous les commerçants du réseau.");

      // ===== 2. ARCHITECTURE TECHNIQUE =====
      doc.addPage();
      y = 25;
      addSectionTitle('ARCHITECTURE TECHNIQUE', '2');

      addSubTitle('Stack technologique');
      addBullet("Frontend : React 18 + TypeScript + Tailwind CSS + shadcn/ui (40+ composants UI)");
      addBullet("Backend : Express.js + TypeScript (API RESTful)");
      addBullet("Base de données : PostgreSQL avec Drizzle ORM + Zod (validation)");
      addBullet("Authentification : Replit OpenID Connect (OIDC) + Passport.js");
      addBullet("Temps réel : Socket.IO pour les mises à jour instantanées");
      addBullet("Paiements : Stripe + PayPal (double intégration)");
      addBullet("Build : Vite (développement) + esbuild (production)");

      addSubTitle('Métriques du code');
      addKPI('Nombre total de fichiers source', '120+');
      addKPI('Lignes de code (TypeScript/TSX)', '19 350+');
      addKPI('Tables en base de données', '19');
      addKPI('Endpoints API REST', '70+');
      addKPI('Composants React', '50+');
      addKPI('Pages applicatives', '7');

      addSubTitle('Schéma de la base de données');
      addParagraph("La base de données PostgreSQL comprend 19 tables couvrant l'ensemble des besoins métier :");

      const dbTables = [
        ['users', 'Comptes utilisateurs avec rôles (client/commerçant/admin)'],
        ['merchants', 'Profils commerçants avec SIRET, IBAN, coordonnées'],
        ['transactions', 'Enregistrement des achats avec calcul automatique du cashback'],
        ['cashback_balances', 'Soldes cashback par utilisateur et par commerçant'],
        ['cashback_entries', 'Historique détaillé des gains/dépenses cashback'],
        ['cashback_transfers', 'Transferts de cashback entre utilisateurs (P2P)'],
        ['promotions', 'Bons Plans créés par les commerçants'],
        ['recurring_promotions', 'Promotions récurrentes automatiques'],
        ['merchant_billings', 'Factures bimensuelles des commerçants'],
        ['gift_cards', 'Catalogue de cartes cadeaux disponibles'],
        ['gift_card_purchases', 'Achats de cartes cadeaux (Stripe/PayPal)'],
        ['gift_card_balances', 'Soldes de cartes cadeaux par utilisateur'],
        ['gift_card_transfers', 'Transferts de cartes cadeaux entre utilisateurs'],
        ['notifications', 'Système de notifications en temps réel'],
        ['merchant_categories', 'Catégories de commerçants personnalisables'],
        ['user_favorites', 'Commerçants favoris des clients'],
        ['audit_logs', 'Journal d\'audit des actions administratives'],
        ['merchant_goals', 'Objectifs de vente mensuels des commerçants'],
        ['sessions', 'Sessions d\'authentification persistantes'],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [['Table', 'Description']],
        body: dbTables,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2, textColor: colors.text },
        headStyles: { fillColor: colors.primary, textColor: colors.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ===== 3. FONCTIONNALITÉS IMPLÉMENTÉES =====
      doc.addPage();
      y = 25;
      addSectionTitle('FONCTIONNALITÉS IMPLÉMENTÉES', '3');

      addSubTitle('Espace Client');
      addBullet("Inscription et connexion sécurisée via OIDC", '✓', colors.green);
      addBullet("Génération automatique d'un code REVid unique (format REVid-XXXXXX)", '✓', colors.green);
      addBullet("QR Code personnel pour identification rapide en magasin", '✓', colors.green);
      addBullet("Tableau de bord avec solde cashback disponible et en attente", '✓', colors.green);
      addBullet("Historique complet des transactions et du cashback", '✓', colors.green);
      addBullet("Transfert de cashback entre utilisateurs via REVid (P2P)", '✓', colors.green);
      addBullet("Découverte des commerçants partenaires avec filtres", '✓', colors.green);
      addBullet("Consultation des Bons Plans (promotions commerçants)", '✓', colors.green);
      addBullet("Achat de cartes cadeaux (Stripe & PayPal)", '✓', colors.green);
      addBullet("Transfert de cartes cadeaux entre utilisateurs", '✓', colors.green);
      addBullet("Système de notifications en temps réel", '✓', colors.green);
      addBullet("Compte à rebours de déblocage du cashback (7 jours)", '✓', colors.green);
      addBullet("Commerçants favoris avec sauvegarde", '✓', colors.green);
      addBullet("Partage du code REVid", '✓', colors.green);
      addBullet("Mode sombre / clair", '✓', colors.green);
      addBullet("Vérification de l'âge minimum (16 ans)", '✓', colors.green);

      addSubTitle('Espace Commerçant');
      addBullet("Scan QR Code client via caméra intégrée", '✓', colors.green);
      addBullet("Saisie et validation des transactions", '✓', colors.green);
      addBullet("Annulation de transaction (fenêtre de 2 heures)", '✓', colors.green);
      addBullet("Tableau de bord analytique avec graphiques (Recharts)", '✓', colors.green);
      addBullet("Création et gestion de promotions (Bons Plans)", '✓', colors.green);
      addBullet("Promotions récurrentes automatiques", '✓', colors.green);
      addBullet("Consultation des factures bimensuelles", '✓', colors.green);
      addBullet("Export PDF des statistiques", '✓', colors.green);
      addBullet("Définition d'objectifs de vente mensuels", '✓', colors.green);
      addBullet("Consultation du cashback client avant transaction", '✓', colors.green);

      addSubTitle('Espace Administrateur');
      addBullet("Gestion complète des commerçants (CRUD)", '✓', colors.green);
      addBullet("Gestion des catégories de commerçants", '✓', colors.green);
      addBullet("Suivi des commissions (collectées et en attente)", '✓', colors.green);
      addBullet("Gestion des Bons Plans de tous les commerçants", '✓', colors.green);
      addBullet("Gestion du catalogue de cartes cadeaux", '✓', colors.green);
      addBullet("Analytics cartes cadeaux (ventes, revenus)", '✓', colors.green);
      addBullet("Génération et suivi des factures bimensuelles", '✓', colors.green);
      addBullet("KPIs globaux de la plateforme (GMV, ARPU)", '✓', colors.green);
      addBullet("Détection de fraude (transferts suspects)", '✓', colors.green);
      addBullet("Vérification de conformité commerçants (SIRET, IBAN)", '✓', colors.green);
      addBullet("Journal d'audit des actions", '✓', colors.green);
      addBullet("Graphiques d'évolution du CA et CA par commerçant", '✓', colors.green);
      addBullet("Tableau de bord responsive (mobile & desktop)", '✓', colors.green);

      addSubTitle('Sécurité & Infrastructure');
      addBullet("Authentification OIDC avec refresh automatique des tokens", '✓', colors.green);
      addBullet("Sessions persistantes en PostgreSQL", '✓', colors.green);
      addBullet("Rate limiting (100 requêtes/15 min par IP)", '✓', colors.green);
      addBullet("Content Security Policy stricte (Helmet)", '✓', colors.green);
      addBullet("Validation des entrées avec Zod", '✓', colors.green);
      addBullet("Contrôle d'accès basé sur les rôles (RBAC)", '✓', colors.green);
      addBullet("Période de blocage cashback 7 jours (anti-fraude)", '✓', colors.green);

      // ===== 4. POINTS POSITIFS =====
      doc.addPage();
      y = 25;
      addSectionTitle('POINTS POSITIFS', '4');

      addSubTitle('Architecture & Qualité du code');
      addBullet("Architecture full-stack TypeScript garantissant la cohérence des types entre frontend et backend — réduction significative des bugs en production");
      addBullet("Utilisation de Drizzle ORM avec validation Zod : schéma de données partagé et validé à chaque couche applicative");
      addBullet("Séparation claire des responsabilités : routes API minces, logique métier dans la couche storage, composants React modulaires");
      addBullet("Plus de 50 composants React réutilisables basés sur Radix UI / shadcn — bibliothèque d'interface accessible et cohérente");
      addBullet("Code source structuré et maintenable : 120+ fichiers bien organisés par domaine fonctionnel");

      addSubTitle('Sécurité');
      addBullet("Sécurité multicouche : OIDC + rate limiting + CSP + RBAC + validation Zod — approche défense en profondeur");
      addBullet("Système anti-fraude avec période de blocage de 7 jours et détection automatique de transferts suspects (3+ transferts/jour ou >100€)");
      addBullet("Journal d'audit complet traçant les actions administratives avec adresses IP");
      addBullet("Vérification de conformité automatisée (SIRET, IBAN, email, téléphone) pour les commerçants");

      addSubTitle('Modèle économique');
      addBullet("Modèle de revenus clair et viable : commission de 3% nette par transaction après redistribution du cashback");
      addBullet("Double source de revenus : commissions sur transactions + facturation des promotions (Bons Plans)");
      addBullet("Système de cartes cadeaux ajoutant une troisième source de revenus");
      addBullet("Facturation bimensuelle automatisée avec génération PDF professionnelle");

      addSubTitle('Expérience utilisateur');
      addBullet("Interface responsive fonctionnelle sur mobile et desktop — essentiel pour l'usage en commerce");
      addBullet("Mode sombre et clair adaptatif");
      addBullet("Notifications temps réel via Socket.IO — engagement utilisateur renforcé");
      addBullet("Scan QR code intégré pour les commerçants — pas d'équipement supplémentaire nécessaire");
      addBullet("Double intégration de paiement (Stripe + PayPal) — maximise la conversion d'achat");

      addSubTitle('Scalabilité');
      addBullet("PostgreSQL comme base de données principale — robuste et adapté à la montée en charge");
      addBullet("Architecture API REST standardisée — facilement extensible et documentable");
      addBullet("70+ endpoints API couvrant l'ensemble des besoins métier actuels et futurs proches");

      // ===== 5. POINTS NÉGATIFS =====
      doc.addPage();
      y = 25;
      addSectionTitle("POINTS NÉGATIFS & AXES D'AMÉLIORATION", '5');

      addSubTitle('Tests & Qualité');
      addBullet("Absence de tests automatisés (unitaires, intégration, E2E) — risque de régression lors des mises à jour", '✗', colors.red);
      addBullet("Pas de pipeline CI/CD — les déploiements manuels augmentent le risque d'erreur humaine", '✗', colors.red);
      addBullet("Documentation API absente (pas de Swagger/OpenAPI) — frein à l'intégration de partenaires techniques", '✗', colors.red);

      addSubTitle('Infrastructure');
      addBullet("Dépendance à Replit pour l'hébergement et l'authentification — à terme, migration vers une infrastructure indépendante nécessaire", '!', colors.orange);
      addBullet("Pas de système de backup automatique de la base de données — risque de perte de données en cas d'incident", '!', colors.orange);
      addBullet("Pas de monitoring APM (Application Performance Monitoring) en production — détection des problèmes réactive plutôt que proactive", '!', colors.orange);
      addBullet("Pas de CDN configuré pour les assets statiques — performance d'affichage non optimale", '!', colors.orange);

      addSubTitle('Fonctionnel');
      addBullet("Géolocalisation et carte interactive des commerçants non encore implémentées — fonctionnalité attendue par les utilisateurs", '!', colors.orange);
      addBullet("Pas de système de recherche avancée de commerçants (recherche textuelle, tri par distance)", '!', colors.orange);
      addBullet("Pas d'application mobile native — l'application web responsive est fonctionnelle mais une PWA ou app native améliorerait l'expérience", '!', colors.orange);
      addBullet("Système d'emailing non intégré — pas de relances automatiques ni de confirmations par email", '!', colors.orange);

      addSubTitle('Conformité réglementaire');
      addBullet("RGPD : politique de confidentialité et consentement cookies à formaliser", '!', colors.orange);
      addBullet("CGU/CGV : conditions générales à rédiger et intégrer", '!', colors.orange);
      addBullet("PCI-DSS : les paiements sont délégués à Stripe/PayPal (conforme), mais la documentation de conformité manque", '!', colors.orange);

      // ===== 6. DÉVELOPPEMENTS FUTURS =====
      doc.addPage();
      y = 25;
      addSectionTitle('DÉVELOPPEMENTS FUTURS PLANIFIÉS', '6');

      addParagraph("18 fonctionnalités sont planifiées et organisées par priorité. Ces développements représentent la feuille de route technique des prochains mois.");

      addSubTitle('Priorité haute — Expérience client');
      addBullet("Recherche de commerçants avec carte interactive et filtres géographiques (en cours de développement)");
      addBullet("Historique détaillé du cashback avec traçabilité de l'origine");
      addBullet("Compte à rebours de déblocage cashback et cartes cadeaux amélioré");
      addBullet("Alertes promotions pour les commerçants favoris");
      addBullet("Partage social du code REVid (WhatsApp, SMS, réseaux sociaux)");

      addSubTitle('Priorité haute — Outils commerçants');
      addBullet("Tableau de bord analytique avancé avec graphiques de performance");
      addBullet("Suivi de performance des promotions (vues, taux de conversion)");
      addBullet("Liste des clients fidèles avec historique de fréquentation");
      addBullet("Promotions récurrentes automatisées (jours de la semaine configurables)");
      addBullet("Export de données CSV/PDF complet");
      addBullet("Prévision de facturation et comparaison inter-périodes");

      addSubTitle('Priorité moyenne — Administration');
      addBullet("KPIs globaux avancés (GMV, ARPU, taux de croissance, rétention)");
      addBullet("Système de détection de fraude renforcé avec alertes automatiques");
      addBullet("Workflow d'approbation pour vérification de conformité commerçants");
      addBullet("Gestion avancée des catégories et rapprochement des paiements");
      addBullet("Export comptable et journal d'audit détaillé");
      addBullet("Tableau de bord temps réel avec WebSocket");

      // ===== 7. ANALYSE DU MODÈLE ÉCONOMIQUE =====
      doc.addPage();
      y = 25;
      addSectionTitle('ANALYSE DU MODÈLE ÉCONOMIQUE', '7');

      addSubTitle('Structure des revenus actuelle');
      addParagraph("Le modèle de revenus de REV repose sur trois piliers principaux :");
      addBullet("Commission sur transactions : 3% net par transaction (13% facturé au commerçant dont 10% redistribué en cashback au client)");
      addBullet("Facturation des promotions (Bons Plans) : facturée hebdomadairement aux commerçants participants");
      addBullet("Cartes cadeaux : marge sur la vente de cartes cadeaux via Stripe et PayPal");

      addSubTitle('Données actuelles de la plateforme');
      addKPI('Nombre de commerçants actifs', String(allMerchants.filter(m => m.isActive).length));
      addKPI('Nombre de clients inscrits', String(clients.length));
      addKPI('Nombre total de transactions', String(allTransactions.length));
      addKPI('Volume total des ventes (GMV)', `${totalSales.toFixed(2)} €`);
      addKPI('Total cashback distribué', `${totalCashback.toFixed(2)} €`);
      addKPI('Total commissions générées', `${totalCommissions.toFixed(2)} €`);
      addKPI('Revenu net REV (commission 3%)', `${(totalCommissions - totalCashback).toFixed(2)} €`);
      addKPI('Nombre de factures générées', String(allBillings.length));

      addSubTitle('Projections de croissance');
      addParagraph("Hypothèses de projection basées sur un déploiement progressif dans une ville moyenne française :");

      const projections = [
        ['Indicateur', '6 mois', '12 mois', '24 mois'],
        ['Commerçants partenaires', '20', '50', '150'],
        ['Clients actifs', '500', '2 000', '8 000'],
        ['Transactions/mois', '2 000', '10 000', '50 000'],
        ['GMV mensuel', '40 000 €', '200 000 €', '1 000 000 €'],
        ['Revenu mensuel REV (3%)', '1 200 €', '6 000 €', '30 000 €'],
        ['Revenu annuel projeté', '14 400 €', '72 000 €', '360 000 €'],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [projections[0]],
        body: projections.slice(1),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3, textColor: colors.text },
        headStyles: { fillColor: colors.primary, textColor: colors.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        columnStyles: { 0: { fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      addParagraph("Ces projections sont conservatrices et supposent un panier moyen de 20€ par transaction. Le modèle est scalable : chaque nouveau commerçant attire ses propres clients dans le réseau, créant un effet de réseau vertueux.");

      // ===== 8. AVIS GÉNÉRAL =====
      doc.addPage();
      y = 25;
      addSectionTitle('AVIS GÉNÉRAL & RECOMMANDATIONS', '8');

      addSubTitle('Niveau de maturité du projet');
      addParagraph("REV se situe au stade de MVP (Minimum Viable Product) avancé. L'ensemble des fonctionnalités critiques pour un lancement commercial sont opérationnelles : gestion des transactions, calcul et distribution du cashback, paiements en ligne, administration de la plateforme, et tableau de bord commerçant.");
      addParagraph("Le code source, avec ses 19 350+ lignes de TypeScript, représente un investissement technique significatif. L'architecture choisie (React + Express + PostgreSQL) est un standard de l'industrie, garantissant la pérennité de la solution et la facilité de recrutement de développeurs.");

      addSubTitle('Forces principales');
      addBullet("Le modèle économique est simple, transparent et viable — la commission de 3% est compétitive par rapport aux solutions de fidélisation traditionnelles (cartes de fidélité papier, programmes propriétaires)");
      addBullet("L'aspect réseau (cashback transférable, cartes cadeaux partageables) crée un effet viral organique — chaque utilisateur devient ambassadeur du réseau");
      addBullet("La sécurité a été pensée dès la conception — ce qui est souvent un point faible des MVP");
      addBullet("L'interface est fonctionnelle et professionnelle — prête pour des démonstrations commerciales");

      addSubTitle('Risques identifiés');
      addBullet("Risque technique : l'absence de tests automatisés pourrait ralentir les évolutions — à corriger dès la première levée de fonds", '!', colors.orange);
      addBullet("Risque commercial : l'acquisition des premiers commerçants partenaires est l'enjeu majeur — le produit doit être démontré en conditions réelles", '!', colors.orange);
      addBullet("Risque réglementaire : la conformité RGPD et les CGU doivent être formalisées avant le lancement commercial", '!', colors.orange);
      addBullet("Risque de dépendance : la migration hors de Replit devra être planifiée pour la phase de croissance", '!', colors.orange);

      addSubTitle('Recommandations');
      addBullet("Phase 1 (0-3 mois) : Lancer un pilote avec 5-10 commerçants dans un quartier ou une ville — valider le product-market fit");
      addBullet("Phase 2 (3-6 mois) : Ajouter les tests automatisés, la documentation API, et les fonctionnalités clients prioritaires (carte interactive, alertes)");
      addBullet("Phase 3 (6-12 mois) : Migrer vers une infrastructure cloud indépendante (AWS/GCP), développer une application mobile native");
      addBullet("Phase 4 (12-24 mois) : Expansion géographique, partenariats avec les CCI et associations de commerçants");

      addSubTitle('Conclusion');
      addParagraph("REV est un projet techniquement solide, avec un modèle économique cohérent et une exécution de qualité pour un MVP. La plateforme est fonctionnelle et prête pour une phase pilote commerciale. Les axes d'amélioration identifiés (tests, documentation, conformité) sont classiques pour ce stade de développement et ne constituent pas des blocages — ils font partie de la feuille de route naturelle de maturation du produit.");
      addParagraph("L'investissement technique réalisé (19 tables, 70+ APIs, double intégration de paiement, système anti-fraude) positionne REV comme une solution sérieuse et crédible pour le marché de la fidélisation du commerce local en France.");

      addPageFooter();

      const pdfBuffer = doc.output('arraybuffer');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=REV_Rapport_Audit_${today.toISOString().split('T')[0]}.pdf`);
      res.send(Buffer.from(pdfBuffer));

    } catch (error) {
      console.error("Error generating audit report PDF:", error);
      res.status(500).json({ message: "Failed to generate audit report" });
    }
  });

  // ==================== CASHBACK ENTRIES (for unlock countdown) ====================

  // Get pending cashback entries with unlock dates
  app.get('/api/cashback/pending-entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getCashbackEntriesByUser(userId);
      const pendingEntries = entries.filter(e => e.status === 'pending');
      res.json(pendingEntries);
    } catch (error) {
      console.error("Error fetching pending entries:", error);
      res.status(500).json({ message: "Failed to fetch pending entries" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

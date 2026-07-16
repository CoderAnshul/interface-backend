// routes/ticketRoutes.js
import express from 'express';
import { 
  createTicket, 
  getTicketById, 
  getAllTickets, 
  getPartnerTickets,
  updateTicket, 
  deleteTicket,
  addMessage,
  getMyTickets,
  updateTicketStatus,
  getMyResolvedTickets
} from '../controllers/TicketController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js';

const ticketRouter = express.Router();

// Create a support ticket (authenticated users)
ticketRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
//   upload.fields([{ name: 'attachments', maxCount: 5 }]),
upload.any(),

  createTicket
);

ticketRouter.get(
  '/my-resolved-tickets',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getMyResolvedTickets
);

// Get all tickets (admin only)
ticketRouter.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllTickets
);

// Partner — get tickets for users referred by this partner
ticketRouter.get(
  '/partner',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getPartnerTickets
);

// Get my tickets (authenticated users)
ticketRouter.get(
  '/my-tickets',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getMyTickets
);

// Get a ticket by ID (owner or admin)
ticketRouter.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getTicketById
);

// Update a ticket (owner or admin)
ticketRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  updateTicket
);

// Update ticket status (admin only)
ticketRouter.patch(
  '/:id/status',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateTicketStatus
);

// Add message to ticket (owner or admin)
ticketRouter.post(
  '/:id/messages',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  upload.any(),
  addMessage
);

// Delete a ticket (soft delete - admin only)
ticketRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteTicket
);



export default ticketRouter;
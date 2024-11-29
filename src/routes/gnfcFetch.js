const express = require('express');
const router = express.Router();
const gnfcController = require('../controllers/gnfcFetch');
const { ensureAuthenticated } = require('../config/auth');

/**
 * @swagger
 * /api/leaser:
 *   post:
 *     summary: Leaser list
 *     description: API to list leaser
 *     tags: [GNFC POC]
 *     responses:
 *       '200':
 *         description: Successful list fetch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (SUCCESS).
 *                 message:
 *                   type: string
 *                   description: Result message (Admin Logged out successfully).
 *       '401':
 *         description: Invalid or Missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                   description: false.
 *                 message:
 *                   type: string
 *                   example: Unauthorized access. No token provided / Unauthorized access. Invalid token
 *                            format.
 *                   description: Unauthorized access. No token provided.
 *       '500':
 *         description: An error occurred during logout
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (FAILED).
 *                 message:
 *                   type: string
 *                   description: Result message (An error occurred during logout).
 */

router.get('/leaser', gnfcController.leaserList);

// /**
//  * @swagger
//  * /api/leaser:
//  *   post:
//  *     summary: Leaser list
//  *     description: API to list leaser
//  *     tags: [GNFC POC]
//  *     responses:
//  *       '200':
//  *         description: Successful list fetch
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: string
//  *                   description: Status of the operation (SUCCESS).
//  *                 message:
//  *                   type: string
//  *                   description: Result message (Admin Logged out successfully).
//  *       '401':
//  *         description: Invalid or Missing token
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: boolean
//  *                   example: false
//  *                   description: false.
//  *                 message:
//  *                   type: string
//  *                   example: Unauthorized access. No token provided / Unauthorized access. Invalid token
//  *                            format.
//  *                   description: Unauthorized access. No token provided.
//  *       '500':
//  *         description: An error occurred during logout
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: string
//  *                   description: Status of the operation (FAILED).
//  *                 message:
//  *                   type: string
//  *                   description: Result message (An error occurred during logout).
//  */

// Royalty pass list based on lease id
router.get(
  '/royalty-pass/:leaserId',
  gnfcController.royaltyPassList
);

// Delivery challan list based on royalty pass
router.get(
  '/delivery-challan/:royaltyPassNo',
  gnfcController.deliveryChallanList
);

// Whole track record based on delivery challan
router.get(
  '/whole-record/:deliveryChallan',
  gnfcController.wholeTracker
);

module.exports = router;
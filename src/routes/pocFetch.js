const express = require('express');
const router = express.Router();
const pocController = require('../controllers/pocFetch');

/**
 * @swagger
 * /api/get-royalty-pass:
 *   post:
 *     summary: API to fetch royalty pass details (royaltyPassNo)
 *     description: API to fetch royalty pass details (royaltyPassNo).
 *     tags: [GNFC/FETCH]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               royaltyPassNo:
 *                 type: string
 *                 description: Provide royaltyPassNo
 *     responses:
 *       '200':
 *         description: All fetch royalty pass details successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 details:
 *                   type: array
 *                   items:
 *                     [Issuers Log Details]
 *                 message:
 *                   type: string
 *                   example: All fetch royalty pass details successfully
 *       '400':
 *         description: Bad request or Invalid code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: royalty pass not found (or) Bad request!
 *             example:
 *               code: 400.
 *               status: "FAILED"
 *               message: royalty pass not found (or) Bad request!
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred while fetching issues details
 *             example:
 *               code: 500.
 *               status: "FAILED"
 *               message: Internal server error.
 */

router.post('/get-royalty-pass', pocController.getRoyaltyPassData);

/**
 * @swagger
 * /api/get-delivery-challan:
 *   post:
 *     summary: API to fetch delivery challan details (deliveryNo)
 *     description: API to fetch delivery challan details (deliveryNo).
 *     tags: [GNFC/FETCH]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deliveryNo:
 *                 type: string
 *                 description: Provide deliveryNo
 *     responses:
 *       '200':
 *         description: All fetch delivery challan details successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 details:
 *                   type: array
 *                   items:
 *                     [Issuers Log Details]
 *                 message:
 *                   type: string
 *                   example: All fetch delivery challan details successfully
 *       '400':
 *         description: Bad request or Invalid code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: delivery challan not found (or) Bad request!
 *             example:
 *               code: 400.
 *               status: "FAILED"
 *               message: delivery challan not found (or) Bad request!
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred while fetching issues details
 *             example:
 *               code: 500.
 *               status: "FAILED"
 *               message: Internal server error.
 */

router.post('/get-delivery-challan', pocController.getDeliveryChallanData);

module.exports=router;
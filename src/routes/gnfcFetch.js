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
router.get('/royalty-pass/:leaserId', gnfcController.royaltyPassList);

// Delivery challan list based on royalty pass
router.get(
  '/delivery-challan/:royaltyPassNo',
  gnfcController.deliveryChallanList
);

// Whole track record based on delivery challan
router.get('/whole-record/:deliveryChallan', gnfcController.wholeTracker);

//Daily royalty pass issuance counter
router.get('/daily-royalty-pass/report', gnfcController.royaltyPassDailyReport);

//Weekly royalty pass issuance counter
router.get(
  '/weekly-royalty-pass/report',
  gnfcController.royaltyPassWeeklyReport
);

//monthly royalty pass issuance counter
router.get(
  '/monthly-royalty-pass/report',
  gnfcController.royaltyPassMonthlyReport
);

//annual royalty pass issuance counter
router.get(
  '/annual-royalty-pass/report',
  gnfcController.royaltyPassAnnualReport
);

//Daily delivery challan issuance counter
router.get(
  '/daily-delivery-challan/report',
  gnfcController.deliveryChallanDailyReport
);

//Weekly delivery challan issuance counter
router.get(
  '/weekly-delivery-challan/report',
  gnfcController.deliveryChallanWeeklyReport
);

//monthly delivery challan issuance counter
router.get(
  '/monthly-delivery-challan/report',
  gnfcController.deliveryChallanMonthlyReport
);

//annual delivery challan issuance counter
router.get(
  '/annual-delivery-challan/report',
  gnfcController.deliveryChallanAnnualReport
);

// To generate Royalty Pass PDF
router.get(
  '/verification-pdf/royalty-pass/:royaltyPassNo',
  gnfcController.generateRoyaltyPassVerificationPDF
);

// To generate Delivery challan PDF
router.get(
  '/verification-pdf/delivery-challan/:deliveryChallan',
  gnfcController.generateDeliveryChallanVerificationPDF
);

// To generate Whole record PDF based on delivery challan
router.get(
  '/verification-pdf/whole-record/:deliveryChallan',
  gnfcController.generateWholeRecordVerificationPDF
);

module.exports = router;

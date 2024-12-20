const express = require('express');
const router = express.Router();
const pocController = require('../controllers/jgpoc');
const multer = require('multer');

const __upload = multer({dest: "./uploads/"});

/**
 * @swagger
 * /api/jg-issuance:
 *   post:
 *     summary: API call for issuing batch certificates (JG Issuance).
 *     description: API call for issuing batch certificates (JG POC) with Request Data Extraction, Validation Checks, Excel Data Processing, Blockchain Processing, Certificate Issuance, Response Handling, Excel File Processing, Blockchain Verification, Merkle Tree Generation, QR Code Integration, Database Interaction, Error Handling and Asynchronous Operation. 
 *     tags: [JG POC]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               excelFile:
 *                 type: string
 *                 format: binary
 *                 description: Excel file to be uploaded. Must not be blank.
 *             required:
 *               - email
 *               - excelFile
 *     responses:
 *       '200':
 *         description: JG Batch issuance successful
 *         content:
 *           application/json:
 *             example:
 *               code: 200.
 *               status: "SUCCESS"
 *               message: Batch of Certificates issued successfully
 *               details:
 *                 - Serial: SN121323
 *                   IssueDate: 2024-29-12T07:57:45.121Z
 *                   transactionHash: abc232139233bacd
 *                   certificateHash: 122113523AB
 *                   issuer: jgu.certs365.io
 *                   issuerId: OXabc231321638253cde
 *                   blockchain: www.polygon.com/tx/abc232139233bacd
 *                   QRCode: rewrewr34242423
 *                   Name: Hiren Patel
 *                   EnrollmentNo: ENI32132
 *                   Programme: Computer Science
 *                 - Serial: SN121324
 *                   IssueDate: 2024-29-12T07:57:45.121Z
 *                   transactionHash: abc232139233bac4
 *                   certificateHash: 122113523AC
 *                   issuer: jgu.certs365.io
 *                   issuerId: OXabc231321638253cd4
 *                   blockchain: www.polygon.com/tx/abc232139233bac4
 *                   QRCode: rewrewr34242424
 *                   Name: Vedansh Dutta
 *                   EnrollmentNo: ENI32134
 *                   Programme: Computer Science
 *                 # Add more certifications details if needed
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               code: 400.
 *               status: "FAILED"
 *               message: Please provide valid JG Certification(Batch) details.
 *       '401':
 *         description: Unauthorized Aceess / No token provided.
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
 *                   description: Unauthorized access. No token provided.
 *             example:
 *               code: 401.
 *               status: "FAILED"
 *               message: Unauthorized access. No token provided.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               code: 500.
 *               status: "FAILED"
 *               error: Internal Server Error
*/
router.post('/jg-issuance', __upload.single("excelFile"), pocController.jgIssuance);

/**
 * @swagger
 * /api/jg-upload:
 *   post:
 *     summary: Upload a file to AWS S3 bucket (JG Issue)
 *     description: API to Upload a file to AWS (Provider) S3 bucket
 *     tags: [JG POC]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The Enrollment ID.
 *               file:
 *                 type: string
 *                 format: binary
 *             required:
 *                -id
 *                -file
 *     responses:
 *       '200':
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Confirmation message
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
router.post('/jg-upload',__upload.single('file'), pocController.jgUpload);

/**
 * @swagger
 * /api/jg-verify:
 *   post:
 *     summary: Verify provided Enrollment ID (JG POC)
 *     description: API call for verify Enrollment ID (JG POC)
 *     tags: [JG POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The Enrollment ID (JG POC).
 *             required:
 *               - id
 *     responses:
 *       '200':
 *         description: Successfully verified
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
 *                   description: Result message Enrollment ID (JG POC).
 *                 details:
 *                   type: string[]
 *                   description: Result data.
 *       '400':
 *         description: Invalid input or empty id
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
 *                   description: Result message (Empty id supplied).
 *       '500':
 *         description: An error occurred during login
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
 *                   description: Result message (An error occurred during verification).
 */
router.post('/jg-verify', pocController.jgVerify);

module.exports=router;
const express = require('express');
const router = express.Router();
const gnfcController = require('../controllers/gnfc');
const validationRoute = require("../common/validationRoutes");

/**
 * @swagger
 * /api/user-login:
 *   post:
 *     summary: Authenticate user login
 *     description: API to Login GNFC Portal
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *               role:
 *                 type: string
 *                 description: The role ( Admin / Leaser / Stockist ) of the user.
 *               password:
 *                 type: string
 *                 description: The password for user authentication.
 *             required:
 *               - email
 *               - role
 *               - password
 *     responses:
 *       '200':
 *         description: Successful login
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
 *                   description: Result message (Valid User Credentials).
 *       '400':
 *         description: Invalid input or empty credentials
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
 *                   description: Result message (Empty credentials supplied).
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
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
 *               status: "FAILED"
 *               message: Error message for invalid input.
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
 *                   description: Result message (An error occurred during login).
 */

router.post('/user-login', validationRoute.login , gnfcController.login);

/**
 * @swagger
 * /api/user-signup:
 *   post:
 *     summary: Create a new user account
 *     description: API to Create a new user account Role (Admin / Leaser / Stockist), RoleId as unique ID
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's name
 *               email:
 *                 type: string
 *                 description: User's email address
 *               role:
 *                 type: string
 *                 description: User's role ( Admin / Leaser / Stockist )
 *               roleId:
 *                 type: string
 *                 description: User's roleId ( Admin / Leaser / Stockist )
 *               password:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       '200':
 *         description: User Signup successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: User Signup successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *                     userId:
 *                       type: string
 *                       example: 123456789
 *                     approved:
 *                       type: boolean
 *                       example: false
 *       '400':
 *         description: Bad request or empty input fields
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
 *                   example: Empty input fields! or Invalid name entered or Invalid email entered or Password is too short!
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
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
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '409':
 *         description: Admin with the provided email already exists
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
 *                   example: Admin with the provided email already exists
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
 *                   example: An error occurred
 */

router.post('/user-signup', validationRoute.signUp, gnfcController.signup);

/**
 * @swagger
 * /api/user-logout:
 *   post:
 *     summary: Logout user
 *     description: API to Logout User
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *               role:
 *                 type: string
 *                 description: The role ( Leaser / Stockist / Distributor / Retailor / Company ) of the user.
 *             required:
 *               - email
 *               - role
 *     responses:
 *       '200':
 *         description: Successful logout
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
 *       '400':
 *         description: Invalid input or admin not found
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
 *                   description: Result message (Admin not found or Not Logged in).
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
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
 *               status: "FAILED"
 *               message: Error message for invalid input.
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

router.post('/user-logout', validationRoute.emailCheck, gnfcController.logout);

/**
 * @swagger
 * /api/issue-royalty-pass:
 *   post:
 *     summary: Create a new Royalty pass
 *     description: API to Create a new Royalty pass
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Enter valid User email
 *               royaltyPassNo:
 *                 type: string
 *                 description: Enter valid royaltyPassNo
 *               leaserId:
 *                 type: string
 *                 description: Enter valid leaserId
 *               issuedDate:
 *                 type: string
 *                 description: Enter valid issued Date
 *               leaseValidUpto:
 *                 type: string
 *                 description: Enter valid leaseValidUpto
 *               SSPNumber:
 *                 type: string
 *                 description: Enter valid SSPNumber
 *               village:
 *                 type: string
 *                 description: Enter valid village
 *               taluke:
 *                 type: string
 *                 description: Enter valid taluke
 *               district:
 *                 type: string
 *                 description: Enter valid district
 *               mineralName:
 *                 type: string
 *                 description: Enter valid mineralName
 *               mineralGrade:
 *                 type: string
 *                 description: Enter valid mineralGrade
 *               initialQuantatity:
 *                 type: number
 *                 description: Enter valid initialQuantatity
 *               journeyStartDate:
 *                 type: string
 *                 description: Enter valid journeyStartDate
 *               journeyEndDate:
 *                 type: string
 *                 description: Enter valid journeyEndDate
 *               distance:
 *                 type: string
 *                 description: Enter valid distance
 *               duration:
 *                 type: string
 *                 description: Enter valid duration
 *               driverName:
 *                 type: string
 *                 description: Enter valid driverName
 *               driverLiceneceNo:
 *                 type: string
 *                 description: Enter valid driverLiceneceNo
 *               driverMobileNumber:
 *                 type: string
 *                 description: Enter valid driverMobileNumber
 *               vehicleType:
 *                 type: string
 *                 description: Enter valid vehicleType
 *               vehicleNumber:
 *                 type: string
 *                 description: Enter valid vehicleNumber
 *               weightBridgeName:
 *                 type: string
 *                 description: Enter valid weightBridgeName
 *               destination:
 *                 type: string
 *                 description: Enter valid destinaton
 *               address:
 *                 type: string
 *                 description: Enter valid destinaton
 *             required:
 *               - email
 *               - royaltyPassNo
 *               - leaserId
 *               - issuedDate
 *               - leaseValidUpto
 *               - SSPNumber
 *               - village
 *               - taluke
 *               - district
 *               - mineralName
 *               - mineralGrade
 *               - initialQuantatity
 *               - journeyStartDate
 *               - journeyEndDate
 *               - distance
 *               - duration
 *               - driverName
 *               - driverLiceneceNo
 *               - driverMobileNumber
 *               - vehicleType
 *               - vehicleNumber
 *               - weightBridgeName
 *               - destination
 *               - address
 *     responses:
 *       '200':
 *         description: Successful Royalty pass issuance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 qrCodeImage:
 *                   type: string
 *                 polygonLink:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               code: 200.
 *               message: Royalty pass issued successfully.
 *               qrCodeImage: Base64-encoded QR code image.
 *               polygonLink: Link to the transaction on the Polygon network.
 *               details: Royalty pass details.
 *       '400':
 *         description: Bad request or empty input fields
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
 *                   example: Empty input fields! or Invalid inputs!
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
 *                   example: An error occurred
 */

router.post('/issue-royalty-pass', validationRoute.signUp, gnfcController.issueRoyaltyPass);

/**
 * @swagger
 * /api/issue-delivery-challan:
 *   post:
 *     summary: Create a new Delivery Challan
 *     description: API to Create a new Delivery Challan
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Enter valid User email
 *               deliveryNo:
 *                 type: string
 *                 description: Enter valid deliveryNo
 *               royaltyPassNo:
 *                 type: string
 *                 description: Enter valid royaltyPassNo
 *               SSPNumber:
 *                 type: string
 *                 description: Enter valid SSPNumber
 *               surveyNo:
 *                 type: string
 *                 description: Enter valid surveyNo
 *               buyerId:
 *                 type: string
 *                 description: Enter valid buyerId
 *               buyerName:
 *                 type: string
 *                 description: Enter valid buyerName
 *               buyerAddress:
 *                 type: string
 *                 description: Enter valid buyerAddress
 *               mineralName:
 *                 type: string
 *                 description: Enter valid mineralName
 *               mineralGrade:
 *                 type: string
 *                 description: Enter valid mineralGrade
 *               initialQuantatity:
 *                 type: number
 *                 description: Enter valid initialQuantatity
 *               village:
 *                 type: string
 *                 description: Enter valid village
 *               taluke:
 *                 type: string
 *                 description: Enter valid taluke
 *               district:
 *                 type: string
 *                 description: Enter valid district
 *               pincode:
 *                 type: number
 *                 description: Enter valid pincode
 *               transportationMode:
 *                 type: string
 *                 description: Enter valid transportationMode
 *               transportationDistance:
 *                 type: string
 *                 description: Enter valid transportationDistance
 *               journeyStartDate:
 *                 type: string
 *                 description: Enter valid journeyStartDate
 *               journeyEndDate:
 *                 type: string
 *                 description: Enter valid journeyEndDate
 *               driverName:
 *                 type: string
 *                 description: Enter valid driverName
 *               driverLiceneceNo:
 *                 type: string
 *                 description: Enter valid driverLiceneceNo
 *               vehicleType:
 *                 type: string
 *                 description: Enter valid vehicleType
 *               vehicleNumber:
 *                 type: string
 *                 description: Enter valid vehicleNumber
 *             required:
 *               - email
 *               - deliveryNo
 *               - royaltyPassNo
 *               - SSPNumber
 *               - surveyNo
 *               - buyerId
 *               - buyerName
 *               - buyerAddress
 *               - mineralName
 *               - mineralGrade
 *               - initialQuantatity
 *               - village
 *               - taluke
 *               - district
 *               - pincode
 *               - transportationMode
 *               - transportationDistance
 *               - journeyStartDate
 *               - journeyEndDate
 *               - driverName
 *               - driverLiceneceNo
 *               - vehicleType
 *               - vehicleNumber
 *     responses:
 *       '200':
 *         description: Successful Delivery Challan issuance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 qrCodeImage:
 *                   type: string
 *                 polygonLink:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               code: 200.
 *               message: Delivery Challan issued successfully.
 *               qrCodeImage: Base64-encoded QR code image.
 *               polygonLink: Link to the transaction on the Polygon network.
 *               details: Delivery Challan details.
 *       '400':
 *         description: Bad request or empty input fields
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
 *                   example: Empty input fields! or Invalid inputs!
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
 *                   example: An error occurred
 */

router.post('/issue-delivery-challan', validationRoute.signUp, gnfcController.issueDeliveryChallan);

/**
 * @swagger
 * /api/poc-verify-id:
 *   post:
 *     summary: Verify provided ID
 *     description: API call for verify Royalty pass ID / Delivery challan ID
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The Royalty pass ID / Delivery challan ID.
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
 *                   description: Result message (Valid Royalty pass ID / Delivery challan ID).
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

router.post('/poc-verify-id', gnfcController.verifyPocByID);

/**
 * @swagger
 * /api/poc-verify-url:
 *   post:
 *     summary: Verify provided ID (Ex- https://gnfcissue.aicerts.io?=2101)
 *     description: API call for verify Royalty pass url / Delivery challan url
 *     tags: [GNFC POC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: The Royalty pass url / Delivery challan url.
 *             required:
 *               - url
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
 *                   description: Result message (Valid Royalty pass url / Delivery challan url).
 *                 details:
 *                   type: string[]
 *                   description: Result data.
 *       '400':
 *         description: Invalid input or empty url
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
 *                   description: Result message (Empty url supplied).
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

router.post('/poc-verify-url', gnfcController.verifyPocByIUrl);

module.exports=router;
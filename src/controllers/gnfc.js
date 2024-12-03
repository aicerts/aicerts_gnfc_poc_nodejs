// Load environment variables from .env file
require('dotenv').config();

// Import bcrypt for hashing passwords
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');

// Import custom authUtils module for JWT token generation
const { generateJwtToken } = require('../common/authUtils');

// Import required modules
const express = require('express');
const app = express(); // Create an instance of the Express application
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers'); // Ethereum JavaScript library

const leaser_role = process.env.POC_LEASER_ROLE;
const distributor_role = process.env.POC_DISTRIBUTOR_ROLE;
const stockist_role = process.env.POC_STOCKIST_ROLE;

const defaultLeaser = process.env.DEFAULT_LEASER;

const existedRoles = ['Leaser', 'Distributor', 'Stockist', 'Retailer'];

// Import MongoDB models
const {
  Admin,
  Stakeholders,
  RoyaltyPass,
  DeliveryChallan,
} = require('../config/schema');

const { validationResult } = require('express-validator');

var messageCode = require('../common/codes');

// Importing functions from a custom module
const {
  isDBConnected, // Function to check if the database connection is established
  calculateHash,
  connectToPolygonPoc,
  generateAccount,
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

/**
 * API call for User Signup.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const signup = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({
      code: 422,
      status: 'FAILED',
      message: messageCode.msgEnterInvalid,
      details: validResult.array(),
    });
  }
  // Extracting name, email, and password from the request body
  var { name, email, password, role, roleId } = req.body;
  name = name.trim();
  email = email.trim();
  password = password.trim();
  role = role.trim();
  roleId = roleId.trim();

  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage =
      dbStatus == true ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    // Checking if Stakeholder already exists
    const existingUser = await Stakeholders.findOne({
      email: email,
      role: role,
      roleId: roleId
    }).select('-password');

    if (existingUser) {
      // Admin / Leaser / Stockist with the provided details already exists
      res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgStakeholderExisted,
      });
      return; // Stop execution if user already exists
    }
    // password handling
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userId = await generateAccount();
    let today = new Date();
    let todayString = today.getTime().toString(); // Convert epoch time to string
    var _roleId = 'AP' + todayString.slice(-10);
    var roleId = (roleId) ? roleId : _roleId;
    // Save new user
    const newUser = new Stakeholders({
      name,
      email,
      password: hashedPassword,
      role: role,
      userId: userId,
      roleId: roleId,
      status: 'approved',
      approvedDate: new Date(),
      issuedDate: new Date(),
    });

    const savedUser = await newUser.save();
    res.json({
      code: 200,
      status: 'SUCCESS',
      message: messageCode.msgSignupSuccessful,
      data: savedUser,
    });
  } catch (error) {
    // An error occurred during signup process
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
      details: error,
    });
  }
};

/**
 * API call for User Login.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const login = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({
      code: 422,
      status: 'FAILED',
      message: messageCode.msgEnterInvalid,
      details: validResult.array(),
    });
  }
  let { email, role, password } = req.body;

  // Check database connection
  const dbStatus = await isDBConnected();
  const dbStatusMessage =
    dbStatus == true ? messageCode.msgDbReady : messageCode.msgDbNotReady;
  console.log(dbStatusMessage);

  // Checking if user exists
  const userExist = await Stakeholders.findOne({
    email: email,
    role: role,
  });

  if (!userExist) {
    return res.json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgStakeholderNotfound,
    });
  }

  // if (userExist.status != 'approved') {
  //   return res.json({
  //     code: 400,
  //     status: "FAILED",
  //     message: messageCode.msgStakeholderNotApproved,
  //   });
  // }

  // Finding user by email
  Stakeholders.find({ email })
    .then((data) => {
      if (data.length) {
        // User exists
        const hashedPassword = data[0].password;
        // Compare password hashes
        bcrypt
          .compare(password, hashedPassword)
          .then((result) => {
            if (result) {
              // Password match
              // Update admin status to true
              userExist.isActive = true;
              userExist.save();

              // Generate JWT token for authentication
              const JWTToken = generateJwtToken();

              // Respond with success message and user details
              res.status(200).json({
                code: 200,
                status: 'SUCCESS',
                message: messageCode.msgLoginSuccessful,
                data: {
                  JWTToken: JWTToken,
                  userId: data[0]?.userId,
                  name: data[0]?.name,
                  email: data[0]?.email,
                  role: data[0]?.role,
                  roleId: data[0]?.roleId,
                },
              });
            } else {
              // Incorrect password
              return res.json({
                code: 400,
                status: 'FAILED',
                message: messageCode.msgInvalidPassword,
              });
            }
          })
          .catch((err) => {
            // Error occurred while comparing passwords
            res.json({
              code: 401,
              status: 'FAILED',
              message: messageCode.msgErrorOnPwdCompare,
            });
          });
      } else {
        // User with provided email not found
        res.json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgStakeholderNotfound,
        });
      }
    })
    .catch((err) => {
      // Error occurred during login process
      res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgStakeholderNotfound,
      });
    });
};

/**
 * API call for User Logout.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const logout = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({
      code: 422,
      status: 'FAILED',
      message: messageCode.msgEnterInvalid,
      details: validResult.array(),
    });
  }
  let { email, role } = req.body;
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage =
      dbStatus == true ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    // Checking if User already exists
    const existingUser = await Stakeholders.findOne({
      email: email,
      role: role,
    });

    // If admin doesn't exist, or if they are not logged in, return failure response
    if (!existingUser) {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgStakeholderNotfound,
      });
    }

    // Save logout details by updating admin status to false
    existingUser.isActive = false;
    await existingUser.save();

    // Respond with success message upon successful logout
    return res.json({
      code: 200,
      status: 'SUCCESS',
      message: messageCode.msgLogoutSuccessful,
    });
  } catch (error) {
    // Error occurred during logout process, respond with failure message
    res.json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgErrorInLogout,
    });
  }
};

/**
 * API call for User / Leaser Approve.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const approveLeaser = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({
      code: 422,
      status: 'FAILED',
      message: messageCode.msgEnterInvalid,
      details: validResult.array(),
    });
  }
  // Extracting name, email, and password from the request body
  const { email, userId } = req.body;
  if (!email || !userId) {
    return res.json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgPlsEnterValid,
    });
  }
  try {
    // Check mongoose connection
    await isDBConnected();
    const isAdminExist = await Admin.findOne({ email: email });
    if (!isAdminExist) {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgAdminNotFound,
      });
    }

    if (isUserExist.status == 'approved') {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgUserApprovedAlready,
      });
    }

    const leaserRole = 'Leaser';
    const isUserExist = await Stakeholders.findOne({
      userId: userId,
      role: leaserRole,
    }).select('-password');
    if (!isUserExist) {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgLeaserNotFound,
      });
    }

    const assignedRole = existedRoles[0];
    const approvedResponse = await grantOrRevokeRoleWithRetry(
      assignedRole,
      userId
    );
    const addLeaser = await addLeaserWithRetry(
      isUserExist.roleId,
      isUserExist.userId
    );

    if (approvedResponse && addLeaser) {
      isUserExist.status = 'approved';
      isUserExist.approvedDate = new Date();
      await isAdminExist.save();

      // Respond with success message upon user approval
      return res.json({
        code: 200,
        status: 'SUCCESS',
        message: messageCode.msgApprovedSuccessful,
        details: isUserExist,
      });
    }
    return res.json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgFailedOpsAtBlockchain,
      details: isUserExist,
    });
  } catch (error) {
    // An error occurred during signup process
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
      details: error,
    });
  }
};

/**
 * API call for Issue Lease.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const createLeaser = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({
      code: 422,
      status: 'FAILED',
      message: messageCode.msgEnterInvalid,
      details: validResult.array(),
    });
  }
  // Extracting name, email, and password from the request body
  const { email, userId } = req.body;
  if (!email || !userId) {
    return res.json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgPlsEnterValid,
    });
  }
  try {
    // Check mongoose connection
    await isDBConnected();
    const isAdminExist = await Admin.findOne({ email: email });
    if (!isAdminExist) {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgPlsEnterValid,
      });
    }
    const isLeaserExist = await Stakeholders.findOne({
      userId: userId,
      role: existedRoles[0],
    });
  } catch (error) {
    // An error occurred during signup process
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
      details: error,
    });
  }
};

/**
 * API call for Issue Royalty Pass.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issueRoyaltyPass = async (req, res) => {
  const reqData = req?.body;
  try {
    await isDBConnected();
    if (reqData.email) {
      const isLeaserExist = await Stakeholders.findOne({
        email: reqData.email,
        role: existedRoles[0],
      });
      if (!isLeaserExist) {
        return res.status(400).json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgStakeholderNotApproved,
          details: reqData?.email,
        });
      }
    } else {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgStakeholderNotfound,
        details: reqData?.email,
      });
    }

    if (reqData?.royaltyPassNo) {
      const isRoyaltyPassExist = await RoyaltyPass.findOne({
        royaltyPassNo: reqData?.royaltyPassNo,
      });
      if (isRoyaltyPassExist) {
        return res.status(400).json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgRoyaltyPassExisted,
          details: reqData?.royaltyPassNo,
        });
      }
    } else {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgInvalidInput,
        details: reqData?.royaltyPassNo,
      });
    }
    const fields = {
      royaltyPassNo: reqData?.royaltyPassNo,
      leaserId: reqData?.leaserId,
      issuedDate: reqData?.issuedDate,
      leaseValidUpto: reqData?.leaseValidUpto,
      SSPNumber: reqData?.SSPNumber,
      village: reqData?.village,
      taluke: reqData?.taluke,
      district: reqData?.district,
      mineralName: reqData?.mineralName,
      mineralGrade: reqData?.mineralGrade,
      initialQuantatity: reqData?.initialQuantatity,
      journeyStartDate: reqData?.journeyStartDate,
      journeyEndDate: reqData?.journeyEndDate,
      distance: reqData?.distance,
      duration: reqData?.duration,
      driverName: reqData?.driverName,
      driverLiceneceNo: reqData?.driverLiceneceNo,
      driverMobileNumber: reqData?.driverMobileNumber,
      vehicleType: reqData?.vehicleType,
      vehicleNumber: reqData?.vehicleNumber,
      weightBridgeName: reqData?.weightBridgeName,
      destination: reqData?.destination,
      address: reqData?.address,
    };

    // Hash sensitive fields
    const hashedFields = {};
    let count = 0;

    for (const field in fields) {
      if (count >= 5) break; // Stop after 5 fields
      hashedFields[field] = calculateHash(fields[field]);
      count++;
    }
    const combinedHash = calculateHash(JSON.stringify(hashedFields));

    var basicInputs = [
      fields?.royaltyPassNo,
      fields?.leaserId,
      fields?.issuedDate,
      fields?.leaseValidUpto,
      fields?.SSPNumber,
      fields?.village,
      fields?.taluke,
      fields?.district,
      fields?.mineralName,
      fields?.mineralGrade,
    ];

    var convertedQuant = String(fields?.initialQuantatity);
    var additionalInputs = [
      convertedQuant,
      fields?.journeyStartDate,
      fields?.journeyEndDate,
      fields?.distance,
      fields?.duration,
      fields?.driverName,
      fields?.driverLiceneceNo,
      fields?.driverMobileNumber,
      fields?.vehicleType,
      fields?.vehicleNumber,
      fields?.weightBridgeName,
      fields?.destination,
    ];

    // Convert specific fields to strings
    var convertedInputs = additionalInputs.map((item) => {
      // Example: convert all items to strings except for specific conditions
      return item === undefined || item === null ? 'undefined' : String(item);
    });

    console.log(
      'The response',
      fields.royaltyPassNo,
      basicInputs,
      convertedInputs
    );

    try {
      try {
        // Amoy contract address from environment variable
        const abi = require('../config/pocAbi.json');
        const rpcUrl = process.env.AMOY_ENDPOINT;
        const contractAddress = process.env.POC_CONTRACT_ADDRESS;

        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        // Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
        const smContract = new ethers.Contract(contractAddress, abi, signer);
        // Issue Single Certifications on Blockchain
        const tx = await smContract.createRoyaltyPass(
          fields.royaltyPassNo,
          basicInputs,
          additionalInputs,
          combinedHash
        );

        var txHash = tx.hash;
      } catch (error) {
        console.error('the error is', error);
        return {
          code: 400,
          status: false,
          message: messageCode.msgFailedToIssueAfterRetry,
          details: fields.royaltyPassNo,
        };
      }

      // var { txHash, txFee } = await issueRoyaltyPassWithRetry(
      //   fields.royaltyPassNo,
      //   basicInputs,
      //   additionalInputs,
      //   combinedHash
      // );
      // var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;
      if (!txHash) {
        return {
          code: 400,
          status: false,
          message: messageCode.msgFailedToIssueAfterRetry,
          details: fields.royaltyPassNo,
        };
      }
      // var txHash = combinedHash;

      var modifiedUrl = process.env.POC_SHORT_URL + fields.royaltyPassNo;
      var qrCodeImage = await QRCode.toDataURL(modifiedUrl, {
        errorCorrectionLevel: 'H',
        width: 450, // Adjust the width as needed
        height: 450, // Adjust the height as needed
      });

      // Generate encrypted URL with certificate data
      const dataWithQRTransaction = {
        ...fields,
        transactionHash: txHash,
        qrData: qrCodeImage,
        url: modifiedUrl,
      };

      const storeData = await insertRoyaltyPassData(dataWithQRTransaction);

      if (storeData) {
        return res.status(200).json({
          code: 200,
          status: 'SUCCESS',
          message: messageCode.msgRoyaltyIssueSuccess,
          details: storeData,
        });
      } else {
        return res.status(400).json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgRoyaltyIssueUnsuccess,
          details: reqData?.royaltyPassNo,
        });
      }
    } catch (error) {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgInvalidInput,
        details: reqData?.royaltyPassNo,
      });
    }
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
    });
  }
};

/**
 * API call for Issue Delivery Challan.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issueDeliveryChallan = async (req, res) => {
  const reqData = req?.body;
  try {
    await isDBConnected();
    if (reqData.email) {
      const isIssuerExist = await Stakeholders.findOne({
        email: reqData.email,
      });
      if (!isIssuerExist) {
        return res.status(400).json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgStakeholderNotApproved,
          details: reqData?.email,
        });
      }
    } else {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgStakeholderNotfound,
        details: reqData?.email,
      });
    }
    if (reqData?.deliveryNo) {
      const isDeliveryChallanExist = await DeliveryChallan.findOne({
        deliveryNo: reqData?.deliveryNo,
      });
      if (isDeliveryChallanExist) {
        return res.status(400).json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgDeliveryChallansExisted,
          details: reqData?.deliveryNo,
        });
      }
    } else {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgInvalidInput,
        details: reqData?.deliveryNo,
      });
    }

    const fields = {
      deliveryNo: reqData?.deliveryNo,
      royaltyPassNo: reqData?.royaltyPassNo,
      SSPNumber: reqData?.SSPNumber,
      surveyNo: reqData?.surveyNo,
      buyerId: reqData?.buyerId, // Stackholder userId who is Stockist
      buyerName: reqData?.buyerName,
      buyerAddress: reqData?.buyerAddress,
      mineralName: reqData?.mineralName,
      mineralGrade: reqData?.mineralGrade,
      initialQuantatity: reqData?.initialQuantatity,
      village: reqData?.village,
      taluke: reqData?.taluke,
      district: reqData?.district,
      pincode: reqData?.pincode,
      transportationMode: reqData?.transportationMode,
      transportationDistance: reqData?.transportationDistance,
      journeyStartDate: reqData?.journeyStartDate,
      journeyEndDate: reqData?.journeyEndDate,
      driverName: reqData?.driverName,
      driverLiceneceNo: reqData?.driverLiceneceNo,
      vehicleType: reqData?.vehicleType,
      vehicleNumber: reqData?.vehicleNumber,
    };

    // Hash sensitive fields
    var hashedFields = {};
    let count = 0;
    for (const field in fields) {
      if (count >= 5) break; // Stop after 5 fields
      hashedFields[field] = calculateHash(fields[field]);
      count++;
    }
    const combinedHash = calculateHash(JSON.stringify(hashedFields));

    var formatQuantity = String(fields?.initialQuantatity);
    var formatPincode = String(fields?.pincode);
    var basicInputs = [
      fields?.deliveryNo,
      fields?.royaltyPassNo,
      fields?.SSPNumber,
      fields?.surveyNo,
      fields?.buyerId,
      fields?.buyerName,
      fields?.buyerAddress,
      fields?.mineralName,
      fields?.mineralGrade,
      formatQuantity,
      fields?.village,
      fields?.taluke,
      fields?.district,
      formatPincode,
    ];

    var additionalInputs = [
      fields?.transportationMode,
      fields?.transportationDistance,
      fields?.journeyStartDate,
      fields?.journeyEndDate,
      fields?.driverName,
      fields?.driverLiceneceNo,
      fields?.vehicleType,
      fields?.vehicleNumber,
    ];

    // Convert specific fields to strings
    var convertedInputs = basicInputs.map((item) => {
      // Example: convert all items to strings except for specific conditions
      return item === undefined || item === null ? 'undefined' : String(item);
    });

    console.log('The response', convertedInputs, additionalInputs);

    try {
      var { txHash, txFee } = await issueDeliveryChallanWithRetry(
        fields.deliveryNo,
        convertedInputs,
        additionalInputs,
        combinedHash
      );

      if (!txHash) {
        return {
          code: 400,
          status: false,
          message: messageCode.msgFailedToIssueAfterRetry,
          details: fields.deliveryNo,
        };
      }

      var modifiedUrl = process.env.POC_SHORT_URL + fields.deliveryNo;

      var qrCodeImage = await QRCode.toDataURL(modifiedUrl, {
        errorCorrectionLevel: 'H',
        width: 450, // Adjust the width as needed
        height: 450, // Adjust the height as needed
      });

      // Generate encrypted URL with certificate data
      const dataWithQRTransaction = {
        ...fields,
        transactionHash: txHash,
        qrData: qrCodeImage,
        url: modifiedUrl,
      };

      const storeData = await insertDeliveryChallanData(dataWithQRTransaction);

      if (storeData) {
        return res.status(200).json({
          code: 200,
          status: 'SUCCESS',
          message: messageCode.msgDeliveryChallanSuccess,
          details: storeData,
        });
      } else {
        return res.status(400).json({
          code: 400,
          status: 'FAILED',
          message: messageCode.msgDeliveryChallanUnsuccess,
          details: reqData?.deliveryNo,
        });
      }
    } catch (error) {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgInvalidInput,
        details: reqData?.deliveryNo,
      });
    }
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
    });
  }
};

/**
 * API call for verify Royalty pass ID / Delivery challan ID
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyPocByID = async (req, res) => {
  const requestId = req.body.id;
  if (!requestId) {
    return res.status(400).json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgInvalidInput,
    });
  }
  try {
    const isIdExist = await isGnfcIdExist(requestId);
    if (isIdExist === false) {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgNoMatchFound,
        details: requestId,
      });
    } else {
      return res.status(200).json({
        code: 200,
        status: 'SUCCESS',
        message: messageCode.msgMatchResultsFound,
        details: isIdExist,
      });
    }
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
    });
  }
};

/**
 * API call for verify Royalty pass Url / Delivery challan Url
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyPocByIUrl = async (req, res) => {
  const requestUrl = req.body.url;
  var getId = null;
  if (!requestUrl) {
    return res.status(400).json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgInvalidInput,
    });
  }
  // Parse the URL
  const parsedUrl = new URL(requestUrl);
  // extract the id from the url
  getId = parsedUrl.searchParams.get('');
  if (!getId) {
    getId = parsedUrl.searchParams.get('q');
  }
  if (!getId) {
    return res.status(400).json({
      code: 400,
      status: 'FAILED',
      message: messageCode.msgInvalidUrl,
    });
  }
  try {
    const isIdExist = await isGnfcIdExist(getId);
    if (isIdExist === false) {
      return res.status(400).json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgNoMatchFound,
        details: getId,
      });
    } else {
      return res.status(200).json({
        code: 200,
        status: 'SUCCESS',
        message: messageCode.msgMatchResultsFound,
        details: isIdExist,
      });
    }
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({
      code: 500,
      status: 'FAILED',
      message: messageCode.msgInternalError,
    });
  }
};

const grantOrRevokeRoleWithRetry = async (
  roleStatus,
  role,
  account,
  retryCount = 3
) => {
  const newContract = await connectToPolygonPoc();
  if (!newContract) {
    return { code: 400, status: 'FAILED', message: messageCode.msgRpcFailed };
  }
  try {
    // Issue Single Certifications on Blockchain
    if (roleStatus == 'grant') {
      var tx = await newContract.grantRole(role, account);
    } else if (roleStatus == 'revoke') {
      var tx = await newContract.revokeRole(role, account);
    } else {
      return null;
    }
    var txHash = tx.hash;

    return txHash;
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(
        `Connection timed out. Retrying... Attempts left: ${retryCount}`
      );
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return grantOrRevokeRoleWithRetry(
        roleStatus,
        role,
        account,
        retryCount - 1
      );
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return null;
    } else if (error.reason) {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return null;
    } else {
      // If there's no specific reason provided, handle the error generally
      // console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return null;
    }
  }
};

const addLeaserWithRetry = async (leaser, address, retryCount = 3) => {
  const newContract = await connectToPolygonPoc();
  if (!newContract) {
    return { code: 400, status: 'FAILED', message: messageCode.msgRpcFailed };
  }
  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.createLease(leaser, address);

    let txHash = tx.hash;
    //   let txFee = await fetchOrEstimateTransactionFee(tx);
    if (!txHash) {
      if (retryCount > 0) {
        console.log(
          `Unable to process the transaction. Retrying... Attempts left: ${retryCount}`
        );
        // Retry after a delay (e.g., 1.5 seconds)
        await holdExecution(1500);
        return issueLeaseWithRetry(leaser, address, retryCount - 1);
      } else {
        return {
          txHash: null,
          txFee: null,
        };
      }
    }

    return {
      txHash: txHash,
      txFee: null,
    };
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(
        `Connection timed out. Retrying... Attempts left: ${retryCount}`
      );
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueLeaseWithRetry(leaser, address, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return {
        txHash: null,
        txFee: null,
      };
    } else if (error.reason) {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return {
        txHash: null,
        txFee: null,
      };
    } else {
      // If there's no specific reason provided, handle the error generally
      // console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return {
        txHash: null,
        txFee: null,
      };
    }
  }
};

const issueRoyaltyPassWithRetry = async (
  royaltyPassId,
  basicInputs,
  additionalInputs,
  hash,
  retryCount = 3
) => {
  // const newContract = await connectToPolygonPoc();
  if (!newContract) {
    return { code: 400, status: 'FAILED', message: messageCode.msgRpcFailed };
  }

  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.createRoyaltyPass(
      royaltyPassId,
      basicInputs,
      additionalInputs,
      hash
    );

    let txHash = tx.hash;
    //   let txFee = await fetchOrEstimateTransactionFee(tx);
    if (!txHash) {
      if (retryCount > 0) {
        console.log(
          `Unable to process the transaction. Retrying... Attempts left: ${retryCount}`
        );
        // Retry after a delay (e.g., 1.5 seconds)
        await holdExecution(1500);
        return issueRoyaltyPassWithRetry(
          royaltyPassId,
          basicInputs,
          additionalInputs,
          hash,
          retryCount - 1
        );
      } else {
        return {
          txHash: null,
          txFee: null,
        };
      }
    }

    return {
      txHash: txHash,
      txFee: null,
    };
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(
        `Connection timed out. Retrying... Attempts left: ${retryCount}`
      );
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueRoyaltyPassWithRetry(
        royaltyPassId,
        basicInputs,
        additionalInputs,
        hash,
        retryCount - 1
      );
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      console.error('Error reason:', error.reason);
      return {
        txHash: null,
        txFee: null,
      };
    } else if (error.reason) {
      // Extract and handle the error reason
      console.error('Error reason:', error.reason);
      return {
        txHash: null,
        txFee: null,
      };
    } else {
      // If there's no specific reason provided, handle the error generally
      console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return {
        txHash: null,
        txFee: null,
      };
    }
  }
};

const issueDeliveryChallanWithRetry = async (
  deliveryChallanId,
  basicInputs,
  additionalInputs,
  hash,
  retryCount = 3
) => {
  const newContract = await connectToPolygonPoc();
  if (!newContract) {
    return { code: 400, status: 'FAILED', message: messageCode.msgRpcFailed };
  }
  // console.log("Contract inputs", newContract, deliveryChallanId, basicInputs, additionalInputs, hash);
  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.createDeliveryChallan(
      deliveryChallanId,
      basicInputs,
      additionalInputs,
      hash
    );

    let txHash = tx.hash;
    let txFee = null;
    //   let txFee = await fetchOrEstimateTransactionFee(tx);
    if (!txHash) {
      if (retryCount > 0) {
        console.log(
          `Unable to process the transaction. Retrying... Attempts left: ${retryCount}`
        );
        // Retry after a delay (e.g., 1.5 seconds)
        await holdExecution(1500);
        return issueDeliveryChallanWithRetry(
          deliveryChallanId,
          basicInputs,
          additionalInputs,
          hash,
          retryCount - 1
        );
      } else {
        return {
          txHash: null,
          txFee: null,
        };
      }
    }

    return {
      txHash: txHash,
      txFee: null,
    };
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(
        `Connection timed out. Retrying... Attempts left: ${retryCount}`
      );
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueDeliveryChallanWithRetry(
        deliveryChallanId,
        basicInputs,
        additionalInputs,
        hash,
        retryCount - 1
      );
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return {
        txHash: null,
        txFee: null,
      };
    } else if (error.reason) {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return {
        txHash: null,
        txFee: null,
      };
    } else {
      // If there's no specific reason provided, handle the error generally
      // console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return {
        txHash: null,
        txFee: null,
      };
    }
  }
};

const insertRoyaltyPassData = async (data) => {
  if (!data) {
    return false;
  }
  try {
    // Create a new Issues document with the provided data
    const newRoyaltyPass = new RoyaltyPass({
      royaltyPassNo: data?.royaltyPassNo,
      leaserId: data?.leaserId,
      issuedDate: data?.issuedDate,
      leaseValidUpto: data?.leaseValidUpto,
      SSPNumber: data?.SSPNumber,
      village: data?.village,
      taluke: data?.taluke,
      district: data?.district,
      mineralName: data?.mineralName,
      mineralGrade: data?.mineralGrade,
      initialQuantatity: data?.initialQuantatity,
      journeyStartDate: data?.journeyStartDate,
      journeyEndDate: data?.journeyEndDate,
      distance: data?.distance,
      duration: data?.duration,
      driverName: data?.driverName,
      driverLiceneceNo: data?.driverLiceneceNo,
      driverMobileNumber: data?.driverMobileNumber,
      vehicleType: data?.vehicleType,
      vehicleNumber: data?.vehicleNumber,
      weightBridgeName: data?.weightBridgeName,
      destination: data?.destination,
      address: data?.address,
      transactionHash: data?.transactionHash,
      url: data?.url || '',
      qrData: data?.qrData,
      issuanceDate: new Date(),
    });
    // Save the new Issues document to the database
    const result = await newRoyaltyPass.save();
    return result;
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error('Error connecting to MongoDB:', error);
    return false;
  }
};

const insertDeliveryChallanData = async (data) => {
  if (!data) {
    return false;
  }
  try {
    // Create a new Issues document with the provided data
    const newDeliveryChallan = new DeliveryChallan({
      deliveryNo: data?.deliveryNo,
      royaltyPassNo: data?.royaltyPassNo,
      SSPNumber: data?.SSPNumber,
      surveyNo: data?.surveyNo,
      buyerId: data?.buyerId,
      buyerName: data?.buyerName,
      buyerAddress: data?.buyerAddress,
      mineralName: data?.mineralName,
      mineralGrade: data?.mineralGrade,
      initialQuantatity: data?.initialQuantatity,
      village: data?.village,
      taluke: data?.taluke,
      district: data?.district,
      pincode: data?.pincode,
      transportationMode: data?.transportationMode,
      transportationDistance: data?.transportationDistance,
      journeyStartDate: data?.journeyStartDate,
      journeyEndDate: data?.journeyEndDate,
      driverName: data?.driverName,
      driverLiceneceNo: data?.driverLiceneceNo,
      vehicleType: data?.vehicleType,
      vehicleNumber: data?.vehicleNumber,
      transactionHash: data?.transactionHash,
      url: data?.url || '',
      qrData: data?.qrData,
      issuanceDate: new Date(),
    });
    // Save the new Issues document to the database
    const result = await newDeliveryChallan.save();
    return result;
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error('Error connecting to MongoDB:', error);
    return false;
  }
};

const isGnfcIdExist = async (id) => {
  try {
    await isDBConnected();
    const isRoyaltyPassIdExist = await RoyaltyPass.findOne({
      royaltyPassNo: id,
    });
    const isDeliveryChallanExist = await DeliveryChallan.findOne({
      deliveryNo: id,
    });
    if (isRoyaltyPassIdExist) {
      return isRoyaltyPassIdExist;
    } else if (isDeliveryChallanExist) {
      return isDeliveryChallanExist;
    } else {
      return false;
    }
  } catch (error) {
    console.error('An error occured', error);
    return false;
  }
};

module.exports = {
  login,

  signup,

  logout,

  issueRoyaltyPass,

  issueDeliveryChallan,

  verifyPocByID,

  verifyPocByIUrl,
};

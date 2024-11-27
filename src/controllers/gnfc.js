// Load environment variables from .env file
require('dotenv').config();

// Import bcrypt for hashing passwords
const bcrypt = require("bcrypt");

// Import custom authUtils module for JWT token generation
const { generateJwtToken } = require("../common/authUtils");

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers"); // Ethereum JavaScript library

// Import MongoDB models
const { Admin, Stakeholders, Orders } = require("../config/schema");

const { validationResult } = require("express-validator");

var messageCode = require("../common/codes");

// Importing functions from a custom module
const {
    isDBConnected, // Function to check if the database connection is established
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
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    // Extracting name, email, and password from the request body
    var { name, email, password, role } = req.body;
    name = name.trim();
    email = email.trim();
    password = password.trim();
    role = role.trim();

    try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        // Checking if Stakeholder already exists
        const existingUser = await Stakeholders.findOne({ 
            email : email, 
            role : role 
        }).select('-password');

        if (existingUser) {
            // Admin with the provided email already exists
            res.json({
                code: 400,
                status: "FAILED",
                message: messageCode.msgStakeholderExisted,
            });
            return; // Stop execution if user already exists
        }
        // password handling
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const userId = await generateAccount();
        // Save new user
        const newUser = new Stakeholders({
            name,
            email,
            password: hashedPassword,
            userId: userId,
            role: role,
            status: 'pending',
            issuedDate: new Date()
        });

        const savedUser = await newUser.save();
        res.json({
            code: 200,
            status: "SUCCESS",
            message: messageCode.msgSignupSuccessful,
            data: savedUser,
        });
    } catch (error) {
        // An error occurred during signup process
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
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
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    let { email, role, password } = req.body;

    // Check database connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    // Checking if user exists 
    const userExist = await Stakeholders.findOne({ 
        email : email, 
        role : role 
    }).select('-password');

    if(!userExist){
        return res.json({
            code: 400,
            status: "FAILED",
            message: messageCode.msgStakeholderNotfound,
        });
    }

    if(userExist.status != 'approved'){
        return res.json({
            code: 400,
            status: "FAILED",
            message: messageCode.msgStakeholderNotApproved,
        });
    }

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
                                status: "SUCCESS",
                                message: messageCode.msgLoginSuccessful,
                                data: {
                                    JWTToken: JWTToken,
                                    userId: data[0]?.userId,
                                    name: data[0]?.name,
                                    email: data[0]?.email
                                }
                            });
                        } else {
                            // Incorrect password
                            return res.json({
                                code: 400,
                                status: "FAILED",
                                message: messageCode.msgInvalidPassword,
                            });
                        }
                    })
                    .catch((err) => {
                        // Error occurred while comparing passwords
                        res.json({
                            code: 401,
                            status: "FAILED",
                            message: messageCode.msgErrorOnPwdCompare,
                        });
                    });

            } else {
                // User with provided email not found
                res.json({
                    code: 400,
                    status: "FAILED",
                    message: messageCode.msgStakeholderNotfound,
                });
            }
        })
        .catch((err) => {
            // Error occurred during login process
            res.json({
                code: 400,
                status: "FAILED",
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
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    let { email, role } = req.body;
    try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        // Checking if User already exists
        const existingUser = await Stakeholders.findOne({ 
            email : email, 
            role : role 
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
            status: "SUCCESS",
            message: messageCode.msgLogoutSuccessful
        });

    } catch (error) {
        // Error occurred during logout process, respond with failure message
        res.json({
            code: 400,
            status: 'FAILED',
            message: messageCode.msgErrorInLogout
        });
    }
};

/**
 * API call for User Approve.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const approveUser = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    // Extracting name, email, and password from the request body
    const { email, userId } = req.body;
    if(!email || !userId) {
        return res.json({
            code: 400,
            status: 'FAILED',
            message: messageCode.msgPlsEnterValid,
        });
    }
    try {
         // Check mongoose connection
         await isDBConnected();
         const isAdminExist = await Admin.findOne({ email : email });
         if(!isAdminExist) {
            return res.json({
                code: 400,
                status: 'FAILED',
                message: messageCode.msgAdminNotFound,
            });
        }
        const isUserExist = await Stakeholders.findOne({ userId : userId }).select('-password');
        if(!isUserExist) {
            return res.json({
                code: 400,
                status: 'FAILED',
                message: messageCode.msgNoMatchFound,
            });
        }

        const assignedRole = existedRoles[0];
        const chainResponse = await grantOrRevokeRoleWithRetry(assignedRole, userId);

        isUserExist.status = 'approved';
        isUserExist.approvedDate = new Date();
        await isAdminExist.save();

        // Respond with success message upon user approval
        return res.json({
            code: 200,
            status: "SUCCESS",
            message: messageCode.msgApprovedSuccessful,
            details: isUserExist
        });

    } catch (error) {
        // An error occurred during signup process
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
    }
};

/**
 * API call for Issue Lease.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const createLease = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    // Extracting name, email, and password from the request body
    const { email, userId, tenure, location, capacity } = req.body;
    if(!email || !userId) {
        return res.json({
            code: 400,
            status: 'FAILED',
            message: messageCode.msgPlsEnterValid,
        });
    }
    try {
         // Check mongoose connection
         await isDBConnected();
         const isAdminExist = await Admin.findOne({ email : email });
         if(!isAdminExist) {
            return res.json({
                code: 400,
                status: 'FAILED',
                message: messageCode.msgPlsEnterValid,
            });
        }
        const isLeaseExist = await Stakeholders.findOne({ userId : userId });
        
    } catch (error) {
        // An error occurred during signup process
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
    }
};

const grantOrRevokeRoleWithRetry = async (roleStatus, role, account, retryCount = 3) => {
    const newContract = await connectToPolygonPoc();
    if (!newContract) {
      return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
    }
    try {
        // Issue Single Certifications on Blockchain
        if (roleStatus == "grant") {
          var tx = await newContract.grantRole(
            role,
            account
          );
        } else if (roleStatus == "revoke") {
          var tx = await newContract.revokeRole(
            role,
            account
          );
        } else {
          return null;
        }
        var txHash = tx.hash;
    
        return txHash;
    
      } catch (error) {
        if (retryCount > 0 && error.code === 'ETIMEDOUT') {
          console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
          // Retry after a delay (e.g., 2 seconds)
          await holdExecution(2000);
          return grantOrRevokeRoleWithRetry(roleStatus, role, account, retryCount - 1);
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

const issueLeaseWithRetry = async (leaser, location, startDate, endDate, maxCapacity, retryCount = 3) => {
    const newContract = await connectToPolygonPoc();
    if (!newContract) {
      return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
    }
    try {
      // Issue Single Certifications on Blockchain
      const tx = await newContract.createLease(
        leaser,
        location,
        startDate,
        endDate,
        maxCapacity
      );
  
      let txHash = tx.hash;
    //   let txFee = await fetchOrEstimateTransactionFee(tx);
      if (!txHash) {
        if (retryCount > 0) {
          console.log(`Unable to process the transaction. Retrying... Attempts left: ${retryCount}`);
          // Retry after a delay (e.g., 1.5 seconds)
          await holdExecution(1500);
          return issueLeaseWithRetry(leaser, location, startDate, endDate, maxCapacity, retryCount - 1);
        } else {
          return {
            txHash: null,
            txFee: null
          };
        }
      }
  
      return {
        txHash: txHash,
        txFee: null
      };
  
    } catch (error) {
      if (retryCount > 0 && error.code === 'ETIMEDOUT') {
        console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
        // Retry after a delay (e.g., 2 seconds)
        await holdExecution(2000);
        return issueLeaseWithRetry(root, expirationEpoch, retryCount - 1);
      } else if (error.code === 'NONCE_EXPIRED') {
        // Extract and handle the error reason
        // console.log("Error reason:", error.reason);
        return {
          txHash: null,
          txFee: null
        };
      } else if (error.reason) {
        // Extract and handle the error reason
        // console.log("Error reason:", error.reason);
        return {
          txHash: null,
          txFee: null
        };
      } else {
        // If there's no specific reason provided, handle the error generally
        // console.error(messageCode.msgFailedOpsAtBlockchain, error);
        return {
          txHash: null,
          txFee: null
        };
      }
    }
  };


module.exports = {
    login,

    signup,

    logout,

    approveUser,

    createLease
}
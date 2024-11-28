// Importing functions from a custom module
const {
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// Import MongoDB models
const {
  RoyaltyPass,
  DeliveryChallan } = require("../config/schema");

var messageCode = require("../common/codes");
/**
 * API to fetch royalty pass details.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getRoyaltyPassData = async (req, res) => {
  const royaltyPassNo = req.body.royaltyPassNo;
  var royaltyPassExist = null;
  try {
    // Check mongoose connection
    await isDBConnected();
    if (royaltyPassNo && royaltyPassNo != 'string') {
      royaltyPassExist = await RoyaltyPass.findOne({ royaltyPassNo });
    } else {
      royaltyPassExist = await RoyaltyPass.find({});
    }
    if (!royaltyPassExist) {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgNoMatchFound
      });
    }
    return res.json({
      code: 200,
      status: 'SUCCESS',
      message: messageCode.msgMatchResultsFound,
      details: royaltyPassExist,
    });

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};


/**
 * API to fetch delivery challan details.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getDeliveryChallanData = async (req, res) => {
  const deliveryNo = req.body.deliveryNo;
  var deliveryNoExist = null;
  try {
    // Check mongoose connection
    await isDBConnected();
    if (deliveryNo && deliveryNo != 'string') {
      deliveryNoExist = await DeliveryChallan.findOne({ deliveryNo });
    } else {
      deliveryNoExist = await DeliveryChallan.find({});
    }
    if (!deliveryNoExist) {
      return res.json({
        code: 400,
        status: 'FAILED',
        message: messageCode.msgNoMatchFound
      });

    }
    return res.json({
      code: 200,
      status: 'SUCCESS',
      message: messageCode.msgMatchResultsFound,
      details: deliveryNoExist,
    });
  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};




module.exports = {
  // Function to do ops
  getRoyaltyPassData,

  getDeliveryChallanData
};
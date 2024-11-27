// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const QRCode = require("qrcode");
const path = require("path"); // Module for working with file paths
const fs = require("fs");
const _fs = require("fs-extra");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { validationResult } = require("express-validator");
const archiver = require('archiver');
const unzipper = require('unzipper');

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

const AWS = require('../config/aws-config');

const { generateVibrantQr } = require('../utils/generateImage');

// Import MongoDB models
const { Issues, BatchIssues, DynamicParameters } = require("../config/schema");

const bulkIssueStatus = process.env.BULK_ISSUE_STATUS || 'DEFAULT';
const cloudStore = process.env.CLOUD_STORE || 'DEFAULT';

const queueEnable = parseInt(process.env.ENABLE_QUEUE) || 0;

const withoutPdfWidth = parseInt(process.env.WITHOUT_PDF_WIDTH);
const withoutPdfHeight = parseInt(process.env.WITHOUT_PDF_HEIGHT);
const qrXPosition = parseInt(process.env.STATIC_X_POSITION) || null;
const qrYPosition = parseInt(process.env.STATIC_Y_POSITION) || null;
const staticQrSize = parseInt(process.env.STATIC_QR_SIZE) || null;

const uploadPath = path.join(__dirname, '../../uploads');

// Importing functions from a custom module
const {
  isValidIssuer,
  connectToPolygon,
  connectToPolygonIssue,
  convertDateFormat,
  convertDateToEpoch,
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  calculateHash, // Function to calculate the hash of a file
  isDBConnected, // Function to check if the database connection is established
  getIssuerServiceCredits,
  updateIssuerServiceCredits,
  validatePDFDimensions,
  verifyBulkDynamicPDFDimensions,
  generateCustomFolder,
  wipeSourceFolder,
  wipeSourceFile,
  renameUploadPdfFile,
  removeEmptyFolders,
  getPdfFiles,
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { fetchOrEstimateTransactionFee } = require('../utils/upload');
const { handleExcelFile, handleBulkExcelFile, handleBatchExcelFile, getExcelRecordsCount } = require('../services/handleExcel');
const { handleIssueCertification, handleIssuePdfCertification, handleIssueDynamicPdfCertification, handleIssueDynamicCertification, dynamicBatchCertificates, dynamicBulkCertificates, handleIssuance } = require('../services/issue');

const messageCode = require("../common/codes");

const cert_limit = parseInt(process.env.BATCH_LIMIT);

// const currentDir = __dirname;
// const parentDir = path.dirname(path.dirname(currentDir));
const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // File type
// Define allowed Excel file extensions
const allowedExtensions = ['.xls', '.xlsx'];

var existIssuerId;

/**
 * API call for Certificate issue with pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issuePdf = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  var file = req?.file;
  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  let _expirationDate;

  // Rename the file by replacing the original file path with the new file name
  const newFilePath = await renameUploadPdfFile(file.path);

  console.log("The file name", req.file.path, newFilePath);
  if (newFilePath) {
    // Update req.file.path to reflect the new file path
    req.file.path = newFilePath;
  }

  if (pdfDoc.getPageCount() > 1) {
    // Delete the source file
    await wipeSourceFile(req.file.path);
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    const _grantDate = await convertDateFormat(req.body.grantDate);

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await isValidIssuer(email);
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    if (_grantDate == "1" || _grantDate == null || _grantDate == "string") {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
      return;
    }
    if (req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
      _expirationDate = 1;
    } else {
      _expirationDate = await convertDateFormat(req.body.expirationDate);
    }

    if (_expirationDate == null) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
      return;
    }

    const issueResponse = await handleIssuePdfCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate, req.file.path);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');

      // Set response headers for PDF to download
      const certificateName = `${certificateNumber}_certificate.pdf`;

      res.set({
        'Content-Type': "application/pdf",
        'Content-Disposition': `attachment; filename="${certificateName}"`, // Change filename as needed
      });

      // Send Pdf file
      res.send(issueResponse.file);
      await wipeSourceFile(req.file.path);
      return;

    } else {
      await wipeSourceFile(req.file.path);
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    await wipeSourceFile(req.file.path);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate issue with dynamic QR on the pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issueDynamicPdf = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  var file = req?.file;
  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);

  // Rename the file by replacing the original file path with the new file name
  const newFilePath = await renameUploadPdfFile(file.path);
  console.log("The file name", req.file.path, newFilePath);

  if (newFilePath) {
    // Update req.file.path to reflect the new file path
    req.file.path = newFilePath;
  }

  if (pdfDoc.getPageCount() > 1) {
    // Delete the source file
    await wipeSourceFile(req.file.path);
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }
  try {

    // Extracting required data from the request body
    let email = req.body.email;
    let certificateNumber = req.body.certificateNumber;
    let certificateName = req.body.name;
    let customFields = req.body.customFields;
    let positionX = req.body.posx;
    let positionY = req.body.posy;
    let qrsize = req.body.qrsize;
    let _positionX = parseInt(positionX);
    let _positionY = parseInt(positionY);
    let _qrsize = parseInt(qrsize);

    if (!email || !certificateNumber || !certificateName || !_positionX || !_positionY || !_qrsize || !customFields) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputProvide });
      return;
    }

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await isValidIssuer(email);
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    const issueResponse = await handleIssueDynamicPdfCertification(email, certificateNumber, certificateName, customFields, req.file.path, _positionX, _positionY, _qrsize);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');

      // Set response headers for PDF to download
      const certificateName = `${certificateNumber}_certificate.pdf`;

      res.set({
        'Content-Type': "application/pdf",
        'Content-Disposition': `attachment; filename="${certificateName}"`, // Change filename as needed
      });

      // Send Pdf file
      res.send(issueResponse.file);
      await wipeSourceFile(req.file.path);
      return;

    } else {
      await wipeSourceFile(req.file.path);
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    await wipeSourceFile(req.file.path);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issue = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    const _grantDate = await convertDateFormat(req.body.grantDate);
    let _expirationDate;
    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await isValidIssuer(email);
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    if (_grantDate == "1" || _grantDate == null || _grantDate == "string") {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
      return;
    }
    if (req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
      _expirationDate = 1;
    } else {
      _expirationDate = await convertDateFormat(req.body.expirationDate);
    }

    if (_expirationDate == null) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
      return;
    }

    const issueResponse = await handleIssueCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {

      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');

      return res.status(issueResponse.code).json({ code: issueResponse.code, status: issueResponse.status, message: issueResponse.message, qrCodeImage: issueResponse.qrCodeImage, polygonLink: issueResponse.polygonLink, details: responseDetails });
    }

    res.status(issueResponse.code).json({ code: issueResponse.code, status: issueResponse.status, message: issueResponse.message, details: responseDetails });
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate issue with Single / dynamic QR on the pdf custom template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issueDynamicCredential = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  var file = req?.file;
  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const flag = parseInt(req.body.flag);
  var issueResponse;
  var credentialNumber;

  // Rename the file by replacing the original file path with the new file name
  const newFilePath = await renameUploadPdfFile(file.path);
  console.log("The file name", req.file.path, newFilePath);

  if (newFilePath) {
    // Update req.file.path to reflect the new file path
    req.file.path = newFilePath;
  }

  if (flag != 1 && flag != 0) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidFlag });
  }

  if (pdfDoc.getPageCount() > 1) {
    await wipeSourceFile(req.file.path);
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }
  try {

    if (flag == 0) {
      // Extracting required data from the request body
      let email = req.body.email;
      let certificateNumber = req.body.certificateNumber;
      let certificateName = req.body.name;
      let customFields = req.body.customFields;
      let positionX = req.body.posx;
      let positionY = req.body.posy;
      let qrsize = req.body.qrsize;
      let _positionX = parseInt(positionX);
      let _positionY = parseInt(positionY);
      let _qrsize = parseInt(qrsize);

      if (!email || !certificateNumber || !certificateName || !_positionX || !_positionY || !_qrsize || !customFields) {
        res.status(400).json({ status: "FAILED", message: messageCode.msgInputProvide });
        return;
      }
      credentialNumber = certificateName;

      // Verify with existing credits limit of an issuer to perform the operation
      if (email) {
        let dbStatus = await isDBConnected();
        if (dbStatus) {
          var issuerExist = await isValidIssuer(email);
          if (issuerExist && issuerExist.issuerId) {
            existIssuerId = issuerExist.issuerId;
            let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
            if (fetchCredits === true) {
              await wipeSourceFile(req.file.path);
              return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
            }
            if (fetchCredits) {
            } else {
              await wipeSourceFile(req.file.path);
              return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
            }
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
          }
        }
      }

      issueResponse = await handleIssueDynamicPdfCertification(email, certificateNumber, certificateName, customFields, req.file.path, _positionX, _positionY, _qrsize);

      const responseDetails = issueResponse.details ? issueResponse.details : '';
      if (issueResponse.code == 200) {
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'issue');

        // Set response headers for PDF to download
        const certificateName = `${certificateNumber}_credential.pdf`;

        res.set({
          'Content-Type': "application/pdf",
          'Content-Disposition': `attachment; filename="${certificateName}"`, // Change filename as needed
        });

        // Send Pdf file
        res.send(issueResponse.file);
        await wipeSourceFile(req.file.path);
        return;

      } else {
        await wipeSourceFile(req.file.path);
        return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
      }

    } else if (flag == 1) {
      // Extracting required data from the request body
      let email = req.body.email;
      let certificateNumber = req.body.certificateNumber;
      let name = req.body.name;
      let courseName = req.body.course;
      let positionX = req.body.posx;
      let positionY = req.body.posy;
      let qrsize = req.body.qrsize;
      let _positionX = parseInt(positionX);
      let _positionY = parseInt(positionY);
      let _qrsize = parseInt(qrsize);
      let _grantDate = await convertDateFormat(req.body.grantDate);
      let _expirationDate;

      if (!email || !certificateNumber || !name || !_positionX || !_positionY || !_qrsize || !courseName || !_grantDate) {
        res.status(400).json({ status: "FAILED", message: messageCode.msgInputProvide });
        return;
      }
      credentialNumber = certificateNumber;
      // Verify with existing credits limit of an issuer to perform the operation
      if (email) {
        let dbStatus = await isDBConnected();
        if (dbStatus) {
          var issuerExist = await isValidIssuer(email);
          if (issuerExist && issuerExist.issuerId) {
            existIssuerId = issuerExist.issuerId;
            let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
            if (fetchCredits === true) {
              await wipeSourceFile(req.file.path);
              return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
            }
            if (fetchCredits) {
            } else {
              await wipeSourceFile(req.file.path);
              return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
            }
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuerId });
          }
        }
      }

      if (_grantDate == "1" || _grantDate == null || _grantDate == "string") {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
        await wipeSourceFile(req.file.path);
        return;
      }
      if (req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
        _expirationDate = 1;
      } else {
        _expirationDate = await convertDateFormat(req.body.expirationDate);
      }

      if (_expirationDate == null) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
        await wipeSourceFile(req.file.path);
        return;
      }

      issueResponse = await handleIssueDynamicCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate, req.file.path, _positionX, _positionY, _qrsize);
      const responseDetails = issueResponse.details ? issueResponse.details : '';
      if (issueResponse.code == 200) {
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'issue');

        // Set response headers for PDF to download
        const certificateName = `${credentialNumber}_certificate.pdf`;

        res.set({
          'Content-Type': "application/pdf",
          'Content-Disposition': `attachment; filename="${certificateName}"`, // Change filename as needed
        });

        // Send Pdf file
        res.send(issueResponse.file);
        await wipeSourceFile(req.file.path);
        return;

      } else {
        await wipeSourceFile(req.file.path);
        return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
      }
    } else {
      await wipeSourceFile(req.file.path);
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidFlag });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    await wipeSourceFile(req.file.path);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate custom issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const Issuance = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    const flag = req.body.flag || false;
    var _grantDate = req.body.grantDate;
    var _expirationDate;

    // Validate Expiration date
    if (req.body.expirationDate == "" || req.body.expirationDate == "1" || req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
      _expirationDate = 1;
    } else {
      _expirationDate = req.body.expirationDate;
    }
    if (!_expirationDate) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
    }

    if (_grantDate == "" || _grantDate == "1" || _grantDate == 1 || _grantDate == null || _grantDate == "string") {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
    }
    var _grantDate = await convertDateFormat(req.body.grantDate);
    if (!_grantDate) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
    }
    console.log(`email: ${email}, certificateId: ${certificateNumber}, name: ${name}, course: ${courseName}, grantDate: ${_grantDate}, expirationDate: ${_expirationDate}, flag: ${flag}`)
    // console.log("Request Enduser name: ", name);
    const issueResponse = await handleIssuance(email, certificateNumber, name, courseName, _grantDate, _expirationDate, flag);
    var responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      return res.status(issueResponse.code).json({ code: issueResponse.code, status: issueResponse.status, message: issueResponse.message, qrCodeImage: issueResponse.qrCodeImage, polygonLink: issueResponse.polygonLink, details: responseDetails });
    }

    res.status(issueResponse.code).json({ code: issueResponse.code, status: issueResponse.status, message: issueResponse.message, details: responseDetails });
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Batch Certificates issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const batchIssueCertificate = async (req, res) => {
  const newContract = await connectToPolygon();
  if (!newContract) {
    return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
  }
  const email = req.body.email;
  var qrOption = 0;
  var file = req?.file;
  // Check if the file path matches the pattern
  if (req.file.mimetype != fileType) {
    // Delete the source file
    await wipeSourceFile(req.file.path);
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgMustExcel });
    return;
  }

  // Get the file extension
  const fileExtension = path.extname(req.file.originalname).toLowerCase();

  console.log("The input file details:", req.file.originalname, file.path, fileExtension);
  // Check if the file extension is in the allowed list
  if (!allowedExtensions.includes(fileExtension)) {
    // Delete the source file
    await wipeSourceFile(req.file.path);
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgMustExcel });
    return;
  }

  // Verify with existing credits limit of an issuer to perform the operation
  if (email) {
    let dbStatus = await isDBConnected();
    if (dbStatus) {
      var issuerExist = await isValidIssuer(email);
      if (issuerExist && issuerExist.issuerId) {
        existIssuerId = issuerExist.issuerId;
        let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
        if (fetchCredits === true) {
          await wipeSourceFile(req.file.path);
          return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
        }
        if (fetchCredits) {
        } else {
          await wipeSourceFile(req.file.path);
          return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
        }
      } else {
        await wipeSourceFile(req.file.path);
        return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuerId });
      }
    }
  }

  try {
    await isDBConnected();
    const idExist = issuerExist;
    let filePath = req.file.path;

    if (idExist.qrPreference) {
      qrOption = idExist.qrPreference;
    }

    // Fetch the records from the Excel file
    const excelData = await handleExcelFile(filePath, existIssuerId);
    await _fs.remove(filePath);

    try {

      if (
        (!idExist || idExist.status !== 1) || // User does not exist
        // !idExist || 
        !req.file.filename ||
        req.file.filename === 'undefined' ||
        excelData.response === false) {

        let errorMessage = messageCode.msgPlsEnterValid;
        let _details = excelData.Details;
        if (!idExist) {
          errorMessage = messageCode.msgInvalidIssuer;
          _details = idExist.email;
        }
        else if (!excelData.response) {
          errorMessage = excelData.message;
        } else if (idExist.status !== 1) {
          errorMessage = messageCode.msgUnauthIssuer;
        }
        await wipeSourceFile(req.file.path);
        res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, details: _details });
        return;

      } else {

        // Batch Certification Formated Details
        const rawBatchData = excelData.message[0];
        // Certification count
        const certificatesCount = excelData.message[1];
        // certification unformated details
        const batchData = excelData.message[2];

        // Extracting only expirationDate values
        const expirationDates = rawBatchData.map(item => item.expirationDate);
        const firstItem = expirationDates[0];
        const firstItemEpoch = await convertDateToEpoch(firstItem);
        const allDatesCommon = expirationDates.every(date => date === firstItem);

        const certificationIDs = rawBatchData.map(item => item.certificationID);

        // Assuming BatchIssues is your MongoDB model
        for (const id of certificationIDs) {
          const issueExist = await Issues.findOne({ certificateNumber: id });
          const _issueExist = await BatchIssues.findOne({ certificateNumber: id });
          if (issueExist || _issueExist) {
            matchingIDs.push(id);
          }
        }

        const updatedBatchData = batchData.map(data => {
          return data.map(item => {
            return item === null ? '1' : item;
          });
        });

        const hashedBatchData = updatedBatchData.map(data => {
          // Convert data to string and calculate hash
          const dataString = data.map(item => item.toString()).join('');
          const _hash = calculateHash(dataString);
          return _hash;
        });

        // // Format as arrays with corresponding elements using a loop
        const values = [];
        for (let i = 0; i < certificatesCount; i++) {
          values.push([hashedBatchData[i]]);
        }

        try {
          // Verify on blockchain
          const isPaused = await newContract.paused();
          // Check if the Issuer wallet address is a valid Ethereum address
          if (!ethers.isAddress(idExist.issuerId)) {
            await wipeSourceFile(req.file.path);
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidEthereum });
          }
          const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);

          if (isPaused === true || issuerAuthorized === false) {
            // Certificate contract paused
            let messageContent = messageCode.msgOpsRestricted;

            if (issuerAuthorized === flase) {
              messageContent = messageCode.msgIssuerUnauthrized;
            }
            await wipeSourceFile(req.file.path);
            return res.status(400).json({ code: 400, status: "FAILED", message: messageContent });
          }

          // Generate the Merkle tree
          const tree = StandardMerkleTree.of(values, ['string']);
          let dateEntry;

          const allocateBatchId = idExist.batchSequence ? idExist.batchSequence + 1 : 1 ;
          idExist.batchSequence = allocateBatchId;

          await idExist.save();
          // const allocateBatchId = 1;
          if (allDatesCommon) {
            dateEntry = firstItemEpoch;
          } else {
            dateEntry = 0;
          }

          let { txHash, txFee } = await issueBatchCertificateWithRetry(tree.root, dateEntry);
          if (!txHash) {
            await wipeSourceFile(req.file.path);
            return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry, details: certificateNumber });
          }

          var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

          try {
            // Check mongoose connection
            const dbStatus = await isDBConnected();
            const dbStatusMessage = (dbStatus) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
            console.log(dbStatusMessage);

            let batchDetails = [];
            var batchDetailsWithQR = [];
            let insertPromises = []; // Array to hold all insert promises

            for (let i = 0; i < certificatesCount; i++) {
              let _proof = tree.getProof(i);
              // console.log("The hash", _proof);
              // Convert each hexadecimal string to a Buffer
              let buffers = _proof.map(hex => Buffer.from(hex.slice(2), 'hex'));
              // Concatenate all Buffers into one
              let concatenatedBuffer = Buffer.concat(buffers);
              // Calculate SHA-256 hash of the concatenated buffer
              let _proofHash = crypto.createHash('sha256').update(concatenatedBuffer).digest('hex');
              let _grantDate = await convertDateFormat(rawBatchData[i].grantDate);
              let _expirationDate = (rawBatchData[i].expirationDate == "1" || rawBatchData[i].expirationDate == null) ? "1" : rawBatchData[i].expirationDate;
              batchDetails[i] = {
                issuerId: idExist.issuerId,
                batchId: allocateBatchId,
                proofHash: _proof,
                encodedProof: `0x${_proofHash}`,
                transactionHash: txHash,
                certificateHash: hashedBatchData[i],
                certificateNumber: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                course: rawBatchData[i].certificationName,
                grantDate: _grantDate,
                expirationDate: _expirationDate,
                email: email,
                certStatus: 1,
                positionX: qrXPosition,
                positionY: qrYPosition,
                qrSize: staticQrSize,
                width: withoutPdfWidth,
                height: withoutPdfHeight,
                qrOption: qrOption
              }

              let _fields = {
                Certificate_Number: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                courseName: rawBatchData[i].certificationName,
                Grant_Date: _grantDate,
                Expiration_Date: _expirationDate,
                polygonLink
              }

              let encryptLink = await generateEncryptedUrl(_fields);
              let modifiedUrl = false;

              if (encryptLink) {
                let _dbStatus = await isDBConnected();
                if (_dbStatus) {
                  let urlData = {
                    email: email,
                    certificateNumber: rawBatchData[i].certificationID,
                    url: encryptLink
                  }
                }
              }

              modifiedUrl = process.env.SHORT_URL + rawBatchData[i].certificationID;

              let _qrCodeData = modifiedUrl !== false ? modifiedUrl : encryptLink;

              // Generate vibrant QR
              const generateQr = await generateVibrantQr(_qrCodeData, 450, qrOption);

              if (!generateQr) {
                var qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
                  errorCorrectionLevel: "H",
                  width: 450, // Adjust the width as needed
                  height: 450, // Adjust the height as needed
                });
              }

              var qrImageData = generateQr ? generateQr : qrCodeImage;

              batchDetailsWithQR[i] = {
                issuerId: idExist.issuerId,
                batchId: allocateBatchId,
                transactionHash: txHash,
                certificateHash: hashedBatchData[i],
                certificateNumber: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                course: rawBatchData[i].certificationName,
                grantDate: _grantDate,
                expirationDate: _expirationDate,
                qrImage: qrImageData,
                width: withoutPdfWidth,
                height: withoutPdfHeight
              }

              insertPromises.push(insertBatchCertificateData(batchDetails[i]));
            }
            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);
            let newCount = certificatesCount;
            let oldCount = idExist.certificatesIssued;
            idExist.certificatesIssued = newCount + oldCount;
            // If user with given id exists, update certificatesIssued transation fee
            const previousrtransactionFee = idExist.transactionFee || 0; // Initialize to 0 if transactionFee field doesn't exist
            idExist.transactionFee = previousrtransactionFee + txFee;
            await idExist.save();

            // Update Issuer credits limit (decrease by 1)
            await updateIssuerServiceCredits(existIssuerId, 'issue');

            res.status(200).json({
              code: 200,
              status: "SUCCESS",
              message: messageCode.msgBatchIssuedSuccess,
              polygonLink: polygonLink,
              details: batchDetailsWithQR,
            });

            await wipeSourceFile(req.file.path);
            return;

          } catch (error) {
            // Handle mongoose connection error (log it, response an error, etc.)
            console.error(messageCode.msgInternalError, error);
            await wipeSourceFile(req.file.path);
            return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
          }

        } catch (error) {
          console.error('Error:', error);
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      await wipeSourceFile(req.file.path);
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidExcel, details: error });
    }
  } catch (error) {
    console.error('Error:', error);
    await wipeSourceFile(req.file.path);
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API call for Bulk Certificate issue (batch) with pdf templates.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const dynamicBatchIssueCertificates = async (req, res) => {

  var file = req?.file;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ code: 400, status: "FAILED", message: errorMessage });
    await wipeSourceFile(req.file.path);
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];
  var existIssuerId;
  var qrOption = 0;
  var excelData;
  var bulkIssueResponse;
  var destDirectory;


  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  try {
    await isDBConnected();

    var filePath = req.file.path;
    const email = req.body.email;
    var flag = parseInt(req.body.flag);
    var queueOption;

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await isValidIssuer(email);
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    const emailExist = await isValidIssuer(email);
    const paramsExist = await DynamicParameters.findOne({ email: email });

    if (!emailExist || !paramsExist) {
      var messageContent = messageCode.msgInvalidEmail;
      if (!paramsExist) {
        messageContent = messageCode.msgInvalidParams;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: messageContent, details: email });
      await wipeSourceFile(req.file.path);
      return;
    }

    if (emailExist.qrPreference) {
      qrOption = emailExist.qrPreference;
    }

    const generateID = Math.floor(10000 + Math.random() * 90000);
    const croppedId = (emailExist.issuerId) ? emailExist.issuerId.slice(-5) : generateID;
    const customFolderName = await generateCustomFolder(croppedId);

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFile(req.file.path);
      return;
    }
    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);
    const uploadsPath = path.join(__dirname, "../../uploads");
    const updatedDestinationPath = path.join(__dirname, "../../uploads", customFolderName);
    destDirectory = path.join(__dirname, "../../uploads", customFolderName, "completed");
    console.log("The updated folder", updatedDestinationPath);

    await removeEmptyFolders(uploadsPath);

    if (fs.existsSync(destDirectory)) {
      // Delete the existing directory recursively
      fs.rmSync(destDirectory, { recursive: true });
    }
    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: updatedDestinationPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });

    filesList = await fs.promises.readdir(updatedDestinationPath);
    // Delete the source zip file after extraction
    await wipeSourceFile(req.file.path);

    let zipExist = await findDirectories(filesList, customFolderName);
    if (zipExist) {
      filesList = zipExist;
    }
    console.log("Unzip response", filesList, filesList.length);

    if (filesList.length < 2) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }
    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0 || xlsxFiles.length > 1) {
      var errorMessage = messageCode.msgUnableToFindExcelFiles;
      var details = "";
      if (xlsxFiles.length > 1) {
        errorMessage = messageCode.msgFindMoreExcelFiles;
        details = xlsxFiles;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, Details: details });
      await wipeSourceFolder(customFolderName);
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    const excelFilePath = path.join(__dirname, '../../uploads', customFolderName, xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    if (queueEnable == 0) {
      var excelDataCount = await getExcelRecordsCount(excelFilePath);
      console.log("the count", excelDataCount);
      if (excelDataCount.data) {
        queueOption = (excelDataCount.data >= cert_limit) ? queueOption = 1 : queueOption = 0;
      } else {
        res.status(400).json({ code: 400, status: "FAILED", message: excelDataCount.message });
        await wipeSourceFolder(customFolderName);
        return;
      }
    } else {
      queueOption = 0;
    }

    if (queueOption == 0) {
      excelData = await handleBulkExcelFile(excelFilePath);
    } else {
      console.log("the input option", queueOption);
      excelData = await handleBatchExcelFile(excelFilePath, issuerExist);
    }

    // await _fs.remove(filePath);
    if (excelData.response == false) {
      var errorDetails = (excelData.Details) ? excelData.Details : "";
      res.status(400).json({ code: 400, status: "FAILED", message: excelData.message, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.documentName + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedDocs = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedDocs.length) || (matchedDocs.length != excelData.message[1])) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var pdfPagesValidation = [];
    var pdfTemplateValidation = [];
    for (let index = 0; index < pdfFiles.length; index++) {
      try {
        console.log("Processing file index:", index);
        let targetDocument = pdfFiles[index];

        // Construct the PDF file path
        let pdfFilePath = path.join(__dirname, '../../uploads', customFolderName, targetDocument);

        let templateBuffer = fs.readFileSync(pdfFilePath);
        let pdfDoc = await PDFDocument.load(templateBuffer);
        let pageCount = pdfDoc.getPageCount();
        if (pageCount > 1) {
          pdfPagesValidation.push(targetDocument);
        }

        // Validate PDF dimensions
        let validityCheck = await validatePDFDimensions(pdfFilePath, paramsExist.pdfWidth, paramsExist.pdfHeight);

        // Push invalid PDFs to the array
        if (validityCheck === false) {
          pdfTemplateValidation.push(targetDocument); // Use targetDocument instead of pdfFiles[index]
        }
      } catch (error) {
        console.error("Error processing file:", pdfFiles[index], error);
      }
    }

    if (pdfTemplateValidation.length > 0 || pdfPagesValidation.length > 0) {
      let errorMessage = '';
      let errorDetails = '';
      if (pdfPagesValidation.length > 0) {
        errorMessage = messageCode.msgMultipagePdfError;
        errorDetails = pdfPagesValidation;
      } else {
        errorMessage = messageCode.msgInvalidPdfDimensions;
        errorDetails = pdfTemplateValidation;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

    console.log("The queue option", queueOption);
    if (queueOption == 0) {
      bulkIssueResponse = await dynamicBulkCertificates(emailExist.email, emailExist.issuerId, pdfFiles, excelData.message, excelFilePath, paramsExist.positionX, paramsExist.positionY, paramsExist.qrSide, paramsExist.pdfWidth, paramsExist.pdfHeight, qrOption, customFolderName, flag);
    } else {
      flag = 0;
      bulkIssueResponse = await dynamicBatchCertificates(emailExist.email, emailExist.issuerId, pdfFiles, excelData.message, excelFilePath, paramsExist.positionX, paramsExist.positionY, paramsExist.qrSide, paramsExist.pdfWidth, paramsExist.pdfHeight, qrOption, customFolderName, flag);
    }

    if ((bulkIssueStatus == 'ZIP_STORE' && queueOption == 0) || (flag == 1 && queueOption == 0)) {
      if (bulkIssueResponse.code == 200) {
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'issue');

        const zipFileName = `${formattedDateTime}.zip`;
        const resultFilePath = path.join(__dirname, '../../uploads', customFolderName, zipFileName);

        // Create a new zip archive
        const archive = archiver('zip', {
          zlib: { level: 9 } // Sets the compression level
        });

        // Create a write stream for the zip file
        const output = fs.createWriteStream(resultFilePath);
        if (cloudStore == 'S3_STORE') {
          var fetchResultZipFile = path.basename(resultFilePath);
        }

        // Listen for close event of the archive
        output.on('close', async () => {
          console.log(archive.pointer() + ' total bytes');
          if (cloudStore == 'S3_STORE') {
            const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
            if (fileBackup.response == false) {
              console.log("The S3 backup failed", fileBackup.details);
            }
          }
          console.log('Zip file created successfully');
          if (fs.existsSync(destDirectory)) {
            // Delete the existing directory recursively
            fs.rmSync(destDirectory, { recursive: true });
          }
          // Send the zip file as a download
          res.download(resultFilePath, zipFileName, (err) => {
            if (err) {
              console.error('Error downloading zip file:', err);
            }
            // Delete the zip file after download
            // fs.unlinkSync(resultFilePath);
            fs.unlinkSync(resultFilePath, (err) => {
              if (err) {
                console.error('Error deleting zip file:', err);
              }
              console.log('Zip file deleted');
            });
          });
        });

        // Pipe the output stream to the zip archive
        archive.pipe(output);

        var filesList = await getPdfFiles(destDirectory);

        var excelFileName = path.basename(excelFilePath);
        // Append the file to the list
        filesList.push(excelFileName);

        // Add PDF files to the zip archive
        filesList.forEach(file => {
          var filePath = path.join(destDirectory, file);
          archive.file(filePath, { name: file });
        });

        // Finalize the zip archive
        archive.finalize();

        // Always delete the excel files (if it exists)
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
        }

        return;
      } else {
        var statusCode = bulkIssueResponse.code || 400;
        var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
        var statusDetails = bulkIssueResponse.Details || "";
        res.status(statusCode).json({ code: statusCode, status: "FAILED", message: statusMessage, details: statusDetails });
        await wipeSourceFolder(customFolderName);
        return;
      }
    }

    if (bulkIssueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');
      let bulkResponse = {
        email: emailExist.email,
        issuerId: emailExist.issuerId,
        height: paramsExist.pdfHeight,
        width: paramsExist.pdfWidth,
        urls: bulkIssueResponse.Details
      }
      res.status(bulkIssueResponse.code).json({ code: bulkIssueResponse.code, status: "SUCCESS", message: messageCode.msgBatchIssuedSuccess, details: bulkResponse });
      await wipeSourceFolder(customFolderName);
      return;
    } else {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ code: statusCode, status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

  } catch (error) {
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
    await wipeSourceFile(req.file.path);
    return;
  }
};

const dynamicBatchIssueCredentials = async (req, res) => {

  var file = req?.file;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ code: 400, status: "FAILED", message: errorMessage });
    await wipeSourceFile(req.file.path);
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];
  var existIssuerId;
  var qrOption = 0;
  var excelData;
  var bulkIssueResponse;
  var destDirectory;


  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  try {
    await isDBConnected();

    var filePath = req.file.path;
    const email = req.body.email;
    var flag = parseInt(req.body.flag);
    var queueOption;

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await isValidIssuer(email);
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    const emailExist = await isValidIssuer(email);
    const paramsExist = await DynamicParameters.findOne({ email: email });

    if (!emailExist || !paramsExist) {
      var messageContent = messageCode.msgInvalidEmail;
      if (!paramsExist) {
        messageContent = messageCode.msgInvalidParams;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: messageContent, details: email });
      await wipeSourceFile(req.file.path);
      return;
    }

    if (emailExist.qrPreference) {
      qrOption = emailExist.qrPreference;
    }

    const generateID = Math.floor(10000 + Math.random() * 90000);
    const croppedId = (emailExist.issuerId) ? emailExist.issuerId.slice(-5) : generateID;
    const customFolderName = await generateCustomFolder(croppedId);

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFile(req.file.path);
      return;
    }
    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    const uploadsPath = path.join(__dirname, "../../uploads");
    const updatedDestinationPath = path.join(__dirname, "../../uploads", customFolderName);
    destDirectory = path.join(__dirname, "../../uploads", customFolderName, "completed");
    console.log("The updated folder", updatedDestinationPath);

    await removeEmptyFolders(uploadsPath);

    if (fs.existsSync(destDirectory)) {
      // Delete the existing directory recursively
      fs.rmSync(destDirectory, { recursive: true });
    }
    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: updatedDestinationPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });
    filesList = await fs.promises.readdir(updatedDestinationPath);
    // Delete the source zip file after extraction
    await wipeSourceFile(req.file.path);

    let zipExist = await findDirectories(filesList, customFolderName);
    if (zipExist) {
      filesList = zipExist;
    }
    console.log("Unzip response", filesList, filesList.length);
    if (filesList.length < 2) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }
    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0 || xlsxFiles.length > 1) {
      var errorMessage = messageCode.msgUnableToFindExcelFiles;
      var details = "";
      if (xlsxFiles.length > 1) {
        errorMessage = messageCode.msgFindMoreExcelFiles;
        details = xlsxFiles;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, Details: details });
      await wipeSourceFolder(customFolderName);
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    const excelFilePath = path.join(__dirname, '../../uploads', customFolderName, xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    if (queueEnable == 0) {
      var excelDataCount = await getExcelRecordsCount(excelFilePath);
      console.log("provided credentials count", excelDataCount);
      if (excelDataCount.data) {
        queueOption = (excelDataCount.data >= cert_limit) ? queueOption = 1 : queueOption = 0;
      } else {
        res.status(400).json({ code: 400, status: "FAILED", message: excelDataCount.message });
        await wipeSourceFolder(customFolderName);
        return;
      }
    } else {
      queueOption = 0;
    }

    excelData = await handleBatchExcelFile(excelFilePath, issuerExist);

    // await _fs.remove(filePath);
    if (excelData.response == false) {
      var errorDetails = (excelData.Details) ? excelData.Details : "";
      res.status(400).json({ code: 400, status: "FAILED", message: excelData.message, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.documentName + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedDocs = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedDocs.length) || (matchedDocs.length != excelData.message[1])) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var pdfPagesValidation = [];
    var pdfTemplateValidation = [];
    for (let index = 0; index < pdfFiles.length; index++) {
      try {
        console.log("Processing file index:", index);
        let targetDocument = pdfFiles[index];

        // Construct the PDF file path
        let pdfFilePath = path.join(__dirname, '../../uploads', customFolderName, targetDocument);

        let templateBuffer = fs.readFileSync(pdfFilePath);
        let pdfDoc = await PDFDocument.load(templateBuffer);
        let pageCount = pdfDoc.getPageCount();
        if (pageCount > 1) {
          pdfPagesValidation.push(targetDocument);
        }

        // Validate PDF dimensions
        let validityCheck = await validatePDFDimensions(pdfFilePath, paramsExist.pdfWidth, paramsExist.pdfHeight);

        // Push invalid PDFs to the array
        if (validityCheck === false) {
          pdfTemplateValidation.push(targetDocument); // Use targetDocument instead of pdfFiles[index]
        }
      } catch (error) {
        console.error("Error processing file:", pdfFiles[index], error);
      }
    }

    if (pdfTemplateValidation.length > 0 || pdfPagesValidation.length > 0) {
      let errorMessage = '';
      let errorDetails = '';
      if (pdfPagesValidation.length > 0) {
        errorMessage = messageCode.msgMultipagePdfError;
        errorDetails = pdfPagesValidation;
      } else {
        errorMessage = messageCode.msgInvalidPdfDimensions;
        errorDetails = pdfTemplateValidation;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }
    flag = 0;
    bulkIssueResponse = await dynamicBatchCertificates(emailExist.email, emailExist.issuerId, pdfFiles, excelData.message, excelFilePath, paramsExist.positionX, paramsExist.positionY, paramsExist.qrSide, paramsExist.pdfWidth, paramsExist.pdfHeight, qrOption, customFolderName, flag);
    await wipeSourceFile(req.file.path);

    if (bulkIssueStatus == 'ZIP_STORE' || flag == 1) {
      if (bulkIssueResponse.code == 200) {
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'issue');

        const zipFileName = `${formattedDateTime}.zip`;
        const resultFilePath = path.join(__dirname, '../../uploads', customFolderName, zipFileName);

        // Create a new zip archive
        const archive = archiver('zip', {
          zlib: { level: 9 } // Sets the compression level
        });

        // Create a write stream for the zip file
        const output = fs.createWriteStream(resultFilePath);
        if (cloudStore == 'S3_STORE') {
          var fetchResultZipFile = path.basename(resultFilePath);
        }

        // Listen for close event of the archive
        output.on('close', async () => {
          console.log(archive.pointer() + ' total bytes');
          if (cloudStore == 'S3_STORE') {
            const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
            if (fileBackup.response == false) {
              console.log("The S3 backup failed", fileBackup.details);
            }
          }
          console.log('Zip file created successfully');
          if (fs.existsSync(destDirectory)) {
            // Delete the existing directory recursively
            fs.rmSync(destDirectory, { recursive: true });
          }
          // Send the zip file as a download
          res.download(resultFilePath, zipFileName, (err) => {
            if (err) {
              console.error('Error downloading zip file:', err);
            }
            // Delete the zip file after download
            // fs.unlinkSync(resultFilePath);
            fs.unlinkSync(resultFilePath, (err) => {
              if (err) {
                console.error('Error deleting zip file:', err);
              }
              console.log('Zip file deleted');
            });
          });
        });

        // Pipe the output stream to the zip archive
        archive.pipe(output);

        var filesList = await getPdfFiles(destDirectory);

        var excelFileName = path.basename(excelFilePath);
        // Append the file to the list
        filesList.push(excelFileName);

        // Add PDF files to the zip archive
        filesList.forEach(file => {
          var filePath = path.join(destDirectory, file);
          archive.file(filePath, { name: file });
        });

        // Finalize the zip archive
        archive.finalize();

        // Always delete the excel files (if it exists)
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
        }

        return;
      } else {
        var statusCode = bulkIssueResponse.code || 400;
        var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
        var statusDetails = bulkIssueResponse.Details || "";
        res.status(statusCode).json({ code: statusCode, status: "FAILED", message: statusMessage, details: statusDetails });
        await wipeSourceFolder(customFolderName);
        return;
      }
    }

    if (bulkIssueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');
      let bulkResponse = {
        email: emailExist.email,
        issuerId: emailExist.issuerId,
        height: paramsExist.pdfHeight,
        width: paramsExist.pdfWidth,
        urls: bulkIssueResponse.Details
      }
      res.status(bulkIssueResponse.code).json({ code: bulkIssueResponse.code, status: "SUCCESS", message: messageCode.msgBatchIssuedSuccess, details: bulkResponse });
      await wipeSourceFolder(customFolderName);
      return;
    } else {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ code: statusCode, status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

  } catch (error) {
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
    await wipeSourceFile(req.file.path);
    return;
  }
};

// For concurrency approach
const dynamicBatchIssueConcurrency = async (req, res) => {

  var file = req?.file;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ code: 400, status: "FAILED", message: errorMessage });
    await wipeSourceFile(req.file.path);
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];
  var existIssuerId;
  var qrOption = 0;
  var excelData;
  var bulkIssueResponse;
  var destDirectory;


  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  try {
    await isDBConnected();

    var filePath = req.file.path;
    const email = req.body.email;
    var flag = parseInt(req.body.flag);
    var queueOption;

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await isValidIssuer(email);
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(503).json({ code: 503, status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    const emailExist = await isValidIssuer(email);
    const paramsExist = await DynamicParameters.findOne({ email: email });

    if (!emailExist || !paramsExist) {
      var messageContent = messageCode.msgInvalidEmail;
      if (!paramsExist) {
        messageContent = messageCode.msgInvalidParams;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: messageContent, Details: email });
      await wipeSourceFile(req.file.path);
      return;
    }

    if (emailExist.qrPreference) {
      qrOption = emailExist.qrPreference;
    }

    const generateID = Math.floor(10000 + Math.random() * 90000);
    const croppedId = (emailExist.issuerId) ? emailExist.issuerId.slice(-5) : generateID;
    const customFolderName = await generateCustomFolder(croppedId);
    // await wipeSourceFolder(customFolderName);

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFile(req.file.path);
      return;
    }
    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);
    const uploadsPath = path.join(__dirname, "../../uploads");
    const updatedDestinationPath = path.join(__dirname, "../../uploads", customFolderName);
    destDirectory = path.join(__dirname, "../../uploads", customFolderName, "completed");
    console.log("The updated folder", updatedDestinationPath);

    await removeEmptyFolders(uploadsPath);

    if (fs.existsSync(destDirectory)) {
      // Delete the existing directory recursively
      fs.rmSync(destDirectory, { recursive: true });
    }
    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: updatedDestinationPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });

    filesList = await fs.promises.readdir(updatedDestinationPath);
    // Delete the source zip file after extraction
    await wipeSourceFile(req.file.path);

    let zipExist = await findDirectories(filesList, customFolderName);
    if (zipExist) {
      filesList = zipExist;
    }
    console.log("Unzip response", filesList, filesList.length);

    if (filesList.length < 2) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0 || xlsxFiles.length > 1) {
      var errorMessage = messageCode.msgUnableToFindExcelFiles;
      var details = "";
      if (xlsxFiles.length > 1) {
        errorMessage = messageCode.msgFindMoreExcelFiles;
        details = xlsxFiles;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, Details: details });
      await wipeSourceFolder(customFolderName);
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    const excelFilePath = path.join(__dirname, '../../uploads', customFolderName, xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    if (queueEnable == 0) {
      var excelDataCount = await getExcelRecordsCount(excelFilePath);
      console.log("provided credentials count", excelDataCount);
      if (excelDataCount.data) {
        queueOption = (excelDataCount.data >= cert_limit) ? queueOption = 1 : queueOption = 0;
      } else {
        res.status(400).json({ code: 400, status: "FAILED", message: excelDataCount.message });
        await wipeSourceFolder(customFolderName);
        return;
      }
    } else {
      queueOption = 0;
    }

    if (queueOption == 0) {
      excelData = await handleBulkExcelFile(excelFilePath);
    } else {
      console.log("the input option", queueOption);
      excelData = await handleBatchExcelFile(excelFilePath, issuerExist);
    }

    if (excelData.response == false) {
      var errorDetails = (excelData.Details) ? excelData.Details : "";
      res.status(400).json({ code: 400, status: "FAILED", message: excelData.message, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.documentName + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedDocs = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedDocs.length) || (matchedDocs.length != excelData.message[1])) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var pdfPagesValidation = [];
    var pdfTemplateValidation = [];
    for (let index = 0; index < pdfFiles.length; index++) {
      try {
        console.log("Processing file index:", index);
        let targetDocument = pdfFiles[index];

        // Construct the PDF file path
        let pdfFilePath = path.join(__dirname, '../../uploads', customFolderName, targetDocument);

        let templateBuffer = fs.readFileSync(pdfFilePath);
        let pdfDoc = await PDFDocument.load(templateBuffer);
        let pageCount = pdfDoc.getPageCount();
        if (pageCount > 1) {
          pdfPagesValidation.push(targetDocument);
        }

        // Validate PDF dimensions
        let validityCheck = await validatePDFDimensions(pdfFilePath, paramsExist.pdfWidth, paramsExist.pdfHeight);

        // Push invalid PDFs to the array
        if (validityCheck === false) {
          pdfTemplateValidation.push(targetDocument); // Use targetDocument instead of pdfFiles[index]
        }
      } catch (error) {
        console.error("Error processing file:", pdfFiles[index], error);
      }
    }

    if (pdfTemplateValidation.length > 0 || pdfPagesValidation.length > 0) {
      let errorMessage = '';
      let errorDetails = '';
      if (pdfPagesValidation.length > 0) {
        errorMessage = messageCode.msgMultipagePdfError;
        errorDetails = pdfPagesValidation;
      } else {
        errorMessage = messageCode.msgInvalidPdfDimensions;
        errorDetails = pdfTemplateValidation;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

    console.log("The queue option", queueOption);
    if (queueOption == 0) {
      bulkIssueResponse = await dynamicBulkCertificates(emailExist.email, emailExist.issuerId, pdfFiles, excelData.message, excelFilePath, paramsExist.positionX, paramsExist.positionY, paramsExist.qrSide, paramsExist.pdfWidth, paramsExist.pdfHeight, qrOption, customFolderName, flag);
    } else {
      flag = 0;
      bulkIssueResponse = await dynamicBatchCertificates(emailExist.email, emailExist.issuerId, pdfFiles, excelData.message, excelFilePath, paramsExist.positionX, paramsExist.positionY, paramsExist.qrSide, paramsExist.pdfWidth, paramsExist.pdfHeight, qrOption, customFolderName, flag);
    }
    await wipeSourceFile(req.file.path);

    if ((bulkIssueStatus == 'ZIP_STORE' && queueOption == 0) || (flag == 1 && queueOption == 0)) {
      if (bulkIssueResponse.code == 200) {
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'issue');

        const zipFileName = `${formattedDateTime}.zip`;
        const resultFilePath = path.join(__dirname, '../../uploads', customFolderName, zipFileName);
        // Create a new zip archive
        const archive = archiver('zip', {
          zlib: { level: 9 } // Sets the compression level
        });

        // Create a write stream for the zip file
        const output = fs.createWriteStream(resultFilePath);
        if (cloudStore == 'S3_STORE') {
          var fetchResultZipFile = path.basename(resultFilePath);
        }

        // Listen for close event of the archive
        output.on('close', async () => {
          console.log(archive.pointer() + ' total bytes');
          if (cloudStore == 'S3_STORE') {
            const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
            if (fileBackup.response == false) {
              console.log("The S3 backup failed", fileBackup.details);
            }
          }
          console.log('Zip file created successfully');

          if (fs.existsSync(destDirectory)) {
            // Delete the existing directory recursively
            fs.rmSync(destDirectory, { recursive: true });
          }

          // Send the zip file as a download
          res.download(resultFilePath, zipFileName, (err) => {
            if (err) {
              console.error('Error downloading zip file:', err);
            }
            // Delete the zip file after download
            fs.unlinkSync(resultFilePath, (err) => {
              if (err) {
                console.error('Error deleting zip file:', err);
              }
              console.log('Zip file deleted');
            });
          });
        });

        // Pipe the output stream to the zip archive
        archive.pipe(output);

        var filesList = await getPdfFiles(destDirectory);

        var excelFileName = path.basename(excelFilePath);
        // Append the file to the list
        filesList.push(excelFileName);

        // Add PDF files to the zip archive
        filesList.forEach(file => {
          var filePath = path.join(destDirectory, file);
          archive.file(filePath, { name: file });
        });

        // Finalize the zip archive
        archive.finalize();

        // Always delete the excel files (if it exists)
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
        }

        return;
      } else {
        var statusCode = bulkIssueResponse.code || 400;
        var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
        var statusDetails = bulkIssueResponse.Details || "";
        res.status(statusCode).json({ code: statusCode, status: "FAILED", message: statusMessage, details: statusDetails });
        await wipeSourceFolder(customFolderName);
        return;
      }
    }

    if (bulkIssueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');
      let bulkResponse = {
        email: emailExist.email,
        issuerId: emailExist.issuerId,
        height: paramsExist.pdfHeight,
        width: paramsExist.pdfWidth,
        urls: bulkIssueResponse.Details
      }
      res.status(bulkIssueResponse.code).json({ code: bulkIssueResponse.code, status: "SUCCESS", message: messageCode.msgBatchIssuedSuccess, details: bulkResponse });
      await wipeSourceFolder(customFolderName);
      return;
    } else {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ code: statusCode, status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }

  } catch (error) {
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
    await wipeSourceFile(req.file.path);
    return;
  }
};

/**
 * API call for store dynamic QR poisioning parameters for the Dynamic Bulk Issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const acceptDynamicInputs = async (req, res) => {
  var file = req?.file.path;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.pdf')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustPdf;
    await wipeSourceFile(req.file.path);
    res.status(400).json({ status: "FAILED", message: errorMessage, details: req.file });
    return;
  }

  // Extracting file path from the request
  const email = req.body.email;
  const positionx = parseInt(req.body.posx);
  const positiony = parseInt(req.body.posy);
  const qrSide = parseInt(req.body.qrside);

  if (!email || !positionx || !positiony || !qrSide) {
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput, details: email });
    await wipeSourceFile(req.file.path);
    return;
  }

  var isIssuerExist = await isValidIssuer(email);
  if (!isIssuerExist) {
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuer, details: email });
    await wipeSourceFile(req.file.path);
    return;
  }

  const pdfResponse = await verifyBulkDynamicPDFDimensions(file, positionx, positiony, qrSide);

  if (pdfResponse.status == false || pdfResponse.morePages == 1) {
    var messageContent = messageCode.msgInvalidPdfTemplate;
    if (pdfResponse.morePages == 1) {
      messageContent = messageCode.msgMultiPagePdf
    }
    await wipeSourceFile(req.file.path);
    res.status(400).json({ code: 400, status: "FAILED", message: messageContent, details: email });
    return;
  }

  const pdfWidth = pdfResponse.width;
  const pdfHeight = pdfResponse.height;
  try {
    var dbStatus = isDBConnected();
    if (dbStatus) {
      const isParamsExist = await DynamicParameters.findOne({ email: email });
      if (!isParamsExist) {
        let newDynamicParams = new DynamicParameters({
          email: email,
          positionX: positionx,
          positionY: positiony,
          qrSide: qrSide,
          pdfHeight: pdfHeight,
          pdfWidth: pdfWidth,
          paramStatus: true,
          issueDate: Date.now() // Set the issue date to the current timestamp
        });
        // Save the new Issues document to the database
        await newDynamicParams.save();
      } else {
        isParamsExist.positionX = positionx;
        isParamsExist.positionY = positiony;
        isParamsExist.qrSide = qrSide;
        isParamsExist.pdfHeight = pdfHeight;
        isParamsExist.pdfWidth = pdfWidth;
        isParamsExist.paramStatus = true;
        isParamsExist.issueDate = Date.now();
        await isParamsExist.save();

      }
      await wipeSourceFile(req.file.path);
      res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgUnderConstruction, details: isParamsExist });
      return;
    }
  } catch (error) {
    await wipeSourceFile(req.file.path);
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgDbNotReady, details: error });
    return;
  }
};

/**
 * API call for validate Certificates (zip) for dynamic QR poisioning.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const validateDynamicBulkIssueDocuments = async (req, res) => {

  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ code: 400, status: "FAILED", message: errorMessage });
    if (req.file) {
      await wipeSourceFile(req.file.path);
    }
    return;
  }
  var filePath = req?.file.path;
  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];
  try {
    await isDBConnected();

    const email = req.body.email;

    const emailExist = await isValidIssuer(email);
    const paramsExist = await DynamicParameters.findOne({ email: email });

    if (!emailExist || !paramsExist) {
      var messageContent = messageCode.msgInvalidEmail;
      if (!paramsExist) {
        messageContent = messageCode.msgInvalidParams;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: messageContent, details: email });
      await wipeSourceFile(req.file.path);
      return;
    }
    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFile(req.file.path);
      return;
    }

    const generateID = Math.floor(10000 + Math.random() * 90000);
    var customFolderName = await generateCustomFolder(generateID);
    const destDirectory = path.join(__dirname, "../../uploads", customFolderName);

    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: destDirectory }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });

    filesList = await fs.promises.readdir(destDirectory);
    // Delete the source zip file after extraction
    await wipeSourceFile(req.file.path);
    console.log("Unzip response1", filesList, filesList.length);
    let zipExist = await findDirectories(filesList, customFolderName);
    if (zipExist) {
      filesList = zipExist;
    }
    console.log("Unzip response", filesList, filesList.length);
    if (filesList.length < 2) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindExcelFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await wipeSourceFolder(customFolderName);
      return;
    }

    const excelFilePath = path.join('./uploads', customFolderName, xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx

    // Fetch the records from the Excel file
    const excelData = await handleBatchExcelFile(excelFilePath);
    // await _fs.remove(filePath);
    if (excelData.response == false) {
      var errorDetails = (excelData.Details) ? excelData.Details : "";
      res.status(400).json({ code: 400, status: "FAILED", message: excelData.message, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }
    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.documentName + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedDocs = pdfFiles.filter(cert => certsWithPDF.includes(cert));

    if ((pdfFiles.length != matchedDocs.length) || (matchedDocs.length != excelData.message[1])) {
      res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      await wipeSourceFolder(customFolderName);
      return;
    }

    var pdfPagesValidation = [];
    var pdfTemplateValidation = [];
    for (let index = 0; index < pdfFiles.length; index++) {
      try {
        // console.log("Processing file index:", index);
        let targetDocument = pdfFiles[index];

        // Construct the PDF file path
        let pdfFilePath = path.join(__dirname, '../../uploads', customFolderName, targetDocument);

        let templateBuffer = fs.readFileSync(pdfFilePath);
        let pdfDoc = await PDFDocument.load(templateBuffer);
        let pageCount = pdfDoc.getPageCount();
        if (pageCount > 1) {
          pdfPagesValidation.push(targetDocument);
        }

        // Validate PDF dimensions
        let validityCheck = await validatePDFDimensions(pdfFilePath, paramsExist.pdfWidth, paramsExist.pdfHeight);

        // Push invalid PDFs to the array
        if (validityCheck === false) {
          pdfTemplateValidation.push(targetDocument); // Use targetDocument instead of pdfFiles[index]
        }
      } catch (error) {
        console.error("Error processing file:", pdfFiles[index], error);
      }
    }
    if (pdfTemplateValidation.length > 0 || pdfPagesValidation.length > 0) {
      let errorMessage = '';
      let errorDetails = '';
      if (pdfPagesValidation.length > 0) {
        errorMessage = messageCode.msgMultipagePdfError;
        errorDetails = pdfPagesValidation;
      } else {
        errorMessage = messageCode.msgInvalidPdfDimensions;
        errorDetails = pdfTemplateValidation;
      }
      res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, details: errorDetails });
      await wipeSourceFolder(customFolderName);
      return;
    }
    res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgValidDocumentsUploaded, details: email });
    await wipeSourceFolder(customFolderName);
    return;

  } catch (error) {
    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
    await wipeSourceFolder(customFolderName);
    return;
  }
};

// Function to check if a path is a directory
const findDirectories = async (items, endFolder) => {
  const results = [];
  const movedFiles = [];
  const updatedPath = path.join(uploadPath, endFolder);
  console.log("The end folder", updatedPath);

  // Ensure uploadPath exists
  try {
    if (!fs.existsSync(updatedPath)) {
      fs.mkdirSync(updatedPath, { recursive: true });
      console.log(`Created uploadPath: ${updatedPath}`);
    }
  } catch (err) {
    console.error(`Error ensuring uploadPath exists:`, err);
    return false; // Return empty array if there's an error
  }

  for (const item of items) {
    const fullPath = path.join(updatedPath, item);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        results.push(fullPath);
      }
    } catch (err) {
      // Ignore errors (e.g., file not found)
    }
  }

  if (results.length > 0) {
    // console.log('Directories found:', results);
    for (const dir of results) {
      // console.log(`Files in directory ${dir}:`);
      try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const oldPath = path.join(dir, file);
          const newPath = path.join(updatedPath, file);

          // Move file
          try {
            fs.renameSync(oldPath, newPath);
            movedFiles.push(file); // Add moved file to the list
            // console.log(`Moved ${file} to ${uploadPath}`);
          } catch (err) {
            console.error(`Error moving file ${file}:`, err);
          }
        });

        // Remove the directory if it's empty
        try {
          // Check if the directory still exists before trying to read it
          if (fs.existsSync(dir)) {
            const remainingFiles = fs.readdirSync(dir);
            if (remainingFiles.length === 0) {
              console.log("Directory path", dir);
              fs.rmdirSync(dir);
              // fs.unlinkSync(dir);
              console.log(`Removed empty directory ${dir}`);
            }
          } else {
            console.warn(`Directory ${dir} does not exist anymore`);
          }
        } catch (err) {
          console.error(`Error removing directory ${dir}:`, err);
        }

      } catch (err) {
        console.error(`Error reading directory ${dir}:`, err);
      }
    }
  } else {
    console.log('No additional directories found');
    return false;
  }
  // Return the list of moved files
  // console.log("Files", movedFiles);
  return movedFiles;
};

const issueBatchCertificateWithRetry = async (root, expirationEpoch, retryCount = 3) => {
  const newContract = await connectToPolygonIssue();
  if (!newContract) {
    return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
  }
  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.issueBatchOfCertificates(
      root,
      expirationEpoch
    );

    let txHash = tx.hash;
    let txFee = await fetchOrEstimateTransactionFee(tx);
    if (!txHash) {
      if (retryCount > 0) {
        console.log(`Unable to process the transaction. Retrying... Attempts left: ${retryCount}`);
        // Retry after a delay (e.g., 1.5 seconds)
        await holdExecution(1500);
        return issueBatchCertificateWithRetry(root, expirationEpoch, retryCount - 1);
      } else {
        return {
          txHash: null,
          txFee: null
        };
      }
    }

    return {
      txHash: txHash,
      txFee: txFee
    };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueBatchCertificateWithRetry(root, expirationEpoch, retryCount - 1);
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

const backupFileToCloud = async (file, filePath, type) => {

  const bucketName = process.env.BUCKET_NAME;
  if (type == 1) {
    var keyPrefix = 'bulkbackup/Single Issuance/'; // Specify desired prefix here
  } else if (type == 2) {
    var keyPrefix = 'bulkbackup/Batch Issuance/';
  } else {
    var keyPrefix = 'bulkbackup/';
  }
  const keyName = keyPrefix + file;

  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully to', data.Location);
    return ({ response: true, status: "SUCCESS", message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error uploading file:', error);
    return ({ response: false, status: "FAILED", message: 'An error occurred while uploading the file', details: error });
  }
};

module.exports = {
  // Function to issue a PDF certificate
  issuePdf,

  // Function to custom issue a PDF certificate
  Issuance,

  // Function to issue a Dynamic QR with PDF certification
  issueDynamicPdf,

  issueDynamicCredential,

  // Function to issue a certification
  issue,

  // Function to issue a Batch of certifications
  batchIssueCertificate,

  // Function to issue a Dynamic Bulk issues (batch) of certifications
  dynamicBatchIssueCertificates,
  dynamicBatchIssueConcurrency,
  dynamicBatchIssueCredentials,

  // Function to accept pdf & qr dimensions  Batch of certifications
  acceptDynamicInputs,

  // Function to validate dynamic bulk issue provided zip template files with excel data and dimensions 
  validateDynamicBulkIssueDocuments
};

// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const fs = require("fs");
const path = require("path"); // Module for working with file paths
var FormData = require('form-data');
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { validationResult } = require("express-validator");
const readXlsxFile = require("read-excel-file/node");
const { parse } = require("csv-parse");
// Import custom cryptoFunction module for encryption and decryption
const { decryptData, generateEncryptedUrl } = require("../common/cryptoFunction");
// Import MongoDB models
const { Issues, BatchIssues, DynamicIssues, DynamicBatchIssues } = require("../config/schema");

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Importing functions from a custom module
const {
  connectToPolygon,
  extractQRCodeDataFromPDF, // Function to extract QR code data from a PDF file
  isDBConnected, // Function to check if the database connection is established
  extractCertificateInfo,
  extractCertificateInformation,
  verificationLogEntry,
  isCertificationIdExisted,
  isDynamicCertificationIdExisted,
  holdExecution,
  checkTransactionStatus,
  renameUploadPdfFile,
  wipeSourceFile,
  verificationWithDatabase
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

var messageCode = require("../common/codes");
const uploadsPath = path.join(__dirname, '../../uploads');

const urlLimit = process.env.MAX_URL_SIZE || 50;

/**
 * Verify Certification page with PDF QR - Blockchain URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verify = async (req, res) => {
  // Extracting file path from the request
  var file = req?.file.path;
  console.log("file path", req.file.path);
  var fileBuffer = fs.readFileSync(file);
  var pdfDoc = await PDFDocument.load(fileBuffer);
  var certificateS3Url;
  var responseUrl;
  var verificationResponse;

  // Rename the file by replacing the original file path with the new file name
  const newFilePath = await renameUploadPdfFile(file);
  if (newFilePath) {
    // Update req.file.path to reflect the new file path
    req.file.path = newFilePath;
  }

  if (pdfDoc.getPageCount() > 1) {
    await wipeSourceFile(req.file.path);
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgMultiPagePdf });
  }

  try {
    // Extract QR code data from the PDF file
    const certificateData = await extractQRCodeDataFromPDF(req.file.path);

    if (certificateData == false) {
      await wipeSourceFile(req.file.path);
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertNotValid });
    }

    if (certificateData.startsWith(process.env.START_VERIFY_URL)) {
      var urlSize = certificateData.length;
      if (urlSize < urlLimit) {
        // Parse the URL
        const parsedUrl = new URL(certificateData);
        // Extract the query parameter
        const certificationNumber = parsedUrl.searchParams.get('');

        try {
          await isDBConnected();
          var isIdExist = await isCertificationIdExisted(certificationNumber);
          if (isIdExist) {
            var blockchainResponse = 0;
            if (isIdExist.batchId == undefined) {
              blockchainResponse = await verifySingleCertificationWithRetry(certificationNumber);
            } else if (isIdExist.batchId != undefined) {
              let batchNumber = (isIdExist.batchId) - 1;
              let dataHash = isIdExist.certificateHash;
              let proof = isIdExist.proofHash;
              let hashProof = isIdExist.encodedProof;
              blockchainResponse = await verifyBatchCertificationWithRetry(batchNumber, dataHash, proof, hashProof);
            }
            if (blockchainResponse == 2 || blockchainResponse == 3) {
              if (blockchainResponse == 2) {
                verificationResponse = messageCode.msgCertExpired;
              } else if (blockchainResponse == 3) {
                verificationResponse = messageCode.msgCertRevoked;
              }
              await wipeSourceFile(req.file.path);
              return res.status(400).json({ code: 400, status: "FAILED", message: verificationResponse });
            }
          }
          var isDynamicCertificateExist = await isDynamicCertificationIdExisted(certificationNumber);
          if (isIdExist) {
            if (isIdExist.certificateStatus == 6) {
              var _polygonLink = `https://${process.env.NETWORK}/tx/${isIdExist.transactionHash}`;

              var completeResponse = {
                'Certificate Number': isIdExist.certificateNumber,
                'Name': isIdExist.name,
                'Course Name': isIdExist.course,
                'Grant Date': isIdExist.grantDate,
                'Expiration Date': isIdExist.expirationDate,
                'Polygon URL': _polygonLink
              };

              let txStatus = await checkTransactionStatus(isIdExist.transactionHash);
              completeResponse.blockchainStatus = txStatus;

              if (urlIssueExist) {
                completeResponse.url = process.env.SHORT_URL + certificationNumber;
              } else {
                completeResponse.url = null;
              }
              await wipeSourceFile(req.file.path);
              res.status(200).json({
                code: 200,
                status: "SUCCESS",
                message: "Certification is valid",
                details: completeResponse
              });
              return;
            }

            let originalUrl = process.env.SHORT_URL + certificationNumber;
            let certUrl = (isIdExist.url != undefined && (isIdExist.url).length > 1) ? isIdExist.url : null;
            let formattedResponse = {
              "Certificate Number": isIdExist.certificateNumber,
              "Name": isIdExist.name,
              "Course Name": isIdExist.course,
              "Grant Date": isIdExist.grantDate,
              "Expiration Date": isIdExist.expirationDate,
              "Polygon URL": `${process.env.NETWORK}/tx/${isIdExist.transactionHash}`,
              "url": originalUrl,
              "certificateUrl": certUrl
            }
            if (isIdExist.certificateStatus == 3) {
              await wipeSourceFile(req.file.path);
              return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
            }

            let txStatus = await checkTransactionStatus(isIdExist.transactionHash);
            formattedResponse.blockchainStatus = txStatus;

            certificateS3Url = isIdExist.url != null ? isIdExist.url : null;
            formattedResponse.certificateUrl = certificateS3Url;
            var verifyLog = {
              issuerId: isIdExist.issuerId,
              course: isIdExist.course,
            };
            await verificationLogEntry(verifyLog);
            await wipeSourceFile(req.file.path);
            return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: formattedResponse });

          } else if (isDynamicCertificateExist) {
            let originalUrl = process.env.SHORT_URL + certificationNumber;
            let responseFields = isDynamicCertificateExist.certificateFields;
            let formattedDynamicResponse = {
              "Certificate Number": isDynamicCertificateExist.certificateNumber,
              "Name": isDynamicCertificateExist.name,
              "Custom Fields": responseFields,
              "Polygon URL": `${process.env.NETWORK}/tx/${isDynamicCertificateExist.transactionHash}`,
              "type": isDynamicCertificateExist.type,
              "url": originalUrl,
              "certificateUrl": isDynamicCertificateExist.url
            }

            await wipeSourceFile(req.file.path);
            return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: formattedDynamicResponse });
          } else {
            await wipeSourceFile(req.file.path);
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
          }

        } catch (error) {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert, details: error });
        }
      }
      responseUrl = certificateData;
      var [extractQRData, encodedUrl] = await extractCertificateInfo(responseUrl);
      if (!extractQRData["Certificate Number"]) {
        extractQRData = await extractCertificateInformation(responseUrl);
      }
      if (extractQRData) {
        try {
          var dbStatus = await isDBConnected();
          if (dbStatus) {
            var getCertificationInfo = await isCertificationIdExisted(extractQRData['Certificate Number']);
            if (!getCertificationInfo) {
              getCertificationInfo = await isDynamicCertificationIdExisted(extractQRData['Certificate Number']);
            }
            if (extractQRData && !getCertificationInfo) {
              let transactionHash = extractQRData["Polygon URL"].split('/').pop();
              if (transactionHash) {
                let txStatus = await checkTransactionStatus(transactionHash);
                extractQRData.blockchainStatus = txStatus;
              }
              extractQRData.certificateUrl = null;
              res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: extractQRData });
              await wipeSourceFile(req.file.path);
              return;
            }
            certificateS3Url = null;
            if (getCertificationInfo) {
              certificateS3Url = getCertificationInfo.url != null ? getCertificationInfo.url : null;
              var formatCertificationStatus = parseInt(getCertificationInfo.certificateStatus);
              if (formatCertificationStatus && formatCertificationStatus == 3) {
                await wipeSourceFile(req.file.path);
                return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
              }
            }
          }
        } catch (error) {
          await wipeSourceFile(req.file.path);
          return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        }
        extractQRData.url = !encodedUrl ? null : process.env.SHORT_URL + extractQRData['Certificate Number'];
        await wipeSourceFile(file);
        // Extract the transaction hash from the URL
        let transactionHash = certificateInfo["Polygon URL"].split('/').pop();
        if (transactionHash) {
          let txStatus = await checkTransactionStatus(transactionHash);
          extractQRData.blockchainStatus = txStatus;
        }

        extractQRData.certificateUrl = certificateS3Url;
        res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: extractQRData });
        await wipeSourceFile(req.file.path);
        return;
      }
      await wipeSourceFile(req.file.path);
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
    } else if (certificateData.startsWith(process.env.START_LMS)) {
      var [extractQRData, encodedUrl] = await extractCertificateInfo(certificateData);
      if (!extractQRData["Certificate Number"]) {
        extractQRData = await extractCertificateInformation(certificateData);
      }
      if (extractQRData["Polygon URL"] == undefined) {
        await wipeSourceFile(req.file.path);
        return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
      }
      if (extractQRData) {
        var verifyLog = {
          issuerId: 'default',
          course: extractQRData["Course Name"],
        };
        await verificationLogEntry(verifyLog);

        await wipeSourceFile(req.file.path);
        extractQRData["Polygon URL"] = await modifyPolygonURL(extractQRData["Polygon URL"]);
        // Extract the transaction hash from the URL
        let transactionHash = extractQRData["Polygon URL"].split('/').pop();
        if (transactionHash) {
          let txStatus = await checkTransactionStatus(transactionHash);
          extractQRData.blockchainStatus = txStatus;
        }
        res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: extractQRData });
        await wipeSourceFile(req.file.path);
        return;
      }
      await wipeSourceFile(req.file.path);
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });

    } else {
      await wipeSourceFile(req.file.path);
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
    }

  } catch (error) {
    // If an error occurs during verification, respond with failure status
    const verificationResponse = {
      code: 400,
      status: "FAILED",
      message: messageCode.msgCertNotValid
    };

    res.status(400).json(verificationResponse);
    await wipeSourceFile(req.file.path);
    return;
  }
};

/**
 * Handles the decoding of a certificate from an encrypted link Fetched after Mobile/Webcam Scan.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

const decodeQRScan = async (req, res) => {
  const receivedCode = req.body.receivedCode;
  if (!receivedCode) {
    // Respond with error message
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput });
  }
  // console.log("Input QR data", receivedCode);

  var responseUrl = null;
  var decodeResponse = false;
  var certificateS3Url;
  var verificationResponse;
  try {
    if (receivedCode.startsWith(process.env.START_URL) || receivedCode.startsWith(process.env.START_VERIFY_URL)) {
      var urlSize = receivedCode.length;
      if (urlSize < urlLimit) {
        // Parse the URL
        const parsedUrl = new URL(receivedCode);
        // Extract the query parameter
        var certificationNumber = parsedUrl.searchParams.get('');
        if (!certificationNumber) {
          certificationNumber = parsedUrl.searchParams.get('q');
        }
        try {
          await isDBConnected();
          var isIdExist = await isCertificationIdExisted(certificationNumber);
          if (isIdExist) {
            var blockchainResponse = 0;
            if (isIdExist.batchId == undefined) {
              blockchainResponse = await verifySingleCertificationWithRetry(certificationNumber);
            } else if (isIdExist.batchId != undefined) {
              let batchNumber = (isIdExist.batchId) - 1;
              let dataHash = isIdExist.certificateHash;
              let proof = isIdExist.proofHash;
              let hashProof = isIdExist.encodedProof;
              blockchainResponse = await verifyBatchCertificationWithRetry(batchNumber, dataHash, proof, hashProof);
            }
            if (blockchainResponse == 2 || blockchainResponse == 3) {
              if (blockchainResponse == 2) {
                verificationResponse = messageCode.msgCertExpired;
              } else if (blockchainResponse == 3) {
                verificationResponse = messageCode.msgCertRevoked;
              }
              return res.status(400).json({ code: 400, status: "FAILED", message: verificationResponse });
            }
          }
          var isDynamicCertificateExist = await isDynamicCertificationIdExisted(certificationNumber);
          if (isIdExist) {
            let originalUrl = process.env.SHORT_URL + certificationNumber;
            let certUrl = (isIdExist.url != undefined && (isIdExist.url).length > 1) ? isIdExist.url : null;
            let formattedResponse = {
              "Certificate Number": isIdExist.certificateNumber,
              "Name": isIdExist.name,
              "Course Name": isIdExist.course,
              "Grant Date": isIdExist.grantDate,
              "Expiration Date": isIdExist.expirationDate,
              "Polygon URL": `${process.env.NETWORK}/tx/${isIdExist.transactionHash}`,
              "url": originalUrl,
              "certificateUrl": certUrl
            }
            if (isIdExist.certificateStatus == 3) {
              return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
            }

            let txStatus = await checkTransactionStatus(isIdExist.transactionHash);
            formattedResponse.blockchainStatus = txStatus;

            var verifyLog = {
              issuerId: isIdExist.issuerId,
              course: isIdExist.course,
            };
            await verificationLogEntry(verifyLog);
            return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: formattedResponse });

          } else if (isDynamicCertificateExist) {
            let originalUrl = process.env.SHORT_URL + isDynamicCertificateExist.certificateNumber;
            let responseFields = isDynamicCertificateExist.certificateFields;
            let formattedDynamicResponse = {
              "Certificate Number": isDynamicCertificateExist.certificateNumber,
              "Name": isDynamicCertificateExist.name,
              "Custom Fields": responseFields,
              "Polygon URL": `${process.env.NETWORK}/tx/${isDynamicCertificateExist.transactionHash}`,
              "type": isDynamicCertificateExist.type,
              "url": originalUrl,
              "certificateUrl": isDynamicCertificateExist.url
            }

            if (isDynamicCertificateExist.certificateStatus == 3) {
              return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
            }

            let txStatus = await checkTransactionStatus(isDynamicCertificateExist.transactionHash);
            formattedDynamicResponse.blockchainStatus = txStatus;

            return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: formattedDynamicResponse });
          } else {
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
          }

        } catch (error) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert, details: error });
        }
      }
      responseUrl = receivedCode;
      var [extractQRData, encodedUrl] = await extractCertificateInfo(responseUrl);
      if (extractQRData) {
        try {
          var dbStatus = await isDBConnected();
          if (dbStatus) {
            var getCertificationInfo = await isCertificationIdExisted(extractQRData['Certificate Number']);
            if (!getCertificationInfo) {
              getCertificationInfo = await isDynamicCertificationIdExisted(extractQRData['Certificate Number']);
            }
            certificateS3Url = null;
            if (getCertificationInfo) {
              certificateS3Url = getCertificationInfo.url != null ? getCertificationInfo.url : null;
              var formatCertificationStatus = parseInt(getCertificationInfo.certificateStatus);
              if (formatCertificationStatus && formatCertificationStatus == 3) {
                return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
              }
            }
          }
        } catch (error) {
          return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        }
        extractQRData.url = !encodedUrl ? null : process.env.SHORT_URL + extractQRData['Certificate Number'];
        // Extract the transaction hash from the URL
        let transactionHash = extractQRData["Polygon URL"].split('/').pop();
        if (transactionHash) {
          let txStatus = await checkTransactionStatus(transactionHash);
          extractQRData.blockchainStatus = txStatus;
        }
        res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: extractQRData });
        return;
      }
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });

    } else if (receivedCode.startsWith(process.env.START_LMS)) {
      var [extractQRData, decodedUrl] = await extractCertificateInfo(receivedCode);
      if (!extractQRData["Certificate Number"]) {
        extractQRData = await extractCertificateInformation(receivedCode);
      }
      if (extractQRData) {
        var verifyLog = {
          issuerId: 'default',
          course: extractQRData["Course Name"],
        };
        await verificationLogEntry(verifyLog);
        // Extract the transaction hash from the URL
        let transactionHash = extractQRData["Polygon URL"].split('/').pop();
        if (transactionHash) {
          let txStatus = await checkTransactionStatus(transactionHash);
          extractQRData.blockchainStatus = txStatus;
        }
        extractQRData.url = null;
        res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: extractQRData });
        return;
      }
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });

    } else {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
    }
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * Handles the decoding of a certificate from an encrypted link.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const decodeCertificate = async (req, res) => {
  try {
    // Extract encrypted link from the request body
    const encryptedData = req.body.encryptedData;
    const iv = req.body.iv;

    // Decrypt the link
    const decryptedData = decryptData(encryptedData, iv);

    const originalData = JSON.parse(decryptedData);

    var originalUrl = generateEncryptedUrl(originalData);

    let isValid = false;
    let messageContent = "Not Verified"
    let parsedData;
    var certificateS3Url;
    if (originalData !== null) {
      parsedData = {
        "Certificate Number": originalData.Certificate_Number || "",
        "Course Name": originalData.courseName || "",
        "Custom Fields": originalData.certificateFields || "",
        "Expiration Date": originalData.Expiration_Date || "",
        "Grant Date": originalData.Grant_Date || "",
        "Name": originalData.name || "",
        "Polygon URL": await modifyPolygonURL(originalData.polygonLink) || ""
      };

      var getCertificationInfo = await isCertificationIdExisted(parsedData['Certificate Number']);
      if (!getCertificationInfo) {
        getCertificationInfo = await isDynamicCertificationIdExisted(parsedData['Certificate Number']);
      }

      var verifyLog = {
        issuerId: "default",
        course: parsedData["Course Name"]
      };

      isValid = true
      var dbStatus = await isDBConnected();
      if (dbStatus) {
        var getValidCertificatioInfo = await isCertificationIdExisted(originalData.Certificate_Number);
        if (!getValidCertificatioInfo) {
          getValidCertificatioInfo = await isDynamicCertificationIdExisted(originalData.Certificate_Number);
        }
        if (getValidCertificatioInfo) {
          certificateS3Url = getValidCertificatioInfo.url != null ? getValidCertificatioInfo.url : null;
          verifyLog.issuerId = getValidCertificatioInfo.issuerId;
          parsedData['Expiration Date'] = getValidCertificatioInfo.expirationDate;
          parsedData.certificateUrl = certificateS3Url;
          let formatCertificationStatus = parseInt(getCertificationInfo.certificateStatus);
          let certificationStatus = formatCertificationStatus || 0;
          if ((certificationStatus != 0) && (certificationStatus == 3)) {
            isValid = false;
            messageContent = "Certification has Revoked";
          }
        }
      }
    }

    // Extract the transaction hash from the URL
    let transactionHash = parsedData["Polygon URL"].split('/').pop();
    if (transactionHash) {
      let txStatus = await checkTransactionStatus(transactionHash);
      parsedData.blockchainStatus = txStatus;
    }

    // Respond with the verification status and decrypted data if valid
    if (isValid) {
      if (dbStatus && parsedData["Custom Fields"] == undefined) {
        await verificationLogEntry(verifyLog);
      }
      parsedData.url = originalUrl || null;
      res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, data: parsedData });
    } else {
      res.status(200).json({ code: 200, status: "FAILED", message: messageContent });
    }
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    res.status(500).json({ code: 500, message: messageCode.msgInternalError });
  }
};

/**
 * API call for Single / Batch Certificates verify with Certification ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

const verifyCertificationId = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  const inputId = req.body.id;
  var certificateS3Url;
  var verificationResponse;
  try {
    let dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus === true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);
    try {
      await isDBConnected();
      var isIdExist = await isCertificationIdExisted(inputId);
      if (isIdExist) {
        var blockchainResponse = 0;
        if (isIdExist.batchId == undefined) {
          blockchainResponse = await verifySingleCertificationWithRetry(inputId);
        } else if (isIdExist.batchId != undefined) {
          let batchNumber = (isIdExist.batchId) - 1;
          let dataHash = isIdExist.certificateHash;
          let proof = isIdExist.proofHash;
          let hashProof = isIdExist.encodedProof;
          blockchainResponse = await verifyBatchCertificationWithRetry(batchNumber, dataHash, proof, hashProof);
        }
        if (blockchainResponse == 2 || blockchainResponse == 3) {
          if (blockchainResponse == 2) {
            verificationResponse = messageCode.msgCertExpired;
          } else if (blockchainResponse == 3) {
            verificationResponse = messageCode.msgCertRevoked;
          }
          return res.status(400).json({ code: 400, status: "FAILED", message: verificationResponse });
        }
      }
      var isDynamicCertificateExist = await isDynamicCertificationIdExisted(inputId);
      if (isIdExist) {
        if (isIdExist.certificateStatus == 6) {
          let _polygonLink = `https://${process.env.NETWORK}/tx/${isIdExist.transactionHash}`;
          var completeResponse = {
            'Certificate Number': isIdExist.certificateNumber,
            'Name': isIdExist.name,
            'Course Name': isIdExist.course,
            'Grant Date': isIdExist.grantDate,
            'Expiration Date': isIdExist.expirationDate,
            'Polygon URL': _polygonLink
          };

          completeResponse.url = process.env.SHORT_URL + isIdExist.certificateNumber;

          let inputFileExist = await hasFilesInDirectory(uploadsPath);
          if (inputFileExist) {
          }

          let txStatus = await checkTransactionStatus(isIdExist.transactionHash);
          completeResponse.blockchainStatus = txStatus;

          res.status(200).json({
            code: 200,
            status: "SUCCESS",
            message: "Certification is valid",
            details: completeResponse
          });
          return;
        }

        let originalUrl = process.env.SHORT_URL + isIdExist.certificateNumber;
        let certUrl = (isIdExist.url != undefined && (isIdExist.url).length > 1) ? isIdExist.url : null;
        let formattedResponse = {
          "Certificate Number": isIdExist.certificateNumber,
          "Name": isIdExist.name,
          "Course Name": isIdExist.course,
          "Grant Date": isIdExist.grantDate,
          "Expiration Date": isIdExist.expirationDate,
          "Polygon URL": `${process.env.NETWORK}/tx/${isIdExist.transactionHash}`,
          "url": originalUrl,
          "certificateUrl": certUrl
        }
        if (isIdExist.certificateStatus == 3) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
        }

        var verifyLog = {
          issuerId: isIdExist.issuerId,
          course: isIdExist.course,
        };
        await verificationLogEntry(verifyLog);
        let inputFileExist = await hasFilesInDirectory(uploadsPath);
        if (inputFileExist) {
        }

        let txStatus = await checkTransactionStatus(isIdExist.transactionHash);
        formattedResponse.blockchainStatus = txStatus;

        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: formattedResponse });

      } else if (isDynamicCertificateExist) {
        let originalUrl = process.env.SHORT_URL + isDynamicCertificateExist.certificateNumber;
        let responseFields = isDynamicCertificateExist.certificateFields;
        let formattedDynamicResponse = {
          "Certificate Number": isDynamicCertificateExist.certificateNumber,
          "Name": isDynamicCertificateExist.name,
          "Custom Fields": responseFields,
          "Polygon URL": `${process.env.NETWORK}/tx/${isDynamicCertificateExist.transactionHash}`,
          "type": isDynamicCertificateExist.type,
          "url": originalUrl,
          "certificateUrl": isDynamicCertificateExist.url
        }
        let inputFileExist = await hasFilesInDirectory(uploadsPath);
        if (inputFileExist) {
        }

        if (isDynamicCertificateExist.certificateStatus == 3) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgCertRevoked });
        }

        let txStatus = await checkTransactionStatus(isDynamicCertificateExist.transactionHash);
        formattedDynamicResponse.blockchainStatus = txStatus;

        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: formattedDynamicResponse });
      } else {
        return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
      }

    } catch (error) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert, details: error });
    }

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * Verify Certification page with PDF QR / Excel  - Blockchain URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyCustom = async (req, res) => {
  // Extracting file path from the request
  var file = req?.file.path;
  console.log("file path", req.file.originalname);
  // Extract the file extension
  const fileExtension = path.extname(req.file.originalname);
  let _columnIndex = parseInt(req.body.column) || 1;
  const columnIndex = _columnIndex > 0 ? _columnIndex - 1 : 0;
  var verificationResponse = {
    code: 400,
    status: "FAILED",
    message: messageCode.msgCertNotValid
  };

  const acceptableFormats = [
    '.pdf',
    '.xlsx',
    '.csv'
  ];

  if (fileExtension != acceptableFormats[0] && fileExtension != acceptableFormats[1] && fileExtension != acceptableFormats[2]) {
    await wipeSourceFile(req.file.path);
    return res.status(400).json({
      code: 400,
      status: "FAILED",
      message: messageCode.msgInvalidFileFormat
    });
  }

  try {

    // Dynamically import fetch
    const { default: fetch } = await import('node-fetch');

    if (fileExtension == acceptableFormats[0]) { // file has .pdf extension

      // const host = process.env.HOST;
      // const port = process.env.PORT;
      // const hostUrl = `${host}:${port}/`;

      // // Extract the body from the incoming request
      // const requestFile = req?.file;

      // const formData = new FormData();
      // // If file is stored on disk
      // const fileBuffer = fs.readFileSync(requestFile.path);

      // formData.append("pdfFile", fileBuffer, {
      //   filename: requestFile.originalname,
      //   contentType: requestFile.mimetype,
      // });

      // // Call the external API, passing the request body
      // const response = await fetch(`${hostUrl}api/verify`, {
      //   method: 'POST', // Use POST for a body
      //   body: formData // Convert the body to JSON string
      // });

      // if(!response){
      //   return res.status(400).json({
      //     code: 400,
      //     status: "FAILED",
      //     message: messageCode.msgInternalError,
      //     details: error
      //   });
      // }
      // const result = await response.json();
      // // console.log("Response from verify API:", result);
      // await wipeSourceFile(req.file.path);
      // return res.status(result.code).json({
      //   code: result.code,
      //   status: result.status,
      //   message: result.message,
      //   details: result.details
      // });

      // Rename the file by replacing the original file path with the new file name
      var fileBuffer = fs.readFileSync(file);
      var pdfDoc = await PDFDocument.load(fileBuffer);
      var blockchainResponse;
      var verificationResponse;
      var responseCode = 200;
      var responseStatus = 'SUCCESS';
      var messageResponse = messageCode.msgCertValid;

      const newFilePath = await renameUploadPdfFile(file);
      if (newFilePath) {
        // Update req.file.path to reflect the new file path
        req.file.path = newFilePath;
      }

      if (pdfDoc.getPageCount() > 1) {
        await wipeSourceFile(req.file.path);
        return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgMultiPagePdf });
      }

      try {
        // Extract QR code data from the PDF file
        const certificateData = await extractQRCodeDataFromPDF(req.file.path);

        if (!certificateData) {
          res.status(400).json(verificationResponse);
          await wipeSourceFile(req.file.path);
          return;
        }

        if (certificateData.startsWith(process.env.START_VERIFY_URL)) {
          // Parse the URL
          const parsedUrl = new URL(certificateData);
          // Extract the query parameter
          const certificationNumber = parsedUrl.searchParams.get('');

          // Validate with blockchain call
          blockchainResponse = await verifySingleCertificationWithRetry(certificationNumber);

          if (blockchainResponse != 0 && (blockchainResponse == 1 || blockchainResponse == 3)) {
            if (blockchainResponse == 3) {
              responseCode = 400;
              responseStatus = 'FAILED';
              messageResponse = messageCode.msgCertRevoked;
            }
            res.status(responseCode).json({ code: responseCode, status: responseStatus, message: messageResponse });
            await wipeSourceFile(req.file.path);
            return;
          }

          const verificationDatabase = await verificationWithDatabase(certificationNumber);
          console.log("response res", verificationDatabase)

          if (verificationDatabase != 0 && (verificationDatabase == 1 || verificationDatabase == 3)) {
            if (verificationDatabase == 3) {
              responseCode = 400;
              responseStatus = 'FAILED';
              messageResponse = messageCode.msgCertRevoked;
            }
            res.status(responseCode).json({ code: responseCode, status: responseStatus, message: messageResponse });
            await wipeSourceFile(req.file.path);
            return;
          }

          res.status(400).json(verificationResponse);
          await wipeSourceFile(req.file.path);
          return;

        } else if (certificateData.startsWith(process.env.START_LMS)) {
          var [extractQRData, encodedUrl] = await extractCertificateInfo(certificateData);
          if (!extractQRData["Certificate Number"]) {
            extractQRData = await extractCertificateInformation(certificateData);
          }
          if (extractQRData["Polygon URL"] == undefined) {
            await wipeSourceFile(req.file.path);
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
          }
          if (extractQRData) {
            var verifyLog = {
              issuerId: 'default',
              course: extractQRData["Course Name"],
            };
            await verificationLogEntry(verifyLog);

            await wipeSourceFile(req.file.path);
            extractQRData["Polygon URL"] = await modifyPolygonURL(extractQRData["Polygon URL"]);
            // Extract the transaction hash from the URL
            let transactionHash = extractQRData["Polygon URL"].split('/').pop();
            if (transactionHash) {
              let txStatus = await checkTransactionStatus(transactionHash);
              extractQRData.blockchainStatus = txStatus;
            }
            res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgCertValid, details: extractQRData });
            await wipeSourceFile(req.file.path);
            return;
          }
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });

        } else {
          await wipeSourceFile(req.file.path);
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidCert });
        }

      } catch (error) {

        res.status(400).json(verificationResponse);
        await wipeSourceFile(req.file.path);
        return;
      }

    } else if (fileExtension == acceptableFormats[1]) {
      const excelResponse = await handleCustomBatchExcel(req.file.path, columnIndex);
      console.log("Excel response: ", excelResponse);
      const statusCode = (excelResponse?.response) ? 200 : 400;
      const excelStatus = excelResponse?.status;
      const excelMessage = excelResponse?.message;
      const excelDetails = excelResponse?.Details;
      await wipeSourceFile(req.file.path);
      return res.status(statusCode).json({
        code: statusCode,
        status: excelStatus,
        message: excelMessage,
        details: excelDetails
      });
    } else if (fileExtension == acceptableFormats[2]) {
      const csvResponse = await handleCustomBatchCsv(req.file.path, columnIndex);
      console.log("CSV response: ", csvResponse);
      const statusCode = (csvResponse?.response) ? 200 : 400;
      const csvStatus = csvResponse?.status;
      const csvMessage = csvResponse?.message;
      const csvDetails = csvResponse?.Details;
      await wipeSourceFile(req.file.path);
      return res.status(statusCode).json({
        code: statusCode,
        status: csvStatus,
        message: csvMessage,
        details: csvDetails
      });
    } else {
      await wipeSourceFile(req.file.path);
      return res.status(400).json({
        code: 400,
        status: "FAILED",
        message: messageCode.msgInvalidFile
      });
    }
  } catch (error) {
    await wipeSourceFile(req.file.path);
    return res.status(500).json({
      code: 500,
      status: "FAILED",
      message: messageCode.msgInternalError,
      details: error
    });
  }
};


// Function to verify the ID (Single) with Smart Contract with Retry
const verifySingleCertificationWithRetry = async (certificateId, retryCount = 3) => {
  const newContract = await connectToPolygon();
  if (!newContract) {
    return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
  }
  try {
    // Blockchain processing.
    let verifyCert = await newContract.verifyCertificateById(certificateId);
    let _certStatus = await newContract.getCertificateStatus(certificateId);

    if (verifyCert) {
      let verifyCertStatus = parseInt(verifyCert[3]);
      if (_certStatus) {
        let certStatus = parseInt(_certStatus);
        if (certStatus == 3) {
          return 3;
        }
      }
      if (verifyCert[0] === false && verifyCertStatus == 5) {
        return 2;
      }
      return 1;
    }
    return 0;
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return verifySingleCertificationWithRetry(certificateId, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return 0;
    } else {
      console.error("The ", error);
      return 0;
    }
  }
};

// Function to verify the ID (Batch) with Smart Contract with Retry
const verifyBatchCertificationWithRetry = async (batchNumber, dataHash, proof, hashProof, retryCount = 3) => {
  const newContract = await connectToPolygon();
  if (!newContract) {
    return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
  }
  try {
    // Blockchain processing.
    let batchVerifyResponse = await newContract.verifyBatchCertification(batchNumber, dataHash, proof);
    let _responseStatus = await newContract.verifyCertificateInBatch(hashProof);
    let responseStatus = parseInt(_responseStatus);

    if (batchVerifyResponse) {
      if (responseStatus) {
        if (responseStatus == 3) {
          return 3;
        }
      }
      if (responseStatus == 5) {
        return 2;
      }
      return 1;
    }
    return 0;
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return verifyBatchCertificationWithRetry(batchNumber, dataHash, proof, hashProof, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return 0;
    } else {
      console.error("The ", error);
      return 0;
    }
  }
};

// Function to conditionally replace the URL if the unwanted substring is found
const modifyPolygonURL = (url) => {
  const unwantedSubstring = "https://https://";
  if (url.includes(unwantedSubstring)) {
    return url.replace(unwantedSubstring, "https://");
  }
  return url;
};

const hasFilesInDirectory = async (directoryPath) => {
  try {
    return fs.readdirSync(directoryPath).some(file =>
      fs.statSync(path.join(directoryPath, file)).isFile()
    );
  } catch (error) {
    console.error(`Error checking directory: ${error.message}`);
    return false;
  }
}

// Function to handle custom Batch Excel
const handleCustomBatchExcel = async (_path, _index) => {
  const verificationStatus = [
    "invalid",
    "valid",
    'NA',
    "revoked",
  ];

  if (!_path) {
    return { status: "FAILED", response: false, message: "Failed to provide excel file" };
  }
  // api to fetch excel data into json
  const newPath = path.join(..._path.split("\\"));
  try {
    // api to fetch excel data into json
    const rows = await readXlsxFile(newPath);
    const targetColumn = rows
      .map(row => row[_index])
      .filter(value => value !== null); // Remove null values

    const allUndefined = targetColumn.every(item => item === undefined);
    // console.log("Excel request: ", allUndefined, rows, targetColumn, targetColumn.length, _index);

    if (allUndefined) {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgNoIdsFound,
      };
    }

    if (targetColumn.length > 1) {

      // Batch Certification Formated Details
      var notNullCertificationIDs = targetColumn.slice(1);


      // Initialize an empty list to store matching IDs
      const validChainResponse = [];
      const validCertStatus = [];

      // Assuming verify Issues is from blockchain
      // for (const certId of notNullCertificationIDs) {
      //   var validCertStatus = await verifySingleCertificationWithRetry(certId);
      //   validChainResponse.push(validCertStatus);
      // }

      // Assuming Issues is your MongoDB model
      for (const id of notNullCertificationIDs) {
        const validStatus = await verificationWithDatabase(id);
        validCertStatus.push(validStatus);
      }

      if (validCertStatus.length > 0) {

        // Map the data2 values to the corresponding verificationStatus based on the index
        const mergedStatus = notNullCertificationIDs.map((id, index) => {
          const statusIndex = validCertStatus[index]; // Convert to 0-based index
          const status = verificationStatus[statusIndex] || "NA"; // Handle out-of-range indices
          return { id, status };
        });

        // console.log("The extracted data ", notNullCertificationIDs, validCertStatus, mergedStatus);
        return {
          status: "SUCCESS",
          response: true,
          message: messageCode.msgBatchVerification,
          Details: mergedStatus
        };

      }
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgExcelHasExistingIds,
        Details: [notNullCertificationIDs],
      };
    } else {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgNoIdsFound,
      };
    }

  } catch (error) {
    console.error("Error fetching record:", error);
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgProvideValidExcel,
    };
  }
};

// Function to handle custom Batch CSV
const handleCustomBatchCsv = async (_path, _index) => {
  const verificationStatus = [
    "invalid",
    "valid",
    'NA',
    "revoked",
  ];

  if (!_path) {
    return { status: "FAILED", response: false, message: "Failed to provide excel file" };
  }
  // api to fetch excel data into json
  const newPath = path.join(..._path.split("\\"));
  try {
    const rows = []
    // Create a read stream and pipe it to csv-parse
    await new Promise((resolve, reject) => {
      fs.createReadStream(newPath)
        .pipe(
          parse({
            skip_empty_lines: true, // Ignore empty lines
          })
        )
        .on("data", (row) => {
          rows.push(row); // Add each row (as an array) to the rows array
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // Extract the target column based on the given index
    const targetColumn = rows
      .map((row) => row[_index]) // Extract the column at _index
      .filter((value) => value !== null && value !== ''); // Remove null/undefined values
    if (targetColumn.length == 0) {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgNoIndexColumnFound,
      };
    }
    // const allUndefined = targetColumn.every(item => item === undefined);
    // console.log("CSV request: ", allUndefined, rows, targetColumn, targetColumn.length, _index);

    // if (allUndefined) {
    //   return {
    //     status: "FAILED",
    //     response: false,
    //     message: messageCode.msgNoIdsFound,
    //   };
    // }

    if (targetColumn.length > 1) {

      // Batch Certification Formated Details
      var notNullCertificationIDs = targetColumn.slice(1);

      // Initialize an empty list to store matching IDs
      const validChainResponse = [];
      const validCertStatus = [];

      // Assuming verify Issues is from blockchain
      // for (const certId of notNullCertificationIDs) {
      //   var validCertStatus = await verifySingleCertificationWithRetry(certId);
      //   validChainResponse.push(validCertStatus);
      // }

      // Assuming Issues is your MongoDB model
      for (const id of notNullCertificationIDs) {
        const validStatus = await verificationWithDatabase(id);
        validCertStatus.push(validStatus);
      }

      if (validCertStatus.length > 0) {

        // Map the data2 values to the corresponding verificationStatus based on the index
        const mergedStatus = notNullCertificationIDs.map((id, index) => {
          const statusIndex = validCertStatus[index]; // Convert to 0-based index
          const status = verificationStatus[statusIndex] || "NA"; // Handle out-of-range indices
          return { id, status };
        });

        // console.log("The extracted data ", notNullCertificationIDs, validCertStatus, mergedStatus);
        return {
          status: "SUCCESS",
          response: true,
          message: messageCode.msgBatchVerification,
          Details: mergedStatus
        };

      }
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgExcelHasExistingIds,
        Details: [notNullCertificationIDs],
      };
    } else {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgNoIdsFound,
      };
    }

  } catch (error) {
    console.error("Error fetching record:", error);
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgProvideValidExcel,
    };
  }
};

module.exports = {
  // Function to verify a certificate with a PDF QR code
  verify,

  // Function to verify Certification page with PDF QR / Zip / Excel
  verifyCustom,

  // Function to verify a Single/Batch certification with an ID
  verifyCertificationId,

  // Function to decode a certificate
  decodeCertificate,

  // Function to verify a certificate with a Scanned Short url/Original url based QR code
  decodeQRScan,

  verifySingleCertificationWithRetry
};
// Load environment variables from .env file
require('dotenv').config();
const path = require("path");
const fs = require("fs");
const ExcelJS = require('exceljs');

// Import required modules
const { validationResult } = require("express-validator");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

const {
    handleRenewCertification,
    handleUpdateCertificationStatus,
    handleRenewBatchOfCertifications,
    handleUpdateBatchCertificationStatus } = require('../services/feature');

// Importing functions from a custom module
const {
    isValidIssuer,
    convertDateFormat,
    isDBConnected,
    getIssuerServiceCredits,
    updateIssuerServiceCredits,
    wipeSourceFile
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { convertToExcel } = require('../dist/convert');

var messageCode = require("../common/codes");

// Import the Issues models from the schema defined in "../config/schema"
const { User, BadgeDetails, BadgeIssues } = require("../config/schema");

var existIssuerId;

// Define the headers
const excelReportHeaders = [
    'Certs',
    'certificationID',
    'name',
    'certificationName',
    'grantDate',
    'expirationDate'
];

/**
 * API call to renew a certification (single / in batch).
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const renewCert = async (req, res) => {
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const certificateNumber = req.body.certificateNumber;
        let _expirationDate = req.body.expirationDate;

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await isValidIssuer(email);
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'renew');
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

        if (req.body.expirationDate == "1" || req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
            _expirationDate = 1;
        } else {
            _expirationDate = await convertDateFormat(req.body.expirationDate);
        }
        if (_expirationDate == null) {
            res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
            return;
        }

        const renewResponse = await handleRenewCertification(email, certificateNumber, _expirationDate);
        const responseDetails = renewResponse.details ? renewResponse.details : '';
        if (renewResponse.code == 200) {
            // Update Issuer credits limit (decrease by 1)
            await updateIssuerServiceCredits(existIssuerId, 'renew');
            return res.status(renewResponse.code).json({ code: renewResponse.code, status: renewResponse.status, message: renewResponse.message, qrCodeImage: renewResponse.qrCodeImage, polygonLink: renewResponse.polygonLink, details: responseDetails });
        }
        res.status(renewResponse.code).json({ code: renewResponse.code, status: renewResponse.status, message: renewResponse.message, details: responseDetails });
    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call to revoke/reactivate a certification status (single / in batch).
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const updateCertStatus = async (req, res) => {
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const certificateNumber = req.body.certificateNumber;
        const certStatus = req.body.certStatus;

        var serviceStatus = parseInt(certStatus) == 3 ? 'revoke' : 'reactivate';

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await isValidIssuer(email);
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, serviceStatus);
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

        const updateResponse = await handleUpdateCertificationStatus(email, certificateNumber, certStatus);
        const responseDetails = updateResponse.details ? updateResponse.details : '';
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, serviceStatus);
        return res.status(updateResponse.code).json({ code: updateResponse.code, status: updateResponse.status, message: updateResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call for Batch Certificates Renewal.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const renewBatchCertificate = async (req, res) => {
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const _batchId = req.body.batch;
        let expirationDate = req.body.expirationDate;
        if (req.body.expirationDate == "1" || req.body.expirationDate == "string" || req.body.expirationDate == null) {
            expirationDate = 1;
        }
        let batchId = parseInt(_batchId);

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await isValidIssuer(email);
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'renew');
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

        const batchResponse = await handleRenewBatchOfCertifications(email, batchId, expirationDate);
        if (!batchResponse) {
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError });
        }
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'renew');
        let responseDetails = batchResponse.details ? batchResponse.details : '';
        return res.status(batchResponse.code).json({ code: batchResponse.code, status: batchResponse.status, message: batchResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call to revoke/reactivate a Batch certification status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const updateBatchStatus = async (req, res) => {
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const _batchId = req.body.batch;
        const _batchStatus = req.body.status;
        const batchId = parseInt(_batchId);
        const batchStatus = parseInt(_batchStatus);

        var serviceStatus = parseInt(batchStatus) == 3 ? 'revoke' : 'reactivate';

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await isValidIssuer(email);
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, serviceStatus);
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

        const batchStatusResponse = await handleUpdateBatchCertificationStatus(email, batchId, batchStatus);
        if (!batchStatusResponse) {
            return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError });
        }
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, serviceStatus);
        const responseDetails = batchStatusResponse.details ? batchStatusResponse.details : '';
        return res.status(batchStatusResponse.code).json({ code: batchStatusResponse.code, status: batchStatusResponse.status, message: batchStatusResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
    }
};


/**
 * API call to convert json/csv/xml file into excel file extension.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const convertIntoExcel = async (req, res) => {

    // Check if the file path matches the pattern
    if (!req.file) {
        // File path does not match the pattern
        let errorMessage = messageCode.msgInvalidFile;
        await wipeSourceFile(req.file.path);
        res.status(400).json({ code: 400, status: "FAILED", message: errorMessage, details: req.file });
        return;
    }
    let originalName = req.file.originalname;
    const getExtension = path.extname(originalName).slice(1);
    const uploadDir = path.join(__dirname, '..', '..', './', req.file.path);
    console.log("the extension", getExtension);
    try {
        const email = req.body.email;
        let dbStatus = isDBConnected();
        if (dbStatus) {
            let isEmailExist = await isValidIssuer(email);
            if (!isEmailExist) {
                res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserEmailNotFound, details: email });
                return;
            }

            // let outputPath = path.join(__dirname, '../../uploads', `test.xlsx`);
            // console.log("Reached", req.file.originalname, uploadDir);

            const targetFileBuffer = await convertToExcel(uploadDir, getExtension);
            // console.log("The response", targetFileBuffer);

            if (!targetFileBuffer || targetFileBuffer == null) {
                res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToConvert });
                await wipeSourceFile(req.file.path);
                return;
            }
            await wipeSourceFile(req.file.path);

            const resultExcel = `converted.xlsx`;

            res.set({
                'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                'Content-Disposition': `attachment; filename="${resultExcel}"`, // Change filename as needed
            });

            // Send excel file
            res.send(targetFileBuffer);
            return;
        }
    } catch (error) {
        await wipeSourceFile(req.file.path);
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
    }

};

/**
 * API call to fetch DB file and generate reports into excel file format.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const generateExcelReport = async (req, res) => {

    try {
        const email = req.body.email;
        const value = parseInt(req.body.value);
        let dbStatus = isDBConnected();
        if (dbStatus) {
            let isEmailExist = await isValidIssuer(email);
            if (!isEmailExist) {
                res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserEmailNotFound, details: email });
                return;
            }

            if (value == 1) {
                // Sample raw data
                const rawData = [
                    { certs: 'CertTitle', certificationID: 'CertID1', name: 'Name1', certificationName: 'SampleName', grantDate: '12/12/2024', expirationDate: '12/12/2024' }
                ];

                // Ensure each object has keys that match the headers
                const formattedData = rawData.map(item => {
                    return {
                        Certs: item.certs,
                        certificationID: item.certificationID,
                        name: item.name,
                        certificationName: item.certificationName,
                        grantDate: item.grantDate,
                        expirationDate: item.expirationDate
                    };
                });

                // Create JSON response
                const jsonResponse = JSON.stringify(formattedData, null, 2);

                if (!jsonResponse) {
                    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToConvert });
                    return;
                }

                // In an Express.js app, you could send this as a response:
                res.json(formattedData);
                return;

            } else if (value == 2) {
                // Create a new workbook and worksheet
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Report');

                // Add headers to the first row
                worksheet.addRow(excelReportHeaders);

                // Generate the Excel file buffer
                const targetFileBuffer = await workbook.xlsx.writeBuffer();

                // const targetFileBuffer = await convertToExcel(uploadDir, getExtension);
                // console.log("The response", targetFileBuffer);

                if (!targetFileBuffer) {
                    res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUnableToConvert });
                    return;
                }

                const resultExcel = `converted.xlsx`;

                res.set({
                    'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    'Content-Disposition': `attachment; filename="${resultExcel}"`, // Change filename as needed
                });

                // Send excel file
                res.send(targetFileBuffer);
                return;
            } else {
                res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidFlag });
                return;
            }
        }
    } catch (error) {
        res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
    }

};

/**
 * API call for Upload Badge details.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const uploadBadge = async (req, res) => {
    const email = req.body.email;
    const badgeCode = req.body.badgeCode;
    const badgeTitle = req.body.badgeTitle;
    const badgeImage = req.body.badgeImage;
    const badgeDescription = req.body.badgeDescription;
    const badgeCriteria = req.body.badgeCriteria; //  Array of strings

    if (!email || !badgeCode || !badgeTitle || !badgeDescription || !badgeCriteria || !badgeImage) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput });
        return;
    }

    const isEmailExist = await User.findOne({ email: email });

    if (!isEmailExist) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgIssueNotFound, details: email });
        return;
    }

    const isBadgeExist = await BadgeDetails.findOne({ badgeCode: badgeCode });
    if (isBadgeExist) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgBadgeCodeExist, details: badgeCode });
        return;
    }

    try {
        const targetBadgeDetails = new BadgeDetails({
            email: email,
            badgeCode: badgeCode,
            badgeTitle: badgeTitle,
            badgeImage: badgeImage,
            badgeDescription: badgeDescription,
            badgeCriteria: badgeCriteria
        });

        await targetBadgeDetails.save();

        res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgBadgeIssued, details: targetBadgeDetails });
        return;

    } catch (error) {
        console.error("An error occured ", error);
        res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
    }
}

/**
 * API call for Get Badge details of an issuer.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getBadges = async (req, res) => {
    const email = req.body.email;
    const badgeCode = req.body?.badgeCode;
    const flag = req.body?.flag;
    var isBadgesExist;
    try {
        if (email) {
            if (badgeCode && badgeCode != "string") {
                isBadgesExist = await BadgeDetails.findOne({ email: email, badgeCode: badgeCode });
            } else {
                isBadgesExist = await BadgeDetails.find({ email: email });
            }
            
            if (isBadgesExist) {
                res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgMatchResultsFound, details: isBadgesExist });
                return;
            } else {
                res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
                return;
            }

        } else {
            res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput });
            return;
        }
    } catch (error) {
        console.error("An error occured ", error);
        res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
    }
}

/**
 * API call for Delete Badge details.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const deleteBadge = async (req, res) => {
    const email = req.body.email;
    const badgeCode = req.body.badgeCode;

    if (!email || !badgeCode) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput });
        return;
    }

    const isBadgeExist = await BadgeDetails.findOne({
        email: email,
        badgeCode: badgeCode
    });

    if (!isBadgeExist) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidBadge, details: badgeCode });
        return;
    }

    try {
        const deleteBadge = await BadgeDetails.deleteOne({
            email: email,
            badgeCode: badgeCode
        });

        if (deleteBadge) {
            res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgBadgeDeleted, details: badgeCode });
            return;
        } else {
            res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgBadgeNotDeleted, details: badgeCode });
            return;
        }
    } catch (error) {
        console.error("An error occured ", error);
        res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
    }
}

/**
 * API call for Badge allocation while Issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const generateBadgeOnIssue = async (req, res) => {
    const email = req.body.email;
    const badgeCode = req.body.badgeCode;
    const certId = req.body.certificateNumber;
    const name = req.body.name;
    const course = req.body.course;
    const txHash = req.body.hash;
    const grantDate = req?.body.grantDate;
    const expirationDate = req?.body.expirationDate;
    var issueDate = Date.now();
    const issuedDate = new Date(issueDate).toLocaleString();

    if (!email || !certId || !name || !course || !txHash) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput });
        return;
    }

    const isEmailExist = await User.findOne({ email: email });

    if (!isEmailExist) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgIssueNotFound, details: email });
        return;
    }

    const isBadgeExist = await BadgeDetails.findOne({
        email: email,
        badgeCode: badgeCode
    });

    if (!isBadgeExist) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidBadge, details: badgeCode });
        return;
    }

    const isCertExist = await BadgeIssues.findOne({ certificateNumber: certId });
    if (isCertExist) {
        res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgBadgeIssuedAlready, details: certId });
        return;
    }

    const linkUrl = `https://${process.env.NETWORK}/tx/${txHash}`;
    const verificationUrl = process.env.SHORT_URL + certId;

    try {
        const badgeDetails = {
            email: email,
            certificateNumber: certId,
            name: name,
            course: course,
            hash: txHash,
            issuedDate: issuedDate,
            badgeTitle: isBadgeExist?.badgeTitle,
            badgeImage: isBadgeExist?.badgeImage,
            badgeDescription: isBadgeExist?.badgeDescription,
            blockchainUrl: linkUrl,
            verificationUrl: verificationUrl
        };

        const badgeIssueDetails = new BadgeIssues({
            email: email,
            certificateNumber: certId,
            name: name,
            course: course,
            hash: txHash,
            badgeTitle: isBadgeExist?.badgeTitle,
            badgeImage: isBadgeExist?.badgeImage,
            badgeDescription: isBadgeExist?.badgeDescription,
            blockchainUrl: linkUrl,
            verificationUrl: verificationUrl
        });

        await badgeIssueDetails.save();

        // const issueBadge = JSON.stringify(badgeDetails);
        res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgBadgeIssued, details: badgeDetails });
        return;

    } catch (error) {
        console.error("An error occured ", error);
        res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
    }
};

module.exports = {
    // Function to renew a certification (single / in batch)
    renewCert,

    // Function to revoke/reactivate a certification (single / in batch)
    updateCertStatus,

    // Function to renew a Batch certifications (the batch)
    renewBatchCertificate,

    // Function to revoke/reactivate a Batch of certifications
    updateBatchStatus,

    // Function to convert xml, json and csv files into excel file format
    convertIntoExcel,

    // Function to fetch DB file and generate reports into excel file format
    generateExcelReport,

    // Function to upload badge details
    uploadBadge,

    // Function to get badges
    getBadges,

    // Function to Delete the badge
    deleteBadge,

    // Function to allocate badge to an issue
    generateBadgeOnIssue

};

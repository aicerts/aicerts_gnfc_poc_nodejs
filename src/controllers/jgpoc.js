// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const QRCode = require("qrcode");
const path = require("path"); // Module for working with file paths
const fs = require("fs");
const AWS = require('../config/aws-config');
const _fs = require("fs-extra");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const readXlsxFile = require("read-excel-file/node");

// Importing functions from a custom module
const {
    isDBConnected, // Function to check if the database connection is established
    calculateHash,
    wipeSourceFile,
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { generateVibrantQr } = require('../utils/generateImage');

// Define allowed Excel file extensions
const allowedExtensions = ['.xls', '.xlsx'];
const sheetName1 = 'Subjects';
const sheetName2 = 'Semester';

// Import MongoDB models
const { User, JGIssue } = require("../config/schema");

const messageCode = require("../common/codes");

const jgAbi = require("../config/jgABI.json");
const jgContractAddress = process.env.JG_CONTRACT_ADDRESS;
const rpcUrl = process.env.JG_RPC_ENDPOINT;

const provider = new ethers.JsonRpcProvider(rpcUrl);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const jgContract = new ethers.Contract(jgContractAddress, jgAbi, signer);

/**
 * API call for JG Issuance.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const jgIssuance = async (req, res) => {
    const email = req.body.email;
    var qrOption = 2;
    var file = req?.file;

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

    try {
        await isDBConnected();
        const issuerExist = await User.findOne({ email: email });
        if (!issuerExist) {
            await wipeSourceFile(req.file.path);
            return res.status(400).json({
                code: 400,
                status: "FAILED",
                message: messageCode.msgInvalidIssuerId
            });
        }

        let filePath = req.file.path;
        // Fetch the records from the Excel file
        const excelData = await validateExcelFile(filePath);
        await wipeSourceFile(req.file.path);
        if (excelData.response === false) {
            return res.status(400).json({
                code: 400,
                status: "FAILED",
                message: excelData.message
            });
        }
        await _fs.remove(filePath);

        const targetData = excelData.message[0];
        const targetMetaData = excelData.message[1];
        const targetList = excelData.message[2];

        try {
            let certificatesCount = targetList.length;
            let batchDetails = [];
            var batchDetailsWithQR = [];
            let insertPromises = []; // Array to hold all insert promises

            for (let i = 0; i < certificatesCount; i++) {
                let today = new Date();
                let todayString = today.getTime().toString(); // Convert epoch time to string
                var serialId = 'SL' + todayString.slice(-10);
                var jgTargetData = JSON.stringify(Object.values(targetData)[i], null, 2);
                var jgMetaData = JSON.stringify(Object.values(targetMetaData)[i]);
                var jgData = Object.values(targetData)[i]; // Get the object directly
                // console.log("The loop item: ", jgData.Name);
                // return res.status(200).json({ code: 200, status: "SUCCESS", message: "Reached", details: excelData.message[2] });
                // try {
                //     // Issue Single Certifications on Blockchain
                //     const tx = await jgContract.issueCertificate(
                //         enrollmentId,
                //         hash,
                //         data
                //     );

                //     var txHash = tx.hash;
                // } catch (error) {
                //     console.error('the error is', error);
                //     return res.status(400).json({
                //         code: 400,
                //         status: 'FAILED',
                //         message: messageCode.msgFailedOpsAtBlockchain,
                //     });
                // }

                var txHash = "0x8f8951d86a04620133abb38c1802c72bbd5d5266632717a945d2309a1356ee1c";
                var blockchain = `https://${process.env.JG_NETWORK}/tx/${txHash}`;

                let _fields = {
                    enrollmentNumber: targetList[i],
                    serial: serialId,
                    name: jgData.Name,
                    transactioHash: txHash, // This should be generated or provided
                    issuer: "www.jgu.certs365.io",
                    issuerId: issuerExist.issuerId,
                    blockchain: blockchain
                }

                // Hash sensitive fields
                const hashedFields = {};
                for (const field in _fields) {
                    hashedFields[field] = calculateHash(_fields[field]);
                }
                const combinedHash = calculateHash(JSON.stringify(hashedFields));

                let modifiedUrl = process.env.JG_SHORT_URL + targetList[i];

                let _qrCodeData = modifiedUrl;

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
                    issuerId: issuerExist?.issuerId,
                    issuer: _fields.issuer,
                    transactionHash: txHash,
                    certificateHash: combinedHash,
                    enrollmentNumber: _fields.enrollmentNumber,
                    serial: serialId,
                    name: _fields.name,
                    verifyLink: modifiedUrl,
                    qrData: qrImageData,
                    blockchain: blockchain
                }

                batchDetails[i] = {
                    issuerId: issuerExist?.issuerId,
                    issuer: _fields.issuer,
                    transactionHash: txHash,
                    certificateHash: combinedHash,
                    enrollmentNumber: _fields.enrollmentNumber,
                    serial: serialId,
                    name: _fields.name,
                    certificateStatus: 1,
                    certificateFields: jgMetaData,
                    verifyLink: modifiedUrl,
                    qrData: qrImageData,
                    blockchain: blockchain
                }

                insertPromises.push(insertJGIssuanceData(batchDetails[i]));
            }
            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);

            res.status(200).json({
                code: 200,
                status: "SUCCESS",
                message: messageCode.msgBatchIssuedSuccess,
                details: batchDetailsWithQR,
                data: targetData,
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
        console.error("An error occured", error);
        await wipeSourceFile(req.file.path);
        return res.status(500).json({
            code: 500,
            status: "FAILED",
            message: messageCode.msgInternalError
        });
    }

};

/**
 * API call for JG S3 Upload.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const jgUpload = async (req, res) => {
    const file = req?.file;
    const filePath = file?.path;
    const enrollmentNumber = req?.body?.id;
    // Validate request parameters
    if (!file || !enrollmentNumber) {
        return res.status(400).send({ code: 400, status: "FAILED", message: "file, enrollmentID are required" });
    }

    const isIdExist = await JGIssue.findOne({ enrollmentNumber: enrollmentNumber });
    if (!isIdExist) {
        await wipeSourceFile(req.file.path);
        return res.status(400).json({
            code: 400,
            status: 'FAILED',
            message: messageCode.msgEnrollIdNotExist,
        });
    }

    const bucketName = process.env.BUCKET_NAME;
    const _keyName = `${enrollmentNumber}.png`;
    const s3 = new AWS.S3();
    const fileStream = fs.createReadStream(filePath);
    const acl = process.env.ACL_NAME;

    const keyPrefix = 'jgissues/';
    const keyName = keyPrefix + _keyName;

    const uploadParams = {
        Bucket: bucketName,
        Key: keyName,
        Body: fileStream,
        ACL: acl
    };

    try {

        const data = await s3.upload(uploadParams).promise();

        isIdExist.url = data?.Location;
        await isIdExist.save();

        console.log('File uploaded and stored successfully to', data.Location);

        await wipeSourceFile(req.file.path);
        res.status(200).send({
            code: 200,
            status: "SUCCESS",
            message: 'File uploaded & URL stored successfully',
            fileUrl: data.Location
        });
        return;
    } catch (error) {
        console.error('Error uploading file:', error);
        await wipeSourceFile(req.file.path);
        res.status(500).send({
            code: 500,
            status: "FAILED",
            message: messageCode.msgInternalError,
            details: error
        });
        return;
    }
};

/**
 * API call for JG Issuance verification.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const jgVerify = async (req, res) => {
    const requestId = req.body.id;
    if (!requestId) {
        return res.status(400).json({
            code: 400,
            status: 'FAILED',
            message: messageCode.msgInvalidInput,
        });
    }
    try {
        const isIdExist = await JGIssue.findOne({ enrollmentNumber: requestId });
        if (!isIdExist) {
            return res.status(400).json({
                code: 400,
                status: 'FAILED',
                message: messageCode.msgEnrollIdNotExist,
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


const validateExcelFile = async (_path) => {
    if (!_path) {
        return { status: "FAILED", response: false, message: "Failed to provide excel file" };
    }
    // api to fetch excel data into json
    const newPath = path.join(..._path.split("\\"));
    const sheetNames = await readXlsxFile.readSheetNames(newPath);
    if (sheetNames.length != 2) {
        return { status: "FAILED", response: false, message: messageCode.msgInvalidExcelSheets, Details: sheetNames };
    }
    try {
        if (sheetNames[0] == sheetName1 && sheetNames[1] == sheetName2) {
            // api to fetch excel data into json
            const rows = await readXlsxFile(newPath, { sheet: sheetName1 });
            const semRows = await readXlsxFile(newPath, { sheet: sheetName2 });

            // Extract headers from the first row
            var headers = rows[0];
            var semHeaders = semRows[0];

            // Limit the headers and data to the first 19 columns
            const maxColumns = 19;
            // Limit the headers and data to the first 8 columns
            const semMaxColumns = 10;

            const limitedHeaders = headers.slice(0, maxColumns);
            const limitedSemHeaders = semHeaders.slice(0, semMaxColumns);

            // Map rows to JSON objects, restricting to the first 8 columns
            const jsonData = rows.slice(1).map(row => {
                const rowData = {};
                limitedHeaders.forEach((header, index) => {
                    rowData[header] = row[index] !== undefined ? row[index] : null; // handle undefined values
                });
                return rowData;
            });

            // Map rows to JSON objects, restricting to the first 8 columns
            const semJsonData = semRows.slice(1).map(row => {
                const semRowData = {};
                limitedSemHeaders.forEach((header, index) => {
                    semRowData[header] = row[index] !== undefined ? row[index] : null; // handle undefined values
                });
                return semRowData;
            });

            const uniqueEnrollmentNumbers = [...new Set(jsonData.map(item => item.EnrollmentNo))];
            const uniqueSemEnrollmentNumbers = [...new Set(semJsonData.map(item => item.EnrollmentNo))];

            if (!enrollmentNumbersCompare(uniqueEnrollmentNumbers, uniqueSemEnrollmentNumbers)) {
                return {
                    status: "FAILED",
                    response: false,
                    message: messageCode.msgIdsNotMatched,
                    Details: [uniqueEnrollmentNumbers, uniqueSemEnrollmentNumbers]
                };
            }

            let matchingIDs = [];
            // Assuming BatchIssues is your MongoDB model
            for (const id of uniqueEnrollmentNumbers) {
                const issueExist = await JGIssue.findOne({ enrollmentNumber: id });
                if (issueExist) {
                    matchingIDs.push(id);
                }
            }
            if (matchingIDs.length > 0) {
                return {
                    status: "FAILED",
                    response: false,
                    message: messageCode.msgExcelHasExistingIds,
                    Details: matchingIDs
                };
            }

            const groupedSubjectsData = await transformSubjectsData(jsonData);
            const groupedSemData = await transformSemData(semJsonData);

            const mergedResult = mergeResponses(groupedSubjectsData, groupedSemData);

            const extractedValues = await extractValues(mergedResult);

            // console.log("Reached", extractedValues);
            // Output the transformed data
            const jsonResponse = JSON.stringify(mergedResult, null, 2);
            // for (var item = 0; item < uniqueEnrollmentNumbers.length; item++) {
            //     // console.log("The loop item: ", Object.values(mergedResult)[item]);
            //     console.log("The loop item: ", JSON.stringify(Object.values(mergedResult)[item], null, 2));
            // }
            // console.log(jsonResponse);
            // return 1;

            return { status: "SUCCESS", response: true, message: [mergedResult, extractedValues, uniqueEnrollmentNumbers] };

        } else {
            return { status: "FAILED", response: false, message: messageCode.msgExcelSheetname };
        }
    } catch (error) {
        console.error('Error fetching record:', error);
        return { status: "FAILED", response: false, message: messageCode.msgProvideValidExcel };
    }
};

const validateBatchCertificateIDs = async (data) => {
    const invalidStrings = [];

    data.forEach((num) => {
        const str = num.toString(); // Convert number to string
        if (
            str.length < min_length ||
            str.length > max_length ||
            specialCharsRegex.test(str)
        ) {
            invalidStrings.push(str);
        }
    });

    if (invalidStrings.length > 0) {
        return invalidStrings; // Return array of invalid strings
    } else {
        return false; // Return false if all strings are valid
    }
};

const transformSemData = async (data) => {
    const result = {};
    data.forEach(item => {
        const enrollmentNo = item.EnrollmentNo;
        const semester = item.Semester.toString();

        // Initialize the structure for a new EnrollmentNo
        if (!result[enrollmentNo]) {
            result[enrollmentNo] = {};
        }

        // Add or update semester data
        result[enrollmentNo][semester] = {
            EnrollmentNo: item.EnrollmentNo,
            Semester: semester,
            Credit: item.Credit.toString(),
            GP: item.GP.toString(),
            SGPA: item.SGPA.toString(),
            CGPA: item.CGPA.toString(),
            MaxMarks: item.MaxMarks.toString(),
            ObtainedMarks: item.ObtainedMarks.toString(),
            Percentage: item.Percentage.toString(),
        };
    });

    return result;
};

const transformSubjectsData = async (data) => {
    const result = {};
    data.forEach(item => {
        const enrollmentNo = item.EnrollmentNo;

        // Initialize the structure for a new EnrollmentNo
        if (!result[enrollmentNo]) {
            result[enrollmentNo] = {
                Name: item.Name,
                EnrollmentNo: item.EnrollmentNo,
                Programme: item.Programme,
                Semester: item.Semester.toString(),
                Examination: item.Examination,
                School: item.School,
                TotalMarks: item.TotalMarks.toString(),
                TGP: item.TGP.toString(),
                TCr: item.TCR.toString(),
                TCP: item.TCP.toString(),
                Result: item.Result,
                Max: item.MaxMarks.toString(),
                Min: item.MinMarks.toString(),
                Subjects: {}
            };
        }

        // Add subject details under the "Subjects" key
        result[enrollmentNo].Subjects[item.SubjectName] = {
            ObtainedMarks: item.ObtainedMarks.toString(),
            Grade: item.Grade,
            MinMarks: item.MinMarks.toString(),
            Credit: item.Credit.toString(),
            CP: item.CP.toString()
        };
    });

    return result;
};

function mergeResponses(response1, response2) {
    const mergedData = {};

    for (const enrollmentNo in response1) {
        const student1 = response1[enrollmentNo];
        const semester = response2[enrollmentNo];

        mergedData[enrollmentNo] = {
            Name: student1.Name,
            EnrollmentNo: student1.EnrollmentNo,
            Programme: student1.Programme, // This was missing in both responses, you may need to add it
            Semester: student1.Semester,
            Examination: student1.Examination,
            School: student1.School,
            TotalMarks: student1.TotalMarks,
            TGP: student1.TGP,
            TCr: student1.TCr,
            TCP: student1.TCP,
            Result: student1.Result,
            Max: student1.Max,
            Min: student1.Min,
            Subjects: student1.Subjects,
            SemesterRecords: []
        };

        // Add semester records
        for (const sem in semester) {
            if (sem.startsWith("Semester")) {
                const semData = semester[sem];
                mergedData[enrollmentNo].SemesterRecords.push({
                    Semester: sem.replace("Semester", "Semester "),
                    Credit: semData.Credit,
                    GP: semData.GP,
                    SGPA: semData.SGPA,
                    CGPA: semData.CGPA,
                    MaxMarks: semData.MaxMarks,
                    ObtainedMarks: semData.ObtainedMarks,
                    Percentage: (parseFloat(semData.Percentage) * 100).toFixed(2) + "%"
                });
            }
        }

        // Sort SemesterRecords by Semester number
        mergedData[enrollmentNo].SemesterRecords.sort((a, b) =>
            parseInt(a.Semester) - parseInt(b.Semester)
        );
    }
    return mergedData;
}

// Function to extract values into a string array do group data by EnrollmentNo
const extractValues = async (data) => {
    const groupedData = [];

    for (const enrollmentNo in data) {
        if (data.hasOwnProperty(enrollmentNo)) {
            const student = data[enrollmentNo];
            const studentArray = [];

            // Add basic details
            studentArray.push(student.Name);
            studentArray.push(student.EnrollmentNo);
            studentArray.push(student.Programme);
            studentArray.push(student.Semester);
            studentArray.push(student.Examination);
            studentArray.push(student.School);
            studentArray.push(student.TotalMarks);
            studentArray.push(student.TGP);
            studentArray.push(student.TCr);
            studentArray.push(student.TCP);
            studentArray.push(student.Result);
            studentArray.push(student.Max);
            studentArray.push(student.Min);

            // Add subject details
            for (const subject in student.Subjects) {
                const subjectDetails = student.Subjects[subject];
                studentArray.push(subject); // Subject name
                studentArray.push(subjectDetails.ObtainedMarks);
                studentArray.push(subjectDetails.Grade);
                studentArray.push(subjectDetails.MinMarks);
                studentArray.push(subjectDetails.Credit);
                studentArray.push(subjectDetails.CP);
            }

            // Add semester records
            for (const record of student.SemesterRecords) {
                studentArray.push(record.Semester);
                studentArray.push(record.Credit);
                studentArray.push(record.GP);
                studentArray.push(record.SGPA);
                studentArray.push(record.CGPA);
                studentArray.push(record.MaxMarks);
                studentArray.push(record.ObtainedMarks);
                studentArray.push(record.Percentage);
            }

            groupedData.push(studentArray); // Add the student's array to the grouped data
        }
    }

    return groupedData;
}

const enrollmentNumbersCompare = async (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
};

const insertJGIssuanceData = async (data) => {
    if (!data) {
        return false;
    }
    try {
        // Create a new Issues document with the provided data
        const newJGIssue = new JGIssue({
            issuerId: data?.issuerId,
            issuer: data?.issuer,
            transactionHash: data?.transactionHash,
            certificateHash: data?.certificateHash,
            enrollmentNumber: data?.enrollmentNumber,
            serial: data?.serial,
            name: data?.name,
            certificateStatus: data?.certificateStatus,
            certificateFields: data?.certificateFields,
            verifyLink: data?.verifyLink,
            qrData: data?.qrData,
            blockchain: data?.blockchain
        });
        // Save the new Issues document to the database
        const result = await newJGIssue.save();
        return true;
    } catch (error) {
        // Handle errors related to database connection or insertion
        console.error('Error connecting to MongoDB:', error);
        return false;
    }
};

module.exports = {
    // Function to issue an Academic certificate
    jgIssuance,

    // Function to upload an Academic certificate
    jgUpload,

    // Function to verify an Academic certificate
    jgVerify
}
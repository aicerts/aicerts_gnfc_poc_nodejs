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
    connectToPolygonPoc,
    wipeSourceFile,
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

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
        await _fs.remove(filePath);

        const formattedData = JSON.stringify(Object.values(excelData.message)[1], null, 2)
        console.log("The loop item: ", formattedData);
        res.status(200).json({ code: 200, status: "SUCCESS", message: "Reached", details: excelData.message[2] });
        await wipeSourceFile(req.file.path);
        return;

        try {
            // Check mongoose connection
            await isDBConnected();
            let certificatesCount = excelData.message[2].length;
            let batchDetails = [];
            var batchDetailsWithQR = [];
            let insertPromises = []; // Array to hold all insert promises

            for (let i = 0; i < certificatesCount; i++) {

                console.log("The loop item: ", JSON.stringify(Object.values(mergedResult)[item], null, 2));
                try {
                    // Issue Single Certifications on Blockchain
                    const tx = await jgContract.issueCertificate(
                        enrollmentId,
                        hash,
                        data
                    );

                    var txHash = tx.hash;
                    var blockchain = `https://${process.env.JG_NETWORK}/tx/${txHash}`;
                } catch (error) {
                    console.error('the error is', error);
                    return res.status(400).json({
                        code: 400,
                        status: 'FAILED',
                        message: messageCode.msgFailedOpsAtBlockchain,
                    });
                }

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
                    qrOption: qrOption,
                    blockchainOption: blockchainPreference
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

            console.log("Reached", extractedValues);
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
        const student2 = response2[enrollmentNo];

        mergedData[enrollmentNo] = {
            Serial: "SN121323", // You may want to generate this dynamically
            IssueDate: new Date().toISOString(),
            transactioHash: "abc232139233bacd", // This should be generated or provided
            issuer: "jgu.certs365.io",
            issuerId: "0xabc231321638253cde",
            blockchain: "www.polygon.com/tx/abc232139233bacd",
            QRCode: "base64code for the QR", // This should be generated
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
        for (const sem in student2) {
            if (sem.startsWith("Semester")) {
                const semData = student2[sem];
                mergedData[enrollmentNo].SemesterRecords.push({
                    Semester: sem.replace("Semester", ""),
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

const insertDeliveryChallanData = async (data) => {
    if (!data) {
      return false;
    }
    try {
      // Create a new Issues document with the provided data
      const newDeliveryChallan = new JGIssue({
        deliveryNo: data?.deliveryNo,
        royaltyPassNo: data?.royaltyPassNo,
        SSPNumber: data?.SSPNumber,
        surveyNo: data?.surveyNo,
        buyerId: data?.buyerId,
        buyerName: data?.buyerName,
        buyerAddress: data?.buyerAddress,
        qrData: data?.qrData,
        issueDate: new Date(),
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

module.exports = {
    // Function to issue an Academic certificate
    jgIssuance,

    // Function to upload an Academic certificate
    jgUpload,

    // Function to verify an Academic certificate
    jgVerify
}
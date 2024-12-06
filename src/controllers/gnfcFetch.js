// Import MongoDB models
const {
  Stakeholders,
  RoyaltyPass,
  DeliveryChallan,
} = require('../config/schema');
// Importing functions from a custom module
const {
  isDBConnected, // Function to check if the database connection is established
} = require('../model/tasks');
const pdf = require('html-pdf');
const fs = require('fs').promises;
const path = require('path');

const leaserList = async (req, res) => {
  try {
    await isDBConnected();
    const leasers = await Stakeholders.find(
      { role: 'Leaser' },
      'name isActive status approvedDate roleId'
    );
    res.status(200).json(leasers);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const stockistList = async (req, res) => {
  try {
    await isDBConnected();
    const leasers = await Stakeholders.find(
      { role: 'Stockist' },
      'name isActive status approvedDate roleId'
    );
    res.status(200).json(leasers);
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// const leaserById = async (req, res) => {
//   try {
//     await isDBConnected();
//     const leaserId = req.params.id;
//     const leaser = await Stakeholders.findOne(
//       {
//         role: 'Leaser',
//         roleId: leaserId,
//       },
//       'name isActive status approvedDate roleId'
//     );
//     res.json({ status: 200, data: leaser });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

const royaltyPassList = async (req, res) => {
  try {
    await isDBConnected();
    const leaserId = req.params.leaserId;
    const list = await RoyaltyPass.find({
      leaserId,
    });
    res.json({ status: 200, data: list });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deliveryChallanList = async (req, res) => {
  try {
    await isDBConnected();
    const stackHolderRoleId = req.params.stackHolderRoleId; // User will either leaser or stockist
    const list = await DeliveryChallan.find({
      buyerId: stackHolderRoleId,
    });
    res.json({ status: 200, data: list });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const wholeTracker = async (req, res) => {
//   try {
//     await isDBConnected();
//     const deliveryNo = req.params.deliveryChallan;
//     const deliveryChallan = await DeliveryChallan.findOne({
//       deliveryNo,
//     });
//     const royaltyPass = await RoyaltyPass.findOne({
//       royaltyPassNo: deliveryChallan.royaltyPassNo,
//     });
//     const leaser = await Stakeholders.findOne(
//       {
//         role: 'Leaser',
//         roleId: royaltyPass.leaserId,
//       },
//       'name isActive status approvedDate roleId'
//     );
//     res.json({
//       status: 200,
//       data: {
//         deliveryChallan,
//         royaltyPass,
//         leaser,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

const royaltyPassDailyReport = async (req, res) => {
  try {
    await isDBConnected();
    // const start = new Date();
    // start.setHours(0, 0, 0, 0);

    // const end = new Date();
    // end.setHours(23, 59, 59, 999);

    const count = await RoyaltyPass.countDocuments({
      issuanceDate: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999),
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const royaltyPassWeeklyReport = async (req, res) => {
  try {
    await isDBConnected();
    const start = new Date();
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const weekStart = new Date(start.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const count = await RoyaltyPass.countDocuments({
      issuanceDate: {
        $gte: weekStart,
        $lt: weekEnd,
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const royaltyPassMonthlyReport = async (req, res) => {
  try {
    await isDBConnected();
    const start = new Date();
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setHours(23, 59, 59, 999);

    const count = await RoyaltyPass.countDocuments({
      issuanceDate: {
        $gte: monthStart,
        $lt: monthEnd,
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const royaltyPassAnnualReport = async (req, res) => {
  try {
    await isDBConnected();
    const start = new Date(new Date().getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(new Date().getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);

    const count = await RoyaltyPass.countDocuments({
      issuanceDate: {
        $gte: start,
        $lt: end,
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deliveryChallanDailyReport = async (req, res) => {
  try {
    await isDBConnected();
    // const start = new Date();
    // start.setHours(0, 0, 0, 0);

    // const end = new Date();
    // end.setHours(23, 59, 59, 999);

    const count = await DeliveryChallan.countDocuments({
      issuanceDate: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999),
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deliveryChallanWeeklyReport = async (req, res) => {
  try {
    await isDBConnected();
    const start = new Date();
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const weekStart = new Date(start.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const count = await DeliveryChallan.countDocuments({
      issuanceDate: {
        $gte: weekStart,
        $lt: weekEnd,
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deliveryChallanMonthlyReport = async (req, res) => {
  try {
    await isDBConnected();
    const start = new Date();
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setHours(23, 59, 59, 999);

    const count = await DeliveryChallan.countDocuments({
      issuanceDate: {
        $gte: monthStart,
        $lt: monthEnd,
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deliveryChallanAnnualReport = async (req, res) => {
  try {
    await isDBConnected();
    const start = new Date(new Date().getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(new Date().getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);

    const count = await DeliveryChallan.countDocuments({
      issuanceDate: {
        $gte: start,
        $lt: end,
      },
    });
    res.json({
      status: 200,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const generateRoyaltyPassVerificationPDF = async (req, res) => {
//   try {
//     const royaltyPassNo = req.params.royaltyPassNo;
//     await isDBConnected();
//     const royaltyPass = await RoyaltyPass.findOne({ royaltyPassNo });
//     const htmlContent = await royaltyPassHtml(royaltyPass);
//     pdf
//       .create(htmlContent, {
//         // format: 'A4', // Optional, can set specific formats like 'A4' or 'Letter'
//         width: '210mm', // Custom width (e.g., 210mm for A4 width)
//         height: '130mm', // Custom height (e.g., 297mm for A4 height)
//       })
//       .toBuffer((err, buffer) => {
//         if (err) {
//           return res.status(500).send('Error generating PDF');
//         }

//         // Set headers to indicate the response is a PDF file
//         res.setHeader(
//           'Content-Disposition',
//           `attachment; filename="Royalty Pass - ${royaltyPassNo}.pdf"`
//         );
//         res.setHeader('Content-Type', 'application/pdf');
//         res.status(200).send(buffer); // Send the PDF buffer as response
//         res.status(500).json({ message: 'Internal Server Error' });
//       });
//   } catch (err) {
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

// const generateDeliveryChallanVerificationPDF = async (req, res) => {
//   try {
//     const deliveryNo = req.params.deliveryChallan;
//     await isDBConnected();
//     const deliveryChallan = await DeliveryChallan.findOne({ deliveryNo });
//     const htmlContent = await deliveryChallanHtml(deliveryChallan);
//     pdf
//       .create(htmlContent, {
//         // format: 'A4', // Optional, can set specific formats like 'A4' or 'Letter'
//         width: '210mm', // Custom width (e.g., 210mm for A4 width)
//         height: '297mm', // Custom height (e.g., 297mm for A4 height)
//       })
//       .toBuffer((err, buffer) => {
//         if (err) {
//           return res.status(500).send('Internal Server Error');
//         }

//         // Set headers to indicate the response is a PDF file
//         res.setHeader(
//           'Content-Disposition',
//           `attachment; filename="Delivery Challan - ${deliveryNo}.pdf"`
//         );
//         res.setHeader('Content-Type', 'application/pdf');
//         res.status(200).send(buffer); // Send the PDF buffer as response
//       });
//   } catch (err) {
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

// const generateWholeRecordVerificationPDF = async (req, res) => {
//   try {
//     const deliveryNo = req.params.deliveryChallan;
//     await isDBConnected();
//     // Delivery Challan Details
//     const deliveryChallan = await DeliveryChallan.findOne({
//       deliveryNo,
//     });

//     // Royalty Pass details
//     const royaltyPass = await RoyaltyPass.findOne({
//       royaltyPassNo: deliveryChallan.royaltyPassNo,
//     });

//     // Leaser Details
//     const leaser = await Stakeholders.findOne(
//       {
//         role: 'Leaser',
//         roleId: royaltyPass.leaserId,
//       },
//       'name isActive approvedDate roleId'
//     );
//     // const htmlContent = await deliveryChallanHtml(deliveryChallan);
//     let htmlContent = leaserHtml(leaser);
//     htmlContent += await royaltyPassHtml(royaltyPass);
//     htmlContent += await deliveryChallanHtml(deliveryChallan);

//     pdf
//       .create(htmlContent, {
//         // format: 'A4', // Optional, can set specific formats like 'A4' or 'Letter'
//         width: '210mm', // Custom width (e.g., 210mm for A4 width)
//         height: '130mm', // Custom height (e.g., 297mm for A4 height)
//       })
//       .toBuffer((err, buffer) => {
//         if (err) {
//           return res.status(500).send('Internal Server Error');
//         }

//         // Set headers to indicate the response is a PDF file
//         res.setHeader(
//           'Content-Disposition',
//           `attachment; filename="Delivery Challan Tracker - ${deliveryNo}.pdf"`
//         );
//         res.setHeader('Content-Type', 'application/pdf');
//         res.status(200).send(buffer); // Send the PDF buffer as response
//       });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

// function leaserHtml(leaser) {
//   return `
//   <br><br>
//     <table style="font-family: Arial; font-size: 16px; border: 1px solid #000; width: 880px; border-collapse: collapse; margin-top: 30px; margin: auto; padding-top: 30px">
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Leaser Id :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${leaser.roleId}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Leaser Name :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${leaser.name}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Onboarding Date :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${formatDate(leaser.approvedDate)}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Status :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${leaser.isActive ? 'Active' : 'Deactive'}
//         </td>
//       </tr>
//     </table>
//   `;
// }

// async function royaltyPassHtml(royaltyPass) {
//   const barcodeSrc = await barcodeBase64();
//   return `
//   <div>
//     <table style="font-family: Arial; font-size: 16px; border-spacing: 40px;">
//       <tr>
//         <td>
//           <img src='${royaltyPass.qrData}' style="width: 150px; height: 150px"/>
//         </td>
//         <td style="width: 700px;">
//           <table style="font-family: Arial; font-size: 16px; border: 1px solid #000; width: 700px; height: 130px; border-collapse: collapse;">
//             <tr>
//               <td style="text-align: center; border-bottom: 1px solid #000000; border-right: 1px solid #000000;">Royalty Pass - Geology And Mining</td>
//               <td style="text-align: center; border-bottom: 1px solid #000000;">Royalty Pass No.</td>
//             </tr>
//             <tr>
//               <td style="text-align: center; border-bottom: 1px solid #000000; border-right: 1px solid #000000;">Copy For: Vehicle Driver</td>
//               <td style="text-align: center; border-bottom: 1px solid #000000;">${
//                 royaltyPass.royaltyPassNo
//               }</td>
//             </tr>
//             <tr>
//               <td style="text-align: center; border-right: 1px solid #000000;">
//                 Issue - Print 1<br>
//                 ${formatDate()}
//               </td>
//               <td style="text-align: center;">
//                 <img src='${barcodeSrc}' style="width: 200px; height:45px;" />
//               </td>
//             </tr>
//           </table>
//         </td>
//       </tr>
//     </table>
//   </div>
//   <div>
//     <table style="font-family: Arial; font-size: 16px; border: 1px solid #000; width: 880px; border-collapse: collapse; margin: auto">
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; height: 48">
//           <b>Lease Holder :</b>
//         </td>
//         <td colspan="3" style="border-bottom: 1px solid #000000;">
//           ${royaltyPass.leaserId}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Issue Date & Time :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${formatDate(royaltyPass.issuanceDate)}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>SSP Number :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${royaltyPass.SSPNumber}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Village/ Survey No :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${royaltyPass.village + '/ ' + (royaltyPass.surveyNo || '-')}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Lease Valid Up To Date :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${formatDate(royaltyPass.leaseValidUpto).slice(0, -8)}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>District :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${royaltyPass.district}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Taluka :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${royaltyPass.taluke}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Mineral Name (Grade):</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${`${royaltyPass.mineralName} (${royaltyPass.mineralGrade})`}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Initial Quantity(MT):</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${royaltyPass.initialQuantatity}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Journey Start Date :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${formatDate(royaltyPass.journeyStartDate)}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Journey End Date :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${formatDate(royaltyPass.journeyEndDate)}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Distance :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${royaltyPass.distance}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Duration :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${royaltyPass.duration}(s) 0 Hour(s) 0 Minute(s)
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Driver Name :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${royaltyPass.driverName}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Driver's Licence No :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${royaltyPass.driverLiceneceNo}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Driver Mobile Number :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${royaltyPass.driverMobileNumber || 'N/A'}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Vehicle Type/ Number :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${`${royaltyPass.vehicleType} / (${royaltyPass.vehicleNumber})`}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Weighbridge Name :</b>
//         </td>
//         <td colspan="2" style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${royaltyPass.weightBridgeName}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-right: 1px solid #000000; ">
//           <b>Destination / Address :</b>
//         </td>
//         <td colspan="2" style="border-right: 1px solid #000000; ">
//           ${`${royaltyPass.destination} / (${royaltyPass.address})`}
//         </td>
//       </tr>

//     </table>
//   </div>
// `;
// }

// async function deliveryChallanHtml(deliveryChallan) {
//   const barcodeSrc = await barcodeBase64();
//   return `
//   <div>
//     <table style="font-family: Arial; font-size: 16px; border-spacing: 40px;">
//       <tr>
//         <td>
//           <img src='${
//             deliveryChallan.qrData
//           }' style="width: 150px; height: 150px"/>
//         </td>
//         <td style="width: 700px;">
//           <table style="font-family: Arial; font-size: 16px; border: 1px solid #000; width: 700px; height: 130px; border-collapse: collapse;">
//             <tr>
//               <td style="text-align: center; border-bottom: 1px solid #000000; border-right: 1px solid #000000;">
//                 Geology And Mining (Gujarat)
//               </td>
//               <td style="text-align: center; border-bottom: 1px solid #000000;">
//                 Delivery Challan Code.
//               </td>
//             </tr>
//             <tr>
//               <td style="text-align: center; border-bottom: 1px solid #000000; border-right: 1px solid #000000;">Copy For: Vehicle Driver</td>
//               <td style="text-align: center; border-bottom: 1px solid #000000;">${
//                 deliveryChallan.deliveryNo
//               }</td>
//             </tr>
//             <tr>
//               <td style="text-align: center; border-right: 1px solid #000000;">
//                 Issue - Print 1<br>
//                 Issue On: ${formatDate(deliveryChallan.issuanceDate)}
//               </td>
//               <td style="text-align: center;">
//                 <img src='${barcodeSrc}' style="width: 200px; height:45px;" />
//               </td>
//             </tr>
//           </table>
//         </td>
//       </tr>
//     </table>
//   </div>
//   <div>
//     <table style="font-family: Arial; font-size: 16px; border: 1px solid #000; width: 880px; border-collapse: collapse; margin: auto">
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Tin No. & Time :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${deliveryChallan.tinNo || '-'}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Delivery Challan No :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${deliveryChallan.deliveryNo}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Survey No :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${deliveryChallan.surveyNo}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Stockist Reg. No :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${deliveryChallan.buyerId}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; height: 48">
//           <b>Stockist Holder :</b>
//         </td>
//         <td colspan="3" style="border-bottom: 1px solid #000000;">
//           ${deliveryChallan.buyerName}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Village / Pin Code:</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000;">
//           ${deliveryChallan.village} / ${deliveryChallan.pincode}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>SSP Number :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${deliveryChallan.SSPNumber}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Purchaser :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${deliveryChallan.purchaser || 'Rameshbhai Doshi'}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Vehicle Type/ No :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${deliveryChallan.vehicleType} / ${deliveryChallan.vehicleNumber}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Mineral Name (Grade):</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000;">
//           ${deliveryChallan.mineralName} (${deliveryChallan.mineralGrade})
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>District / Taluka :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${deliveryChallan.district} / ${deliveryChallan.taluke}
//         </td>
//       </tr>
//       <tr>
//       <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Initial Quantity(MT):</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${deliveryChallan.initialQuantatity}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>T.Mode / Distance :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${deliveryChallan.transportationMode || '-'} /
//           ${deliveryChallan.transportationDistance || '-'}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Journey Start Date :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           ${formatDate(deliveryChallan.journeyStartDate)}
//         </td>
//         <td style="border-bottom: 1px solid #000000; border-right: 1px solid #000000; ">
//           <b>Journey End Date :</b>
//         </td>
//         <td style="border-bottom: 1px solid #000000; ">
//           ${formatDate(deliveryChallan.journeyEndDate)}
//         </td>
//       </tr>
//       <tr>
//         <td style="border-right: 1px solid #000000; ">
//           <b>Driver Name :</b>
//         </td>
//         <td style="border-right: 1px solid #000000; ">
//           ${deliveryChallan.driverName}
//         </td>
//         <td style="border-right: 1px solid #000000; ">
//           <b>Driver's Licence No :</b>
//         </td>
//         <td>
//           ${deliveryChallan.driverLiceneceNo}
//         </td>
//       </tr>

//     </table>
//   </div>
// `;
// }

// function formatDate(date = new Date()) {
//   // const date = new Date();

//   const day = String(date.getDate()).padStart(2, '0'); // Day with leading zero if needed
//   const month = date.toLocaleString('default', { month: 'short' }); // Get short month name
//   const year = date.getFullYear(); // Get year
//   const hours = date.getHours(); // Get hours
//   const minutes = String(date.getMinutes()).padStart(2, '0'); // Minutes with leading zero if needed
//   const ampm = hours >= 12 ? 'PM' : 'AM'; // Determine AM or PM
//   const formattedHours = hours % 12 || 12; // Convert 24-hour format to 12-hour format

//   return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
// }

// async function barcodeBase64() {
//   const filePath = path.join(__dirname, '..', '..', 'assets', 'barcode.png');
//   const fileBuffer = await fs.readFile(filePath);
//   const base64Img = fileBuffer.toString('base64');
//   return `data:image/png;base64,${base64Img}`;
// }

module.exports = {
  leaserList,
  stockistList,
  // leaserById,
  royaltyPassList,
  deliveryChallanList,
  // wholeTracker,
  royaltyPassDailyReport,
  royaltyPassWeeklyReport,
  royaltyPassMonthlyReport,
  royaltyPassAnnualReport,
  deliveryChallanDailyReport,
  deliveryChallanWeeklyReport,
  deliveryChallanMonthlyReport,
  deliveryChallanAnnualReport,
  // generateRoyaltyPassVerificationPDF,
  // generateDeliveryChallanVerificationPDF,
  // generateWholeRecordVerificationPDF,
};

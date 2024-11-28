const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for the Admin model
const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name field is of type String and is required
  email: { type: String, required: true }, // Email field is of type String and is required
  password: { type: String, required: true }, // Password field is of type String and is required
  status: { type: Boolean, required: true } // Status field is of type Boolean and is required
});

// Define the schema for the IssueStatus model
const ServerDetailsSchema = new mongoose.Schema({
  email: { type: String, required: true }
});

// Define the schema for the ServiceQuota model
const ServiceAccountQuotasSchema = new Schema({
  issuerId: { type: String, required: true }
});

// Define the schema for the User/Isseur model
const UserSchema = new Schema({
  name: { type: String, required: true }
});

// Define the schema for the Issues model
const IssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true } // ID field is of type String and is required
});

// Batch Issues Schema
const BatchIssuesSchema = new Schema({
  issuerId: { type: String, required: true }
});

// Define the schema for the IssueStatus model
const IssueStatusSchema = new mongoose.Schema({
  email: { type: String, required: true }
});

// Define the schema for the Dynamic single Issues model
const DynamicIssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true } // ID field is of type String and is required
});

// Define the schema for the Dynamic batch Issues model
const DynamicBatchIssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true } // ID field is of type String and is required
});

// Define the schema for the VerificationLog model
const VerificationLogSchema = new mongoose.Schema({
  email: { type: String, required: true }
});

// Define the schema for the Short URL model
const ShortUrlSchema = new mongoose.Schema({
  email: { type: String, required: true }
});

// Define the schema for the Issues model
const DynamicParamsSchema = new mongoose.Schema({
  email: { type: String, required: true }
});

// Define the schema for Blockchain Badges issued
const BlockchainBadgesSchema = new mongoose.Schema({
  email: { type: String }
});

// Define the schema for Blockchain Badges issued
const BlockchainBadgeIssuesSchema = new mongoose.Schema({
  email: { type: String }
});

// Define the schema for Stakeholders ( Leaser / Stockist / Distributor / Retailor / Company )
const StakeholdersSchema = new mongoose.Schema({
  email: { type: String, required: true },
});

// Define the schema for Lease (POC)
const LeaserSchema = new mongoose.Schema({
  email: { type: String, required: true },
});

// Schema for royalty pass (POC)
const RoyaltyPassSchema = new mongoose.Schema({
  royaltyPassNo: { type: String, unique: true },
  leaserId: { type: String },
  issuedDate: { type: Date, default: Date.now },
  leaseValidUpto: { type: Date },
  SSPNumber: { type: String },
  village: { type: String },
  taluke: { type: String },
  district: { type: String },
  mineralName: { type: String },
  mineralGrade: { type: String },
  initialQuantatity: { type: Number },
  journeyStartDate: { type: Date },
  journeyEndDate: { type: Date },
  distance: { type: String },
  duration: { type: String },
  driverName: { type: String },
  driverLiceneceNo: { type: String },
  driverMobileNumber: { type: String },
  vehicleType: { type: String },
  vehicleNumber: { type: String },
  weightBridgeName: { type: String },
  destinaton: { type: String },
  address: { type: String }
});

// Schema for Delivery Challan
const DeliveryChallanSchema = new mongoose.Schema({
  royaltyPassNo: { type: String },
  deliveryNo: { type: String, unique: true },
  SSPNumber: { type: String },
  surveyNo: { type: String },
  buyerId: { type: String }, // Stackholder userId who is Stockist
  buyerName: { type: String },
  buyerAddress: { type: String },
  initialQuantatity: { type: Number },
  village: { type: String },
  taluke: { type: String },
  district: { type: String },
  pincode: { type: Number },
  transportationMode: { type: String },
  transportationDistance: { type: String },
  journeyStartDate: { type: Date },
  journeyEndDate: { type: Date },
  driverName: { type: String },
  driverLiceneceNo: { type: String },
  vehicleType: { type: String },
  vehicleNumber: { type: String }
});


const Admin = mongoose.model('Admin', AdminSchema);
const ServiceAccountQuotas = mongoose.model('ServiceAccountQuotas', ServiceAccountQuotasSchema);
const User = mongoose.model('User', UserSchema);
const Issues = mongoose.model('Issues', IssuesSchema);
const BatchIssues = mongoose.model('BatchIssues', BatchIssuesSchema);
const IssueStatus = mongoose.model('IssueStatus', IssueStatusSchema);
const DynamicIssues = mongoose.model('DynamicIssues', DynamicIssuesSchema);
const DynamicBatchIssues = mongoose.model('DynamicBatchIssues', DynamicBatchIssuesSchema);
const VerificationLog = mongoose.model('VerificationLog', VerificationLogSchema);
const ShortUrl = mongoose.model('ShortUrl', ShortUrlSchema);
const DynamicParameters = mongoose.model('DynamicParameters', DynamicParamsSchema);
const ServerDetails = mongoose.model('ServerDetails', ServerDetailsSchema);
const BadgeDetails = mongoose.model('BadgeDetails', BlockchainBadgesSchema);
const BadgeIssues = mongoose.model('BadgeIssues', BlockchainBadgeIssuesSchema);
const Stakeholders = mongoose.model('Stakeholders', StakeholdersSchema);
const Leaser = mongoose.model('Leaser', LeaserSchema);
const RoyaltyPass = mongoose.model('RoyaltyPass', RoyaltyPassSchema);
const DeliveryChallan = mongoose.model('DeliveryChallan', DeliveryChallanSchema);

module.exports = {
  Admin,
  ServerDetails,
  ServiceAccountQuotas,
  User,
  Issues,
  BatchIssues,
  IssueStatus,
  DynamicIssues,
  DynamicBatchIssues,
  VerificationLog,
  ShortUrl,
  DynamicParameters,
  BadgeDetails,
  BadgeIssues,
  Stakeholders,
  Leaser,
  RoyaltyPass,
  DeliveryChallan
};
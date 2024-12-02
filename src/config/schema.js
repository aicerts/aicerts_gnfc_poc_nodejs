const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for the Admin model
const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name field is of type String and is required
  email: { type: String, required: true }, // Email field is of type String and is required
  password: { type: String, required: true }, // Password field is of type String and is required
  status: { type: Boolean, required: true }, // Status field is of type Boolean and is required
});

// Define the schema for the IssueStatus model
const ServerDetailsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  serverName: { type: String, default: null },
  serverEndpoint: { type: String, default: null },
  serverAddress: { type: String, default: null },
  serverStatus: { type: Boolean, default: true },
  lastUpdate: { type: Date, default: Date.now }, // IssueDate field is of type Date and defaults to the current date/time
});

// Define the schema for the ServiceQuota model
const ServiceAccountQuotasSchema = new Schema({
  issuerId: { type: String, required: true }, // Issuer Id field is of type String and is required
  serviceId: { type: String, required: true }, // Service Id field is of type String and is required
  limit: { type: Number, default: 0 },
  status: { type: Boolean },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resetAt: { type: Date, default: Date.now },
});

// Define the schema for the User/Isseur model
const UserSchema = new Schema({
  name: { type: String, required: true },
  organization: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  issuerId: { type: String, required: true },
  approved: { type: Boolean },
  status: { type: Number },
  address: { type: String },
  country: { type: String },
  organizationType: { type: String },
  city: { type: String },
  zip: { type: String },
  industrySector: { type: String },
  state: { type: String },
  websiteLink: { type: String },
  phoneNumber: { type: String },
  designation: { type: String },
  username: { type: String, unique: true },
  rejectedDate: { type: Date, default: null },
  invoiceNumber: { type: Number, default: 0 },
  batchSequence: { type: Number, default: 0 },
  transactionFee: { type: Number, default: 0 },
  qrPreference: { type: Number, default: 0 },
  blockchainPreference: { type: Number, default: 0 },
  certificatesIssued: { type: Number },
  certificatesRenewed: { type: Number },
  approveDate: { type: Date, default: null },
});

// Define the schema for the Issues model
const IssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true }, // ID field is of type String and is required
  transactionHash: { type: String, required: true }, // TransactionHash field is of type String and is required
  certificateHash: { type: String, required: true }, // CertificateHash field is of type String and is required
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type String and is required
  name: { type: String, required: true }, // Name field is of type String and is required
  course: { type: String, required: true }, // Course field is of type String and is required
  grantDate: { type: String, required: true }, // GrantDate field is of type String and is required
  expirationDate: { type: String, required: true }, // ExpirationDate field is of type String and is required
  certificateStatus: { type: Number, required: true, default: 1 },
  issueDate: { type: Date, default: Date.now }, // issueDate field is of type Date and defaults to the current date/time
  positionX: { type: Number, default: 0 },
  positionY: { type: Number, default: 0 },
  qrSize: { type: Number, default: 0 },
  width: { type: Number },
  height: { type: Number },
  qrOption: { type: Number, default: 0 },
  url: { type: String },
  type: { type: String, default: null },
});

// Batch Issues Schema
const BatchIssuesSchema = new Schema({
  issuerId: { type: String, required: true },
  batchId: { type: Number, required: true },
  proofHash: [String],
  encodedProof: { type: String, required: true },
  transactionHash: { type: String, required: true },
  certificateHash: { type: String, required: true },
  certificateNumber: { type: String, required: true },
  name: { type: String, required: true },
  course: { type: String, required: true },
  grantDate: { type: String, required: true },
  expirationDate: { type: String, required: true },
  certificateStatus: { type: Number, default: 1 },
  issueDate: { type: Date, default: Date.now },
  positionX: { type: Number, default: 0 },
  positionY: { type: Number, default: 0 },
  qrSize: { type: Number, default: 0 },
  width: { type: Number },
  height: { type: Number },
  qrOption: { type: Number, default: 0 },
  url: { type: String },
});

// Define the schema for the IssueStatus model
const IssueStatusSchema = new mongoose.Schema({
  email: { type: String, required: true },
  issuerId: { type: String, required: true }, // ID field is of type String and is required
  batchId: { type: Number, default: null },
  transactionHash: { type: String, required: true }, // TransactionHash field is of type String and is required
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type String and is required
  name: { type: String, required: true }, // Name field is of type String and is required
  course: { type: String, default: 0 },
  expirationDate: { type: String, default: 0 }, // ExpirationDate field is of type String and is required
  certStatus: { type: Number },
  lastUpdate: { type: Date, default: Date.now }, // IssueDate field is of type Date and defaults to the current date/time
});

// Define the schema for the Dynamic single Issues model
const DynamicIssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true }, // ID field is of type String and is required
  transactionHash: { type: String, required: true }, // TransactionHash field is of type String and is required
  certificateHash: { type: String, required: true }, // CertificateHash field is of type String and is required
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type String and is required
  name: { type: String }, // Name field is of type String and is required
  certificateStatus: { type: Number, required: true, default: 1 },
  certificateFields: { type: Object, required: true },
  issueDate: { type: Date, default: Date.now }, // issueDate field is of type Date and defaults to the current date/time
  width: { type: Number },
  height: { type: Number },
  positionX: { type: Number, default: 0 },
  positionY: { type: Number, default: 0 },
  qrSize: { type: Number, default: 0 },
  qrOption: { type: Number, default: 0 },
  url: { type: String },
  type: { type: String, default: 'dynamic' },
});

// Define the schema for the Dynamic batch Issues model
const DynamicBatchIssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true }, // ID field is of type String and is required
  batchId: { type: Number, required: true },
  proofHash: [String],
  encodedProof: { type: String, required: true },
  transactionHash: { type: String, required: true }, // TransactionHash field is of type String and is required
  certificateHash: { type: String, required: true }, // CertificateHash field is of type String and is required
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type String and is required
  name: { type: String }, // Name field is of type String and is required
  certificateStatus: { type: Number, required: true, default: 1 },
  certificateFields: { type: Object, required: true },
  issueDate: { type: Date, default: Date.now }, // issueDate field is of type Date and defaults to the current date/time
  width: { type: Number },
  height: { type: Number },
  positionX: { type: Number, default: 0 },
  positionY: { type: Number, default: 0 },
  qrSize: { type: Number, default: 0 },
  qrOption: { type: Number, default: 0 },
  url: { type: String },
  type: { type: String, default: 'dynamic' },
});

// Define the schema for the VerificationLog model
const VerificationLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  issuerId: { type: String, required: true }, // ID field is of type String and is required
  courses: { type: Object, required: true }, // Using Object type for dynamic key-value pairs
  lastUpdate: { type: Date, default: Date.now }, // IssueDate field is of type Date and defaults to the current date/time
});

// Define the schema for the Short URL model
const ShortUrlSchema = new mongoose.Schema({
  email: { type: String, required: true },
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type
  url: { type: String, required: true },
});

// Define the schema for the Issues model
const DynamicParamsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  positionX: { type: Number, required: true },
  positionY: { type: Number, required: true },
  qrSide: { type: Number, required: true },
  pdfWidth: { type: Number, required: true },
  pdfHeight: { type: Number, required: true },
  paramStatus: { type: Boolean, default: false },
  modifiedDate: { type: Date, default: Date.now }, // issueDate field is of type Date and defaults to the current date/time
});

// Define the schema for Blockchain Badges issued
const BlockchainBadgesSchema = new mongoose.Schema({
  email: { type: String },
  badgeCode: { type: String },
  badgeTitle: { type: String },
  badgeImage: { type: String },
  badgeDescription: { type: String },
  badgeCriteria: { type: [String] },
  modifiedDate: { type: Date, default: Date.now },
  badgeActive: { type: Boolean, default: true },
});

// Define the schema for Blockchain Badges issued
const BlockchainBadgeIssuesSchema = new mongoose.Schema({
  email: { type: String },
  certificateNumber: { type: String },
  name: { type: String },
  course: { type: String },
  hash: { type: String },
  badgeTitle: { type: String },
  badgeImage: { type: String },
  badgeDescription: { type: String },
  blockchainUrl: { type: String },
  verificationUrl: { type: String },
  issuedDate: { type: Date, default: Date.now },
});

// Define the schema for Stakeholders ( Leaser / Stockist / Distributor / Retailor / Company )
const StakeholdersSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  role: { type: String },
  userId: { type: String },
  roleId: { type: String },
  password: { type: String },
  isActive: { type: Boolean, default: true },
  status: { type: String },
  approvedDate: { type: Date, default: null },
  issuedDate: { type: Date, default: Date.now },
});

// Define the schema for Lease (POC)
const LeaserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  role: { type: String },
  userId: { type: String },
  leaserId: { type: String },
  leaserHash: { type: String },
  transactionHash: { type: String },
  isActive: { type: Boolean, default: true },
  blockchainUrl: { type: String },
  issuedDate: { type: Date, default: Date.now },
});

// Schema for royalty pass (POC)
const RoyaltyPassSchema = new mongoose.Schema({
  royaltyPassNo: { type: String, unique: true },
  leaserId: { type: String, default: 'GNFCLEASER001' },
  issuedDate: { type: Date, default: Date.now },
  leaseValidUpto: { type: Date },
  SSPNumber: { type: String },
  surveyNo: { type: String },
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
  destination: { type: String },
  address: { type: String },
  transactionHash: { type: String },
  url: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  qrData: { type: String },
  issuanceDate: { type: Date },
});

// Schema for Delivery Challan
const DeliveryChallanSchema = new mongoose.Schema({
  deliveryNo: { type: String, unique: true },
  royaltyPassNo: { type: String },
  SSPNumber: { type: String },
  surveyNo: { type: String },
  buyerId: { type: String }, // Stackholder userId who is Stockist
  buyerName: { type: String },
  buyerAddress: { type: String },
  mineralName: { type: String },
  mineralGrade: { type: String },
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
  vehicleNumber: { type: String },
  transactionHash: { type: String },
  url: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  qrData: { type: String },
  issuanceDate: { type: Date },
});

const Admin = mongoose.model('Admin', AdminSchema);
const ServiceAccountQuotas = mongoose.model(
  'ServiceAccountQuotas',
  ServiceAccountQuotasSchema
);
const User = mongoose.model('User', UserSchema);
const Issues = mongoose.model('Issues', IssuesSchema);
const BatchIssues = mongoose.model('BatchIssues', BatchIssuesSchema);
const IssueStatus = mongoose.model('IssueStatus', IssueStatusSchema);
const DynamicIssues = mongoose.model('DynamicIssues', DynamicIssuesSchema);
const DynamicBatchIssues = mongoose.model(
  'DynamicBatchIssues',
  DynamicBatchIssuesSchema
);
const VerificationLog = mongoose.model(
  'VerificationLog',
  VerificationLogSchema
);
const ShortUrl = mongoose.model('ShortUrl', ShortUrlSchema);
const DynamicParameters = mongoose.model(
  'DynamicParameters',
  DynamicParamsSchema
);
const ServerDetails = mongoose.model('ServerDetails', ServerDetailsSchema);
const BadgeDetails = mongoose.model('BadgeDetails', BlockchainBadgesSchema);
const BadgeIssues = mongoose.model('BadgeIssues', BlockchainBadgeIssuesSchema);
const Stakeholders = mongoose.model('Stakeholders', StakeholdersSchema);
const Leaser = mongoose.model('Leaser', LeaserSchema);
const RoyaltyPass = mongoose.model('RoyaltyPass', RoyaltyPassSchema);
const DeliveryChallan = mongoose.model(
  'DeliveryChallan',
  DeliveryChallanSchema
);

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
  DeliveryChallan,
};

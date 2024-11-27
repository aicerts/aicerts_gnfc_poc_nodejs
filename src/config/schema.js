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
  name: { type: String },
  role: { type: String },
  userId: { type: String },
  roleId: { type: String },
  password: { type: String },
  isActive: { type: Boolean, default: true },
  status: { type: String },
  approvedDate: { type: Date, default: null },
  issuedDate: { type: Date, default: Date.now }
});

// Define the schema for Lease (POC)
const LeaseSchema = new mongoose.Schema({
  email: { type: String, required: true },
  role: { type: String },
  userId: { type: String },
  leaseId: { type: String },
  leaserId: { type: String },
  leaseHash: { type: String },
  transactionHash: { type: String },
  leaseSequence: { type: Number, default: 0},
  leaser: { type: String },
  location: { type: String },
  isActive: { type: Boolean, default: true },
  capacity: { type: Number },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  blockchainUrl: { type: String },
  issuedDate: { type: Date, default: Date.now }
});



// Define the schema for Orders (POC)
const OrdersSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  orderId: { type: String },
  amount: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  userId: { type: String },
  orderSequence: { type: Number, default: 0},
  leaseSequence: { type: Number, default: 0},
  royaltyAmount:{ type: Number, default: 0},
  status: { type: String },
  issuedDate: { type: Date, default: Date.now }
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
const Lease = mongoose.model('Lease', LeaseSchema);
const Orders = mongoose.model('Orders', OrdersSchema);

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
  Lease,
  Orders,
};
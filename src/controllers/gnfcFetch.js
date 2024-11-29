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

const leaserList = async (req, res) => {
  try {
    await isDBConnected();
    const leasers = await Stakeholders.find(
      { role: 'Leaser' },
      'name isActive status approvedDate roleId'
    );
    res.status(200).json(leasers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const leaserById = async (req, res) => {
  try {
    await isDBConnected();
    const leaserId = req.params.id;
    const leaser = await Stakeholders.findOne(
      {
        role: 'Leaser',
        roleId: leaserId,
      },
      'name isActive status approvedDate roleId'
    );
    res.json({ status: 200, data: leaser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
    const royaltyPassNo = req.params.royaltyPassNo;
    const list = await DeliveryChallan.find({
      royaltyPassNo: royaltyPassNo,
    });
    res.json({ status: 200, data: list });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const wholeTracker = async (req, res) => {
  try {
    await isDBConnected();
    const deliveryNo = req.params.deliveryChallan;
    const deliveryChallan = await DeliveryChallan.findOne({
      deliveryNo,
    });
    const royaltyPass = await RoyaltyPass.findOne({
      royaltyPassNo: deliveryChallan.royaltyPassNo,
    });
    const leaser = await Stakeholders.findOne(
      {
        role: 'Leaser',
        roleId: royaltyPass.leaserId,
      },
      'name isActive status approvedDate roleId'
    );
    res.json({
      status: 200,
      data: {
        deliveryNo,
        royaltyPass,
        leaser,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
    console.log(count);
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

module.exports = {
  leaserList,
  leaserById,
  royaltyPassList,
  deliveryChallanList,
  wholeTracker,
  royaltyPassDailyReport,
  royaltyPassWeeklyReport,
  royaltyPassMonthlyReport,
  royaltyPassAnnualReport,
  deliveryChallanDailyReport,
  deliveryChallanWeeklyReport,
  deliveryChallanMonthlyReport,
  deliveryChallanAnnualReport,
};

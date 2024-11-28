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
    const deliveryChallanNo = req.params.deliveryChallan;
    const deliveryChallan = await DeliveryChallan.findOne({
      deliveryChallanNo,
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
        deliveryChallan,
        royaltyPass,
        leaser,
      },
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
};

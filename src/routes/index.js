const express = require('express');
const router = express.Router();

let pocFetch = require("./pocFetch");
let health = require("./health");

router.use(pocFetch);
router.use(health);

module.exports = router
const express = require('express');
const router = express.Router();

let admin = require("./admin");
let verify = require("./verify");
let fetch = require("./fetch");
let pocFetch = require("./pocFetch");
let gnfc = require("./gnfc");
let health = require("./health");


router.use(admin);
router.use(verify);
router.use(fetch);
router.use(pocFetch);
router.use(gnfc);
router.use(health);

module.exports = router
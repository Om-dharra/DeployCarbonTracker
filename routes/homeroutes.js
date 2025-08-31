const express = require("express");
const router = express.Router();
const BusinessDatabase = require('../models/BusinessDatabase');
const { isLoggedIn } = require("../middleware");
const User = require("../models/User");
const FootPrintDb = require("../models/FootprintDb");
const VehicleDb = require("../models/VehicleDb");
const EmissionFactor = require("../models/EmissionFactor");
const ResultHistoryDb = require("../models/ResultHistoryDb");

async function recalculateTotalEmissions(businessId) {
    let totalEmission = 0;
    const business = await BusinessDatabase.findById(businessId)
        .populate('Carbondatabase_B')
        .populate('Carbondatabase_V');

    if (!business) return 0;

    // 1. Base emission from employee count
    totalEmission += (business.NoOfEmployees * (100 - business.WFHpercent) / 100 * 1.2) || 0;

    // 2. Add emissions from the LATEST building data entry
    if (business.Carbondatabase_B && business.Carbondatabase_B.length > 0) {
        const latestBuildingData = business.Carbondatabase_B[business.Carbondatabase_B.length - 1];
        const buildingValues = [
            latestBuildingData.electricity, latestBuildingData.naturalGas, latestBuildingData.heatingOil,
            latestBuildingData.coal, latestBuildingData.lpg, latestBuildingData.propane,
            latestBuildingData.diesel, latestBuildingData.refrigerantAmount
        ];
        const buildingEntities = ["electricity", "naturalGas", "heatingOil", "coal", "lpg", "propane", "diesel", "refrigerant"];
        for (let i = 0; i < buildingEntities.length; i++) {
            const emissionDb = await EmissionFactor.findOne({ entityName: buildingEntities[i] });
            if (emissionDb) {
                totalEmission += (emissionDb.emissionFactor * (buildingValues[i] || 0));
            }
        }
    }

    // 3. Add emissions from the LATEST vehicle data entry
    if (business.Carbondatabase_V && business.Carbondatabase_V.length > 0) {
        const latestVehicleData = business.Carbondatabase_V[business.Carbondatabase_V.length - 1];
        const vehicleValues = [latestVehicleData.petrol, latestVehicleData.diesel, latestVehicleData.cng, latestVehicleData.lpg];
        const vehicleEntities = ["petrol", "diesel", "cng", "lpg"];
        for (let i = 0; i < vehicleEntities.length; i++) {
            const emissionDb = await EmissionFactor.findOne({ entityName: vehicleEntities[i] });
            if (emissionDb) {
                let val = vehicleValues[i] || 0;
                if (i === 0) val *= 0.264; // petrol conversion
                if (i === 1) val *= 0.84;  // diesel conversion
                totalEmission += (emissionDb.emissionFactor * val);
            }
        }
    }
    
    // 4. Add average emissions from products if available
    totalEmission += business.Average || 0;

    return totalEmission;
}


// GET /dashboard - Main dashboard view
router.get("/dashboard", isLoggedIn, async (req, res) => {
    try {
        const user = req.session.passport.user;
        const businesses = await BusinessDatabase.find({ user: user }).lean();
        
        const lastUpdatedList = [];
        for (const business of businesses) {
            const resultHistoryDoc = await BusinessDatabase.findById(business._id).populate({
                path: 'Carbondatabase_R',
                options: { sort: { 'date': -1 }, limit: 1 } // Efficiently get the latest one
            });
            if (resultHistoryDoc.Carbondatabase_R && resultHistoryDoc.Carbondatabase_R.length > 0) {
                lastUpdatedList.push(resultHistoryDoc.Carbondatabase_R[0].date);
            } else {
                lastUpdatedList.push(null);
            }
        }
        
        const toReadableDate = (date) => {
            if (!date) return "Never";
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            }).format(date);
        };

        res.render("dashResult/dashboard", {
            businesses,
            lastUpdated: lastUpdatedList,
            toReadableDate
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash('error', 'Could not load dashboard.');
        res.redirect('/home');
    }
});

// GET /dashboard/:businessid - View monthly report for a specific business
router.get("/dashboard/:businessid", isLoggedIn, async (req, res) => {
    try {
        const { businessid } = req.params;
        const business = await BusinessDatabase.findById(businessid).populate('Carbondatabase_R');

        if (!business) {
            req.flash('error', 'Business not found.');
            return res.redirect('/dashboard');
        }

        const monthlyResults = {};
        for (const record of business.Carbondatabase_R) {
            const date = new Date(record.date);
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-11 index
            const result = record.result || 0;

            if (!monthlyResults[year]) {
                monthlyResults[year] = {};
            }
            if (monthlyResults[year][month]) {
                monthlyResults[year][month] += result;
            } else {
                monthlyResults[year][month] = result;
            }
        }

        // Pass the full month names array to the template for rendering the table and chart
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        res.render("dashResult/business_dashboard", { business, monthlyResults, monthNames });

    } catch (error) {
        console.error("Business Dashboard Error:", error);
        req.flash('error', 'Could not load business report.');
        res.redirect('/dashboard');
    }
});

// GET /home
router.get("/home", isLoggedIn, (req, res) => {
    res.render("homePage/index");
});

// GET /FillForm
router.get("/FillForm", isLoggedIn, (req, res) => {
    res.render("homePage/buisenessForm");
});

// GET /Contact
router.get("/Contact", isLoggedIn, (req, res) => {
    res.render("homePage/ContactPage");
});

// POST /BusinessDb - Create or Update business details
router.post("/BusinessDb", isLoggedIn, async (req, res) => {
    try {
        const user = req.session.passport.user;
        const { Bname, Industry, NoOfEmployees, WFHpercent } = req.body;
        const Result = (NoOfEmployees * (100 - WFHpercent) / 100 * 1.2) || 0;

        let business = await BusinessDatabase.findOneAndUpdate(
            { user, Bname }, // Find by user and name
            { Industry, NoOfEmployees, WFHpercent, Result }, // Data to update or insert
            { upsert: true, new: true, setDefaultsOnInsert: true } // Options: create if not found
        );

        req.session.Bid = business._id;
        req.session.save(() => {
            req.flash('success', 'Your Business Details are saved Successfully');
            res.redirect(`/BuildingDb/${business._id}`);
        });
    } catch (error) {
        console.error("BusinessDb POST Error:", error);
        req.flash('error', 'Failed to save business details.');
        res.redirect('/FillForm');
    }
});

// GET Result page
router.get("/Result/:businessid", isLoggedIn, async (req, res) => {
    try {
        const { businessid } = req.params;
        const business = await BusinessDatabase.findById(businessid)
            .populate({ path: 'Carbondatabase_B', options: { sort: { 'createdAt': -1 }, limit: 1 }})
            .populate({ path: 'Carbondatabase_V', options: { sort: { 'createdAt': -1 }, limit: 1 }});

        if (!business) {
            req.flash('error', 'Business data not found.');
            return res.status(404).redirect('/dashboard');
        }

        const value = Math.floor((business.Result || 0) / 1000);
        const latestBuildingData = business.Carbondatabase_B[0] || {};
        const latestVehicleData = business.Carbondatabase_V[0] || {};

        const Arr = [
            ((latestBuildingData.electricity ?? 0) * 0.82) / 1000,
            ((latestBuildingData.naturalGas ?? 0) * 2.75) / 1000,
            ((latestBuildingData.heatingOil ?? 0) * 3.15) / 1000,
            ((latestBuildingData.coal ?? 0) * 3300) / 1000,
            ((latestBuildingData.lpg ?? 0) * 2.99) / 1000,
            ((latestBuildingData.propane ?? 0) * 2.99) / 1000,
            ((latestBuildingData.diesel ?? 0) * 2.7 * 0.84) / 1000,
            ((latestVehicleData.diesel ?? 0) * 2.7 * 0.84) / 1000,
            ((latestBuildingData.refrigerantAmount ?? 0) * 675) / 1000,
            ((latestVehicleData.petrol ?? 0) * 8.78 * 0.264) / 1000,
            ((latestVehicleData.cng ?? 0) * 2.666) / 1000
        ];

        res.render("homePage/Result", { value, businessid, Arr });
    } catch (error) {
        console.error("Error in /Result/:businessid route:", error);
        req.flash('error', 'Could not display results.');
        res.redirect(`/dashboard`);
    }
});

// Building, Vehicle, and Supply Chain GET routes
router.get("/BuildingDb/:businessid", isLoggedIn, async (req, res) => {
    const { businessid } = req.params;
    // You can pass existing data to pre-fill the form if needed
    res.render("homePage/buildingDataInput", { businessid });
});

router.get("/VehicleDb/:businessid", isLoggedIn, async (req, res) => {
    const { businessid } = req.params;
    res.render("homePage/vehicleDataInput", { businessid });
});

router.get("/SupplyDb/:businessid", isLoggedIn, (req, res) => {
    const { businessid } = req.params;
    res.render("homePage/supplyChain", { businessid });
});

// POST /calulateCF - Create or update BUILDING data for the CURRENT month
router.post("/calulateCF/:businessid", isLoggedIn, async (req, res) => {
    try {
        const { businessid } = req.params;
        const user = req.session.passport.user;
        const business = await BusinessDatabase.findById(businessid);

        if (!business) {
            req.flash('error', 'Business not found.');
            return res.redirect('/dashboard');
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const buildingData = { ...req.body }; // Get data from form

        // Check if a record for the current month already exists for this business
        const existingFootprint = await FootPrintDb.findOne({
             _id: { $in: business.Carbondatabase_B },
             createdAt: { $gte: startOfMonth, $lt: endOfMonth }
        });

        let footprintDb;
        if (existingFootprint) {
            // UPDATE the record for the current month
            footprintDb = await FootPrintDb.findByIdAndUpdate(existingFootprint._id, buildingData, { new: true });
        } else {
            // CREATE a new record because none exists for this month
            footprintDb = await FootPrintDb.create(buildingData);
            business.Carbondatabase_B.push(footprintDb._id);
        }

        // Create a NEW history record for this specific calculation
        let currResult = 0;
        const entities = ["electricity", "naturalGas", "heatingOil", "coal", "lpg", "propane", "diesel", "refrigerant"];
        for (const entity of entities) {
            const emissionDb = await EmissionFactor.findOne({ entityName: entity });
            if (emissionDb) {
                const value = entity === 'refrigerant' ? (buildingData.refrigerantAmount || 0) : (buildingData[entity] || 0);
                currResult += emissionDb.emissionFactor * value;
            }
        }
        
        const resultHistoryObj = await ResultHistoryDb.create({ date: new Date(), result: currResult, user, source: "Building" });
        business.Carbondatabase_R.push(resultHistoryObj._id);

        // Recalculate and save the new total
        business.Result = await recalculateTotalEmissions(businessid);
        await business.save();
        
        req.flash('success', 'Building emissions data saved.');
        res.redirect(`/VehicleDb/${businessid}`);

    } catch (error) {
        console.error("CalculateCF Error:", error);
        req.flash('error', 'Failed to save building data.');
        res.redirect(`/BuildingDb/${req.params.businessid}`);
    }
});

// POST /CalculateFinal - Create or update VEHICLE data for the CURRENT month
router.post("/CalculateFinal/:businessid", isLoggedIn, async (req, res) => {
    try {
        const { businessid } = req.params;
        const user = req.session.passport.user;
        const business = await BusinessDatabase.findById(businessid);

        if (!business) {
            req.flash('error', 'Business not found.');
            return res.redirect('/dashboard');
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const vehicleData = { ...req.body };

        const existingVehicleDb = await VehicleDb.findOne({
            _id: { $in: business.Carbondatabase_V },
            createdAt: { $gte: startOfMonth, $lt: endOfMonth }
        });

        let vehicleDb;
        if (existingVehicleDb) {
            vehicleDb = await VehicleDb.findByIdAndUpdate(existingVehicleDb._id, vehicleData, { new: true });
        } else {
            vehicleDb = await VehicleDb.create(vehicleData);
            business.Carbondatabase_V.push(vehicleDb._id);
        }
        
        // Create a NEW history record for this specific calculation
        let currResult = 0;
        const entities = ["petrol", "diesel", "cng", "lpg"];
        const values = [vehicleData.petrol, vehicleData.diesel, vehicleData.cng, vehicleData.lpg];
        for (let i = 0; i < entities.length; i++) {
            const emissionDb = await EmissionFactor.findOne({ entityName: entities[i] });
            if (emissionDb) {
                let val = values[i] || 0;
                if (i === 0) val *= 0.264; // petrol conversion
                if (i === 1) val *= 0.84;  // diesel conversion
                currResult += (emissionDb.emissionFactor * val);
            }
        }

        const resultHistoryObj = await ResultHistoryDb.create({ date: new Date(), result: currResult, user, source: "Vehicle" });
        business.Carbondatabase_R.push(resultHistoryObj._id);

        // Recalculate and save the new total
        business.Result = await recalculateTotalEmissions(businessid);
        await business.save();

        req.flash('success', 'Vehicle emissions data saved.');
        res.redirect(`/SupplyDb/${businessid}`);

    } catch (error) {
        console.error("CalculateFinal Error:", error);
        req.flash('error', 'Failed to save vehicle data.');
        res.redirect(`/VehicleDb/${req.params.businessid}`);
    }
});

// POST /ProductCF/:businessid - Update the average product carbon footprint
router.post("/ProductCF/:businessid", isLoggedIn, async (req, res) => {
    try {
        const { businessid } = req.params;
        const Obj = req.body;
        let value = 0;
        
        const factors = {
            coalProduced: 1987,
            smallCars: 5000,
            midSizeCars: 8000,
            largeSUVs: 11000,
            electricVehicles: 9000
        };

        for (const key in Obj) {
            if (factors[key]) {
                value += (parseFloat(Obj[key]) || 0) * factors[key];
            }
        }
        
        await BusinessDatabase.findByIdAndUpdate(businessid, { $set: { Average: value } });
        
        // After updating this component, the total must be recalculated
        const newTotal = await recalculateTotalEmissions(businessid);
        await BusinessDatabase.findByIdAndUpdate(businessid, { Result: newTotal });

        req.flash('success', 'Product carbon footprint data updated.');
        res.redirect(`/Result/${businessid}`);
    } catch (error) {
        console.error("ProductCF Error:", error);
        req.flash('error', 'Failed to update product data.');
        res.redirect(`/SupplyDb/${req.params.businessid}`);
    }
});


module.exports = router;

const express=require("express")
const router=express.Router();
const BusinessDatabase=require('../models/BusinessDatabase');
const {isLoggedIn}=require("../middleware");
const User=require("../models/User");
const FootPrintDb=require("../models/FootprintDb");
const VehicleDb=require("../models/VehicleDb");
const EmissionFactor=require("../models/EmissionFactor");
const ResultHistoryDb = require("../models/ResultHistoryDb");


router.get("/dashboard",isLoggedIn,async(req,res)=>{
    const user=req.session.passport.user;
    // console.log(user);
    const results=await BusinessDatabase.findOne({user:user});
    let id;
    let CarbonEmission;
    let Bname;
    if(results){
        id=results._id;
        CarbonEmission=results.Result;
        Bname=results.name;

    }

    const businesses = await BusinessDatabase.find({user:user}).lean();
    let lastUpdated = [];
    for (let i = 0; i < businesses.length; i++) {
        let business = businesses[i];
        let id = business._id;
        let resultHistory = await BusinessDatabase.findOne({_id:id}).populate({
            path: 'Carbondatabase_R',
            model: ResultHistoryDb
        }).exec();
        resultHistory = resultHistory.Carbondatabase_R[resultHistory.Carbondatabase_R.length - 1];
        if (resultHistory) {
            lastUpdated.push(resultHistory.date);
        }
        // } else {
        //     lastUpdated.push(null);
        // }
    }
    console
    // console.log(lastUpdated);

    const toReadableDate = (date) => {
        if (!date) {
            return "Never";
        }
        let month = date.getMonth();
        let year = date.getFullYear();
        let day = date.getDate();
        let hour = date.getHours();
        let minute = date.getMinutes();
        let ampm = "AM";
        if (hour > 12) {
            hour -= 12;
            ampm = "PM";
        }
        return `${day}/${month}/${year} ${hour}:${minute} ${ampm}`;
    }

    // console.log(businesses);
    // console.log(resultHistory);
    res.render("dashResult/dashboard",{Bname,id,CarbonEmission, businesses, lastUpdated, toReadableDate});
})

router.get("/dashboard/:businessid",isLoggedIn,async(req,res)=>{
    const user=req.session.passport.user;
    const {businessid}=req.params;
    const date = new Date();
    date.setDate(date.getDate() - 7);
    let business = await BusinessDatabase.findById(businessid)
    .populate({
        path: 'Carbondatabase_R',
        match: { date: { $gte: date } },
        model: ResultHistoryDb
    }).exec();
    let results = business.Carbondatabase_R;
    // console.log(results);

    // Convert the results to something monthly
    let monthlyResults = {};
    for (let i = 0; i < results.length; i++) {
        let date = results[i].date;
        let month = date.getMonth();
        if(month==NaN){
            month="Jan";
        }
        let year = date.getFullYear();
        if(year==NaN){
            year="2024";
        }
        let result = results[i].result;
        if (monthlyResults[year]) {
            if (monthlyResults[year][month]) {
                monthlyResults[year][month] += result;
            } else {
                monthlyResults[year][month] = result;
            }
        } else {
            monthlyResults[year] = {};
            monthlyResults[year][month] = result;
        }
    }

    console.log(monthlyResults)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    res.render("dashResult/business_dashboard",{business, results, monthlyResults, monthNames,businessid});
})


router.get("/home",isLoggedIn,(req,res)=>{
    res.render("homePage/index");
})

router.get("/FillForm",isLoggedIn,(req,res)=>{
    if(req.session.Bid){
        return res.redirect(`/BuildingDb/${req.session.Bid}`);
    }
    res.render("homePage/buisenessForm");
})
router.get("/Contact",isLoggedIn,(req,res)=>{
    res.render("homePage/ContactPage");
})


router.post("/BusinessDb",isLoggedIn,async(req,res)=>{
    const user=req.session.passport.user;
    console.log(user);
    const {Bname,Industry,NoOfEmployees,WFHpercent}=req.body;
    let Result=NoOfEmployees*(100 - WFHpercent)/100*1.2;
    await BusinessDatabase.create({user,Bname,Industry,NoOfEmployees,WFHpercent,Result});
    const Bdetails=await BusinessDatabase.findOne({Bname:Bname});
    req.session.Bid = Bdetails._id;
    req.session.save(function(){
        console.log(req.session)
        console.log(req.session.Bid);
        req.flash("Your Business Details are added Successfully");
        res.redirect(`/BuildingDb/${Bdetails._id}`);
    });
})
router.get("/Result/:businessid", isLoggedIn, async (req, res) => {
    try { // Good practice to wrap async route handlers in try...catch
        const user = req.session.passport.user; // Assuming this is used elsewhere or for auth
        const { businessid } = req.params;

        const Business = await BusinessDatabase.findById(businessid);

        // 1. Handle if Business itself is not found
        if (!Business) {
            // You might want to render an error page or send a 404
            console.error(`Business with ID ${businessid} not found.`);
            return res.status(404).render("errorPage", { message: "Business data not found." });
        }

        // 2. Safely parse Business.Result
        // Use Number() for potentially non-integer strings, or stick to parseInt with a radix
        // Provide a default of 0 if Business.Result is null, undefined, or not a number.
        let rawResult = Business.Result; // e.g., "50000" or null or undefined
        let numericResult = parseInt(rawResult, 10); // Always provide radix for parseInt
        
        let value = 0; // Default value
        if (!isNaN(numericResult)) { // Check if parsing was successful
            value = Math.floor(numericResult / 1000); // Use Math.floor for integer division intention
        }
        // console.log("Calculated value (Result/1000):", value);

        // 3. Safely get IDs and fetch related databases
        const id1 = Business.Carbondatabase_B; // This might be null/undefined if not set
        const id2 = Business.Carbondatabase_V; // This might be null/undefined if not set

        // Fetch related DBs only if IDs exist, otherwise they'll be null
        const FootprintDatabase = id1 ? await FootPrintDb.findById(id1) : null;
        const VehicleDatabase = id2 ? await VehicleDb.findById(id2) : null;

        // 4. Perform calculations safely using optional chaining and nullish coalescing
        // (object?.property ?? defaultValue)

        const electricity = ((FootprintDatabase?.electricity ?? 0) * 0.82) / 1000;
        const naturalGas = ((FootprintDatabase?.naturalGas ?? 0) * 2.75) / 1000;
        const heatingOil = ((FootprintDatabase?.heatingOil ?? 0) * 3.15) / 1000;
        const coal = ((FootprintDatabase?.coal ?? 0) * 3300) / 1000;
        const lpg = ((FootprintDatabase?.lpg ?? 0) * 2.99) / 1000;
        const propane = ((FootprintDatabase?.propane ?? 0) * 2.99) / 1000;
        const diesel_footprint = ((FootprintDatabase?.diesel ?? 0) * 2.7 * 0.84) / 1000; // Renamed to avoid conflict
        const refrigerant = ((FootprintDatabase?.refrigerantAmount ?? 0) * 675) / 1000;

        const diesel_v = ((VehicleDatabase?.diesel ?? 0) * 2.7 * 0.84) / 1000;
        const petrol_v = ((VehicleDatabase?.petrol ?? 0) * 8.78 * 0.264) / 1000;
        const cng_v = ((VehicleDatabase?.cng ?? 0) * 2.666) / 1000;

        const Arr = [
            electricity,
            naturalGas,
            heatingOil,
            coal,
            lpg,
            propane,
            diesel_footprint, // Use the renamed variable
            diesel_v,
            refrigerant,
            petrol_v,
            cng_v
        ];

        res.render("homePage/Result", { value, businessid, Arr });

    } catch (error) {
        console.error("Error in /Result/:businessid route:", error);
        // Render a generic error page or send a 500 status
        res.status(500).render("errorPage", { message: "An unexpected error occurred." });
    }
});
router.get("/BuildingDb/:businessid",isLoggedIn,async(req,res)=>{
    const {businessid}=req.params;
    const Business = await BusinessDatabase.findById(businessid);
    const id1 = Business.Carbondatabase_B;
    const buildingData = id1 ? await FootPrintDb.findById(id1) : null; // Use null if no building data exists
    res.render("homePage/buildingDataInput", { businessid, buildingData });
})

router.get("/VehicleDb/:businessid",isLoggedIn,async(req,res)=>{
    const {businessid}=req.params;
    const Business = await BusinessDatabase.findById(businessid);
    const id2 = Business.Carbondatabase_V;
    const vehicleData = id2 ? await VehicleDb.findById(id2) : null; // Use null if no vehicle data exists
    if (!vehicleData) {
        // If no vehicle data exists, you might want to create a new one or handle it accordingly
        console.log("No vehicle data found for this business.");
    }
    res.render("homePage/vehicleDataInput", { businessid, vehicleData });
})
router.get("/SupplyDb/:businessid",isLoggedIn,async(req,res)=>{
    const {businessid}=req.params;
    res.render("homePage/supplyChain",{ businessid });
})
router.post("/ProductCF/:businessid", isLoggedIn, async (req, res) => {
    const user=req.session.passport.user;
    const { businessid } = req.params;
    const Obj=req.body;
    // console.log(Obj);
    let value=0;
    for (let key in Obj) {
        if(key=='coalProduced'){
            value+=(Obj[key]*1987);

        }
        if(key=='smallCars'){
            value+=(Obj[key]*5000);
        }
        if(key=='midSizeCars'){
            value+=(Obj[key]*8000);
            
        }
        if(key=='largeSUVs'){
            value+=(Obj[key]*11000);
            
        }
        if(key=='electricVehicles'){
            value+=(Obj[key]*9000);
            
        }
        
    }
    // console.log(value);
    await BusinessDatabase.findByIdAndUpdate(businessid,{Average:value});
    res.redirect(`/Result/${businessid}`);

})

router.post("/calulateCF/:businessid", isLoggedIn, async (req, res) => {
    const user = req.session.passport.user;
    const { businessid } = req.params;
    // If data might already exist, merge with previous values
    let Business = await BusinessDatabase.findById(businessid).populate("Carbondatabase_B");
    let prevData = {};
    if (Business.Carbondatabase_B && Business.Carbondatabase_B.length > 0) {
        // Get the latest entry's values
        const prevEntry = await FootPrintDb.findById(Business.Carbondatabase_B[Business.Carbondatabase_B.length - 1]._id);
        if (prevEntry) {
            prevData = {
                electricity: prevEntry.electricity || 0,
                naturalGas: prevEntry.naturalGas || 0,
                heatingOil: prevEntry.heatingOil || 0,
                coal: prevEntry.coal || 0,
                lpg: prevEntry.lpg || 0,
                propane: prevEntry.propane || 0,
                diesel: prevEntry.diesel || 0,
                refrigerant: prevEntry.refrigerant || 0,
                refrigerantAmount: prevEntry.refrigerantAmount || 0
            };
        }
    }

    const {
        electricity = prevData.electricity || 0,
        naturalGas = prevData.naturalGas || 0,
        heatingOil = prevData.heatingOil || 0,
        coal = prevData.coal || 0,
        lpg = prevData.lpg || 0,
        propane = prevData.propane || 0,
        diesel = prevData.diesel || 0,
        refrigerant = prevData.refrigerant || 0,
        refrigerantAmount = prevData.refrigerantAmount || 0
    } = req.body;

    // Find or create FootPrintDb for this business
    let footprintDb;
    if (Business.Carbondatabase_B && Business.Carbondatabase_B.length > 0) {
        // Update the latest entry
        footprintDb = await FootPrintDb.findByIdAndUpdate(
            Business.Carbondatabase_B[Business.Carbondatabase_B.length - 1]._id,
            { electricity, naturalGas, heatingOil, coal, lpg, propane, diesel, refrigerant, refrigerantAmount },
            { new: true }
        );
    } else {
        // Create new entry
        footprintDb = await FootPrintDb.create({ electricity, naturalGas, heatingOil, coal, lpg, propane, diesel, refrigerant, refrigerantAmount });
        Business.Carbondatabase_B = [footprintDb._id];
        await Business.save();
    }

    // Calculate emissions
    const Arr = ["electricity", "naturalGas", "heatingOil", "coal", "lpg", "propane", "diesel", "refrigerant"];
    const values = [electricity, naturalGas, heatingOil, coal, lpg, propane, diesel, refrigerantAmount];
    let currResult = 0;
    for (let i = 0; i < Arr.length; i++) {
        const emissionDb = await EmissionFactor.findOne({ entityName: Arr[i] }).exec();
        if (emissionDb) {
            currResult += (emissionDb.emissionFactor * (values[i] || 0));
        }
    }

    // Save/update ResultHistoryDb
    let BusinessV = await BusinessDatabase.findById(businessid).populate("Carbondatabase_R");
    let resultHistoryObj;
    if (BusinessV.Carbondatabase_R && BusinessV.Carbondatabase_R.length > 0) {
        // Update the latest result history
        resultHistoryObj = await ResultHistoryDb.findByIdAndUpdate(
            BusinessV.Carbondatabase_R[BusinessV.Carbondatabase_R.length - 1]._id,
            { date: Date.now(), result: currResult, user },
            { new: true }
        );
    } else {
        // Create new result history
        resultHistoryObj = await ResultHistoryDb.create({ date: Date.now(), result: currResult, user });
        BusinessV.Carbondatabase_R = [resultHistoryObj._id];
        await BusinessV.save();
    }

    // Update Business Result
    let sum = parseInt(Business.Result) || 0;
    sum += currResult;
    await BusinessDatabase.findByIdAndUpdate(businessid, { Result: sum });

    res.redirect(`/VehicleDb/${businessid}`);
});

router.post("/CalculateFinal/:businessid", isLoggedIn, async (req, res) => {
    const user = req.session.passport.user;
    const { businessid } = req.params;
    let { petrol = 0, diesel = 0, cng = 0, lpg = 0 } = req.body;

    // Find or create VehicleDb for this business
    let Business = await BusinessDatabase.findById(businessid).populate("Carbondatabase_V");
    let vehicleDb;
    if (Business.Carbondatabase_V && Business.Carbondatabase_V.length > 0) {
        // Update the latest entry
        vehicleDb = await VehicleDb.findByIdAndUpdate(
            Business.Carbondatabase_V[Business.Carbondatabase_V.length - 1]._id,
            { petrol, diesel, cng, lpg },
            { new: true }
        );
    } else {
        // Create new entry
        vehicleDb = await VehicleDb.create({ petrol, diesel, cng, lpg });
        Business.Carbondatabase_V = [vehicleDb._id];
        await Business.save();
    }

    // Calculate emissions
    const Arr = ["petrol", "diesel", "cng", "lpg"];
    let values = [petrol, diesel, cng, lpg];
    let currResult = 0;
    for (let i = 0; i < Arr.length; i++) {
        const emissionDb = await EmissionFactor.findOne({ entityName: Arr[i] }).exec();
        if (emissionDb) {
            let val = values[i] || 0;
            if (i === 0) val *= 0.264; // petrol
            if (i === 1) val *= 0.84;  // diesel
            currResult += (emissionDb.emissionFactor * val);
        }
    }

    // Save/update ResultHistoryDb
    let BusinessV = await BusinessDatabase.findById(businessid).populate("Carbondatabase_R");
    let resultHistoryObj;
    if (BusinessV.Carbondatabase_R && BusinessV.Carbondatabase_R.length > 0) {
        // Update the latest result history
        resultHistoryObj = await ResultHistoryDb.findByIdAndUpdate(
            BusinessV.Carbondatabase_R[BusinessV.Carbondatabase_R.length - 1]._id,
            { date: Date.now(), result: currResult, user },
            { new: true }
        );
    } else {
        // Create new result history
        resultHistoryObj = await ResultHistoryDb.create({ date: Date.now(), result: currResult, user });
        BusinessV.Carbondatabase_R = [resultHistoryObj._id];
        await BusinessV.save();
    }

    // Update Business Result
    let sum = parseInt(Business.Result) || 0;
    sum += currResult;
    await BusinessDatabase.findByIdAndUpdate(businessid, { Result: sum });

    res.redirect(`/SupplyDb/${businessid}`);
});

// Update BusinessDb POST to update if exists
router.post("/BusinessDb", isLoggedIn, async (req, res) => {
    const user = req.session.passport.user;
    const { Bname, Industry, NoOfEmployees, WFHpercent } = req.body;
    let Result = NoOfEmployees * (100 - WFHpercent) / 100 * 1.2;

    // Check if business already exists for this user and name
    let Bdetails = await BusinessDatabase.findOne({ user, Bname });
    if (Bdetails) {
        // Update existing business
        await BusinessDatabase.findByIdAndUpdate(Bdetails._id, { Industry, NoOfEmployees, WFHpercent, Result });
    } else {
        // Create new business
        Bdetails = await BusinessDatabase.create({ user, Bname, Industry, NoOfEmployees, WFHpercent, Result });
    }
    req.session.Bid = Bdetails._id;
    req.session.save(function () {
        req.flash("Your Business Details are added Successfully");
        res.redirect(`/BuildingDb/${Bdetails._id}`);
    });
});

// Update ProductCF POST to update if exists
router.post("/ProductCF/:businessid", isLoggedIn, async (req, res) => {
    const user = req.session.passport.user;
    const { businessid } = req.params;
    const Obj = req.body;
    let value = 0;
    for (let key in Obj) {
        if (key == 'coalProduced') {
            value += (Obj[key] * 1987);
        }
        if (key == 'smallCars') {
            value += (Obj[key] * 5000);
        }
        if (key == 'midSizeCars') {
            value += (Obj[key] * 8000);
        }
        if (key == 'largeSUVs') {
            value += (Obj[key] * 11000);
        }
        if (key == 'electricVehicles') {
            value += (Obj[key] * 9000);
        }
    }
    // Update Average if already exists, else set it
    await BusinessDatabase.findByIdAndUpdate(businessid, { Average: value });
    res.redirect(`/Result/${businessid}`);
});

module.exports = router


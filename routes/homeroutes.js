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
    console.log(user);
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
    console.log(lastUpdated);

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

    console.log(businesses);
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
    console.log(results);

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
router.get("/Result/:businessid",isLoggedIn,async(req,res)=>{
    const user=req.session.passport.user;
    const {businessid}=req.params;
    const Business=await BusinessDatabase.findById(businessid);
    let value=parseInt(Business.Result);
    console.log(value);
    value=parseInt(value/1000);
    const id1 = Business.Carbondatabase_B;
    const id2 = Business.Carbondatabase_V;
    const FootprintDatabase = await FootPrintDb.findById(id1);
    const VehicleDatabase = await VehicleDb.findById(id2);
    const electricity = (FootprintDatabase.electricity*(0.82))/1000;
    // const Electric_v = 2000;
    const naturalGas = (FootprintDatabase.naturalGas*(2.75))/1000;
    const heatingOil = (FootprintDatabase.heatingOil*(3.15))/1000;
    const coal = (FootprintDatabase.coal*(3300))/1000;
    const lpg = (FootprintDatabase.lpg*(2.99))/1000;
    const propane = (FootprintDatabase.propane*(2.99))/1000;
    const diesel = (FootprintDatabase.diesel*(2.7*0.84))/1000;
    const diesel_v = (VehicleDatabase.diesel*(2.7*0.84))/1000;
    const refrigerant = (FootprintDatabase.refrigerantAmount*(675))/1000;
    const petrol_v = (VehicleDatabase.petrol*(8.78*0.264))/1000;
    const cng_v = (VehicleDatabase.cng*(2.666))/1000;
    const Arr=[electricity,naturalGas,heatingOil,coal,lpg,propane,diesel,diesel_v,refrigerant,petrol_v,cng_v]
    // console.log(value);
    res.render("homePage/Result",{value,businessid,Arr});
})
router.get("/BuildingDb/:businessid",isLoggedIn,(req,res)=>{
    const {businessid}=req.params;

    res.render("homePage/buildingDataInput",{businessid});
})

router.get("/VehicleDb/:businessid",isLoggedIn,async(req,res)=>{
    const {businessid}=req.params;
    res.render("homePage/vehicleDataInput",{businessid});
})
router.get("/SupplyDb/:businessid",isLoggedIn,async(req,res)=>{
    const {businessid}=req.params;
    res.render("homePage/supplyChain",{businessid});
})
router.post("/ProductCF/:businessid", isLoggedIn, async (req, res) => {
    const user=req.session.passport.user;
    const { businessid } = req.params;
    const Obj=req.body;
    console.log(Obj);
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
    console.log(value);
    await BusinessDatabase.findByIdAndUpdate(businessid,{Average:value});
    res.redirect(`/Result/${businessid}`);

})

router.post("/calulateCF/:businessid",isLoggedIn,async(req,res)=>{
    const user=req.session.passport.user;
    const {businessid}=req.params;
    const {electricity,naturalGas,heatingOil,coal,lpg,propane,diesel,refrigerant,refrigerantAmount}=req.body;
    const Arr=["electricity","naturalGas","heatingOil","coal","lpg","propane","diesel"];
    Arr.push(refrigerant);
    const values=[electricity,naturalGas,heatingOil,coal,lpg,propane,diesel,refrigerantAmount];
    const Business=await BusinessDatabase.findById(businessid).populate("Carbondatabase_B");
    const FootprintDatabase=await FootPrintDb.create({electricity,naturalGas,heatingOil,coal,lpg,propane,diesel,refrigerant,refrigerantAmount});
    Business.Carbondatabase_B.push(FootprintDatabase);
    await Business.save();
    //Saving Result
    const Bus=await BusinessDatabase.findById(businessid);
    const val=Bus.Result;
    let sum=parseInt(val);
    let currResult = 0;
    for(let i=0;i<8;i++){
        const emissionDb=await EmissionFactor.findOne({entityName:`${Arr[i]}`}).exec();
        console.log(emissionDb);
        const Ef=emissionDb.emissionFactor;
        console.log(values[i]);
        currResult+=(Ef*values[i]);
        // console.log(sum);
    }
    console.log(currResult);
    const BusinessV=await BusinessDatabase.findById(businessid).populate("Carbondatabase_R");
    const resultHistoryObj = await ResultHistoryDb.create({date:Date.now(),result:currResult,user});
    BusinessV.Carbondatabase_R.push(resultHistoryObj);
    await BusinessV.save();
    sum+=currResult;
    await BusinessDatabase.findByIdAndUpdate(businessid,{Result:sum});
    res.redirect(`/VehicleDb/${businessid}`);
})

router.post("/CalculateFinal/:businessid",isLoggedIn,async(req,res)=>{
    const user=req.session.passport.user;
    const {businessid}=req.params;
    const{petrol,diesel,cng,lpg}=req.body;
    const Arr=["petrol","diesel","cng","lpg"];
    const values=[petrol,diesel,cng,lpg];

    //Saving Database
    const Business=await BusinessDatabase.findById(businessid).populate("Carbondatabase_V");
    const VehicleDatabase=await VehicleDb.create({petrol,diesel,cng,lpg});
    Business.Carbondatabase_V.push(VehicleDatabase);
    await Business.save();
    //Saving Result
    const Bus=await BusinessDatabase.findById(businessid);
    const val=Bus.Result;
    let sum=parseInt(val);
    let currResult = 0;
    for(let i=0;i<4;i++){
        const emissionDb=await EmissionFactor.findOne({entityName:`${Arr[i]}`}).exec();
        console.log(emissionDb);
        const Ef=emissionDb.emissionFactor;
        if(i==0){
            values[i]*=0.264;
        }
        if(i==1){
            values[i]*=0.84;
        }
        currResult+=(Ef*values[i]);
        // console.log(sum);
    }
    console.log(currResult);
    const BusinessV=await BusinessDatabase.findById(businessid).populate("Carbondatabase_R");
    const resultHistoryObj = await ResultHistoryDb.create({date:Date.now(),result:currResult,user});
    BusinessV.Carbondatabase_R.push(resultHistoryObj);
    await BusinessV.save();
    sum+=currResult;
    await BusinessDatabase.findByIdAndUpdate(businessid,{Result:sum});
    res.redirect(`/SupplyDb/${businessid}`); 
    
})

module.exports=router


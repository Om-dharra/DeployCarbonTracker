require("dotenv").config();
const express=require("express")
const router=express.Router();
const BusinessDatabase=require('../models/BusinessDatabase');
const {isLoggedIn}=require("../middleware");

const FootPrintDb=require("../models/FootprintDb");
const VehicleDb=require("../models/VehicleDb");
const API_KEY= process.env.API_KEY;
const OpenAI = require("openai");

let domain_of_company;
let electricity;
let petrol;
let diesel;
let carbonEmission;
let standard;
let response;
let result;
let input2;

const openai = new OpenAI({
  apiKey: API_KEY,
});
async function main(input) {

    const completion = await openai.chat.completions.create({
      messages: [{"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": input},
          {"role" : "assistant", "content": "give me result in json format"}
      ],
      model: "gpt-3.5-turbo",
    });
    let content = completion.choices[0].message.content;
    return content;
 }

router.post('/answer/:businessid', isLoggedIn, async function (req, res) {
  const { businessid } = req.params;
  //fetching data
  const Business = await BusinessDatabase.findById(businessid);
  console.log(Business);
  result = Business.Result;
  domain_of_company = Business.Industry;
  const id1 = Business.Carbondatabase_B;
  const id2 = Business.Carbondatabase_V;
  const FootprintDatabase = await FootPrintDb.findById(id1);
  const VehicleDatabase = await VehicleDb.findById(id2);
  electricity = FootprintDatabase.electricity;
  petrol = VehicleDatabase.petrol;
  carbonEmission = parseInt((Business.Result)) / 1000; //in tonnes
  standard = parseInt(Business.Average / 1000); //in tonnes
  //input promt
  input2 = `{
    "request": {
      "electricity_kwh": ${electricity},
      "petrol_litre": ${petrol},
      "diesel_litre": ${diesel},
      "carbon_emission_per_product": ${carbonEmission},
      "global_average_per_product": ${standard},
      "domain_of_company": "${domain_of_company}"
    },
    "response": {
      "overview": "As an environmental specialist analyzing the carbon footprint of your ${domain_of_company} company, here is a comprehensive report and actionable recommendations.",
      "analysis": "Based on the provided data, your current carbon footprint is assessed, and areas for improvement are identified.",
      "performance": "The company's current environmental performance is evaluated, considering electricity consumption, petrol and diesel usage, and product-related carbon emissions.",
      "recommendations": [
        "Implement energy-efficient technologies in your facilities to reduce electricity consumption.",
        "Transition your vehicle fleet to electric or hybrid options to decrease reliance on petrol and diesel.",
        "Optimize production processes to minimize carbon emissions per product.",
        "Explore renewable energy sources for your electricity needs to further reduce your carbon footprint.",
        "Enhance supply chain sustainability by collaborating with eco-friendly suppliers.",
        "Invest in employee awareness and training programs to encourage sustainable practices.",
        "Consider implementing a carbon offset program to compensate for unavoidable emissions.",
        "Explore innovative packaging solutions to reduce waste and emissions in product delivery.",
        "Collaborate with industry peers to share best practices and collectively reduce carbon footprints.",
        "Regularly monitor and report environmental performance metrics for transparency and improvement."
      ],
      "improvement": "By diligently following these recommendations, your company is expected to reduce its carbon footprint significantly, resulting in a more sustainable and environmentally responsible operation."
    }
  }
  `
  //generating reponse
  res.render("loader/loadingScreen", { businessid });
})


router.get("/newPage/:businessid",isLoggedIn,async(req, res)=>{
  const {businessid}=req.params;
  const Business=await BusinessDatabase.findById(businessid);
  const field=Business.Industry;
  const average=Business.Average;
  let data=await  BusinessDatabase.find({Industry:field});
  const Arr=[];
  data.forEach((i)=>{
    Arr.push((i.Result)/1000000);
  })
  console.log(Arr);
  const len=Arr.length;
  response = JSON.parse(await main(input2));
  console.log(response)
  
  res.render('AiChatbot/recommendations', { recommendations: response.recommendations, analysis: response.analysis, performance: response.performance, result, overview:response.overview,Arr,len,average});
})



module.exports=router;


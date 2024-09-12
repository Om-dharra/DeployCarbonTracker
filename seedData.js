const mongoose=require('mongoose');
const EmissionFactor=require('./models/EmissionFactor');


const emissionFactor = [
    {
      entityName: "electricity",
      emissionFactor: 0.82,
      unit: "kWh",
    },
    {
      entityName: "naturalgas",
      emissionFactor: 2.75,
      unit: "kg",
    },
    {
      entityName: "propane",
      emissionFactor: 2.99,
      unit: "kg",
    },
    {
      entityName: "heatingOil",
      emissionFactor: 3.15,
      unit: "kg",
    },
    {
      entityName: "coal",
      emissionFactor: 3300,
      unit: "metric tons",
    },
    {
      entityName: "lpg",
      emissionFactor: 2.99,
      unit: "kg",
    },
    {
      entityName: "diesel",
      emissionFactor: 2.7,
      unit: "litres",
    },
    {
      entityName: "CFC",
      emissionFactor: 18900,
      unit: "kg",
    },
    {
      entityName: "HFC",
      emissionFactor: 1430,
      unit: "kg",
    },
    {
      entityName: "DFM",
      emissionFactor: 675,
      unit: "kg",
    },
    {
      entityName: "HFCB",
      emissionFactor: 675,
      unit: "kg",
    },
    {
      entityName: "IB",
      emissionFactor: 21,
      unit: "kg",
    },
    {
      entityName: "Pro",
      emissionFactor: 11,
      unit: "kg",
    },
    {
      entityName: "petrol",
      emissionFactor: 8.78,
      unit: "gallon",
    },
    {
      entityName: "cng",
      emissionFactor:2.666 ,
      unit: "kg"
    }
];
async function seedEmissionFactors(){
    await EmissionFactor.deleteMany({});
    await EmissionFactor.insertMany(emissionFactor);
    console.log("emission factors added")
}

module.exports=seedEmissionFactors;

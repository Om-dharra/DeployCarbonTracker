const mongoose=require('mongoose');
const FootprintData=require('./models/EmissionFactor');


const footprintData=[
    {
        Electricity_B: 100, //B->Building
        naturalgas_B: 100,
        heating_oil_B: 100,
        coal_B: 100,
        LPG_B: 100,
        propane_B: 100,
        diesel_B: 100,
        refrigerant_B: 100,
        //Vehicle
        petrol_v: 100,
        diesel_v: 100,
        LPG_v: 100,
        CNG_v: 100,



    },
]
async function seedFootprintData(){
    await FootprintData.deleteMany({});
    await FootprintData.insertMany(footprintData);
    console.log("footprint data added")
}

module.exports=seedFootprintData;

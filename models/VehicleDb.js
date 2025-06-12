// models/VehicleDb.js
const mongoose=require('mongoose');

const VehicleDbSchema=new mongoose.Schema({
    // ... your existing fields like companyname, typeofvehicle ...
    petrol:{
        type:Number,
        default:0
    },
    diesel:{ // Add this field
        type:Number,
        default:0
    },
    cng:{ // Add this field
        type:Number,
        default:0
    },
    lpg:{
        type:Number,
        default:0
    },
});

const VehicleDb=mongoose.model('VehicleDb',VehicleDbSchema);
module.exports=VehicleDb;
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
    // ... any other fields ...
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const VehicleData=mongoose.model('VehicleData',VehicleDbSchema);
module.exports=VehicleData;
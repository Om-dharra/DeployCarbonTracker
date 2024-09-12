const mongoose=require('mongoose');

const VehicleDatabase=new mongoose.Schema({
    Electric_v:Number,
    petrol:Number,
    diesel: Number,
    cng: Number,
    lpg: Number
})

const VehicleDb=mongoose.model('VehicleDb',VehicleDatabase);

module.exports=VehicleDb

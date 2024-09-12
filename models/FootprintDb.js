const mongoose=require('mongoose')

const footprintSchema=new mongoose.Schema({
    month:String,
    electricity:Number, //B->Building
    naturalGas: Number,
    heatingOil: Number,
    coal: Number,
    lpg: Number,
    propane: Number,
    diesel: Number,
    refrigerant:String,
    refrigerantAmount:Number 
})

const FootprintDb=mongoose.model('FootprintDb',footprintSchema);


module.exports=FootprintDb
const mongoose=require('mongoose')


const emissionFactorSchema=new mongoose.Schema({
    entityName:String,
    emissionFactor:Number,
    unit:String,
    // industries:[
    //     {
    //         type:Map,
    //         of:Number,
    //     }
    // ]
})
const EmissionFactor=mongoose.model('EmissionFactor',emissionFactorSchema);


module.exports=EmissionFactor

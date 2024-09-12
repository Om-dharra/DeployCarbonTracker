const mongoose=require('mongoose');

const carbonSchema=new mongoose.Schema({
    user:String,
    Bname:String, //Name of Bussiness
    Industry:String,
    NoOfEmployees:Number,
    WFHpercent:Number,
    Result:String,
    Average:Number,
    Carbondatabase_B:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"FootprintDb"
        }
    ],
    Carbondatabase_V:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"VehicleDb"
        }
    ],
    Carbondatabase_R:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"ResultHistoryDb"
        }
    ],
})
/////////////////////////--------------
const BusinessDatabase=mongoose.model('BusinessDatabase',carbonSchema);


module.exports=BusinessDatabase
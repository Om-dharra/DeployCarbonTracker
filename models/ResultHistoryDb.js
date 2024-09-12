const mongoose=require('mongoose')

const resultHistoryScheme=new mongoose.Schema({
    date: Date,
    result: Number,
    user:String
})

const ResultHistoryDb=mongoose.model('ResultHistoryDb',resultHistoryScheme);
module.exports=ResultHistoryDb

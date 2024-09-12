const mongoose=require("mongoose");
const passportLocalMongoose=require('passport-local-mongoose');

const userSchema=new mongoose.Schema({
    // username:String, --->This is automatically added by passport-local-manager
    // password:String, 
    email:String,
})

userSchema.plugin(passportLocalMongoose)
const User=mongoose.model("User",userSchema);
module.exports=User
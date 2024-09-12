const express=require("express");

const router=express.Router();

const User=require("../models/User");
const passport=require("passport");

router.get("/register",(req,res)=>{
    res.render("auth/login");

})

// router.get("/testUser",async(req,res)=>{
//     const user=new User({username: "om",email:"omdharra4104@gmail.com"})
//     User.register(user,"12345"); 
//     const newUser=await User.register(user,"12345");

// })
router.post("/register",async(req,res)=>{
    const {username,email,password}=req.body;
    const user=new User({username,email});
    const Ifexists=await User.findOne({username:username});
    
    if(Ifexists){
        req.flash("error","user Already Registered");
        res.redirect("/register");
    }else{
        await User.register(user,password);
        req.flash("success","user registered successsfully");
        res.redirect("/login");

    }
    


})
router.get("/login",(req,res)=>{
    res.render("auth/login");
})
router.post("/login",
    passport.authenticate("local",{
        failureRedirect: "/login",
        failureFlash:true
    }),
    function(req,res){
        req.flash("success",`welcome back ${req.body.username}`);

        res.redirect("/home");
    }
)

router.get("/logout",(req,res)=>{

    req.logOut((err)=>{
        if(err) {return next(err)};
        req.flash("success","Goodbye see u again")
        res.redirect("/login");
    })
})



module.exports=router

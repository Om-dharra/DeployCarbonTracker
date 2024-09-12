const express = require("express");
const app = express();

const path = require("path");
const mongoose = require("mongoose");

const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/User");
const port = 8080;
const seedData = require("./seedData");
const seedData2 = require("./seedData2");



//mongostore
const mongoDBStore = require('connect-mongodb-session')(session);
const store = new mongoDBStore({
    databaseName:"Session",
    uri: "mongodb+srv://omdharra4104:LhQmsArhiSG0oskC@carbondatabase.wyyz30g.mongodb.net/?retryWrites=true&w=majority",
    collection: "session"
})
const dbURL ="mongodb+srv://omdharra4104:LhQmsArhiSG0oskC@carbondatabase.wyyz30g.mongodb.net/?retryWrites=true&w=majority";

mongoose
  .connect(dbURL)
  .then(() => console.log("db connected successfully"))
  .catch((err) => console.log(err));

//Session Config
const sessionConfig = {
  secret: "hackathonProject",
  resave: false,
  saveUninitialized: false,
  store:store
};

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Path Setting
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.use(express.static("public"));
app.use(session(sessionConfig));
app.use(passport.authenticate("session"));
app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;
  next();
});
//Seeding DAta
// seedData();
// seedData2();
//routes
const authRoutes = require("./routes/authroutes");
const homeRoutes = require("./routes/homeroutes");
const gpt = require("./routes/gpt");
//Router middleware
app.use(authRoutes);
app.use(homeRoutes);
app.use(gpt);

app.listen(port, () =>
  console.log(`Server listening at http://localhost:8080/login`)
);

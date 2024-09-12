const session = require("express-session");
const mongoDBStore = require("connect-mongodb-session")(session);

function getSessionMiddleware(){
    const mongostore = new mongoDBStore({
        uri:"mongodb://localhost:27017",
        databaseName:"Session",
        collection: "Session"
    });
    return session({
        saveUninitialized:false,
        resave:false,
        secret:"supersecret",
        store:mongostore
    })
}

module.exports = getSessionMiddleware;
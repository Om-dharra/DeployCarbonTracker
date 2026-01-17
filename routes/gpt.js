require("dotenv").config();
const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const BusinessDatabase = require('../models/BusinessDatabase');
const FootPrintDb = require("../models/FootprintDb");
const VehicleDb = require("../models/VehicleDb");
const { isLoggedIn } = require("../middleware");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

let model;
if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" },
    });
}

const generateAnalysis = async (data) => {
    if (!model) throw new Error("Gemini model not initialized");

    const prompt = `
        You are an environmental sustainability consultant.
        Sector: "${data.industry}"
        Data:
        - Electricity: ${data.electricity} kWh
        - Petrol: ${data.petrol} litres
        - Diesel: ${data.diesel} litres
        - Carbon Emission/Product: ${data.emissionPerProduct} tonnes
        - Global Sector Average: ${data.globalAverage} tonnes

        Provide a comprehensive analysis in strict JSON format:
        {
          "overview": "string (concise summary of environmental standing)",
          "analysis": "string (detailed analysis of electricity, fuel, and emissions)",
          "performance": {
            "electricity_kwh": ${data.electricity},
            "petrol_litre": ${data.petrol},
            "diesel_litre": ${data.diesel},
            "carbon_emission_per_product_tonnes": ${data.emissionPerProduct},
            "global_average_per_product_tonnes": ${data.globalAverage},
            "comparison_to_average": "string (e.g., 'Significantly above average')"
          },
          "recommendations": [
            "string (Actionable recommendation 1)",
            "string (Actionable recommendation 2)",
            "string (Actionable recommendation 3)",
            "string (Actionable recommendation 4)",
            "string (Actionable recommendation 5)"
          ],
          "improvement_outlook": "string (Potential positive impact statement)"
        }
    `;

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            safetySettings,
        });

        const candidate = result.response.candidates[0];
        return JSON.parse(candidate.content.parts[0].text);
    } catch (error) {
        console.error("Gemini Interaction Error:", error);
        throw error;
    }
};

router.post('/answer/:businessid', isLoggedIn, async (req, res) => {
    const { businessid } = req.params;

    try {
        const business = await BusinessDatabase.findById(businessid);
        if (!business) {
            req.flash('error', 'Business not found.');
            return res.redirect('back');
        }

        let electricity = 0;
        if (business.Carbondatabase_B) {
            const footprint = await FootPrintDb.findById(business.Carbondatabase_B);
            if (footprint) electricity = footprint.electricity || 0;
        }

        let petrol = 0;
        let diesel = 0;
        if (business.Carbondatabase_V) {
            const vehicle = await VehicleDb.findById(business.Carbondatabase_V);
            if (vehicle) {
                petrol = vehicle.petrol || 0;
                diesel = vehicle.diesel || 0;
            }
        }

        const emissionPerProduct = parseFloat((business.Result / 1000).toFixed(2)) || 0;
        const globalAverage = parseFloat((business.Average / 1000).toFixed(2)) || 0;

        req.session.aiContext = {
            industry: business.Industry,
            electricity,
            petrol,
            diesel,
            emissionPerProduct,
            globalAverage,
            originalResult: business.Result,
            originalAverage: business.Average
        };

        req.session.save(err => {
            if (err) throw err;
            res.render("loader/loadingScreen", { businessid });
        });

    } catch (error) {
        console.error("Error preparing data:", error);
        req.flash('error', 'Error preparing report.');
        res.redirect('back');
    }
});

router.get("/newPage/:businessid", isLoggedIn, async (req, res) => {
    const { businessid } = req.params;
    const context = req.session.aiContext;

    if (!context) {
        req.flash('error', 'Session expired. Please regenerate the report.');
        return res.redirect(`/business/${businessid}`);
    }

    try {
        const business = await BusinessDatabase.findById(businessid);
        const peerData = await BusinessDatabase.find({ Industry: business.Industry });
        const peerResults = peerData.map(i => i.Result / 1000);

        let aiResponse;
        try {
            aiResponse = await generateAnalysis(context);
        } catch (err) {
            aiResponse = {
                overview: "Analysis unavailable due to service error.",
                analysis: "Please try again later.",
                performance: { comparison_to_average: "N/A" },
                recommendations: ["System error: Unable to generate recommendations."],
                improvement_outlook: "N/A"
            };
        }

        delete req.session.aiContext;
        req.session.save();

        res.render('AiChatbot/recommendations', {
            overview: aiResponse.overview,
            analysis: aiResponse.analysis,
            performance: aiResponse.performance,
            recommendations: aiResponse.recommendations,
            improvement_outlook: aiResponse.improvement_outlook,
            result: context.originalResult,
            Arr: peerResults,
            len: peerResults.length,
            average: context.originalAverage,
            companyIndustry: context.industry,
            businessId: businessid
        });

    } catch (error) {
        console.error("Error generating page:", error);
        req.flash('error', 'Internal error loading recommendations.');
        res.redirect(`/business/${businessid}`);
    }
});

module.exports = router;
// routes/openaiRoute.js
require("dotenv").config();
const express = require("express");
const router = express.Router();
const BusinessDatabase = require('../models/BusinessDatabase');
const { isLoggedIn } = require("../middleware"); // Corrected path if middleware is in root

const FootPrintDb = require("../models/FootprintDb");
const VehicleDb = require("../models/VehicleDb");

// Import Google Generative AI SDK
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// Use GEMINI_API_KEY from .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found in .env file. Please add it.");
    // Optionally, you might want to prevent the app from starting or disable AI features
}
const MODEL_NAME = "gemini-1.5-flash"; // Or "gemini-pro", "gemini-1.5-pro". Flash is often good for JSON.

// Initialize Gemini client
let genAI;
let model;

if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        // For gemini-1.5 models, you can enforce JSON output directly:
        generationConfig: { responseMimeType: "application/json" },
    });
} else {
    console.warn("Gemini AI client not initialized due to missing API key.");
}


// This function will call the Gemini API
async function callGeminiAPI(prompt) {
    if (!model) {
        console.error("Gemini model not initialized. Cannot make API call.");
        return JSON.stringify({
            error: "Gemini model not initialized",
            overview: "AI service unavailable.",
            analysis: "AI service unavailable.",
            performance: "AI service unavailable.",
            recommendations: ["Please check server configuration and API key."],
            improvement: "AI service unavailable."
        });
    }
    console.log("Sending prompt to Gemini. Length:", prompt.length); // Good to log length for very long prompts
    try {
        const generationConfig = {
            temperature: 0.5, // Lower for more factual, higher for more creative
            topK: 1,
            topP: 1,
            maxOutputTokens: 8192,
             responseMimeType: "application/json", // Enforce JSON output if using Gemini 1.5
        };

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: [ // You can add history if you want a conversational context, but for one-shot JSON, it's often not needed.
                // { role: "user", parts: [{ text: "Initial context if any" }] },
                // { role: "model", parts: [{ text: "Understood." }] },
            ]
        });

        const result = await chat.sendMessage(prompt); // Use sendMessage for chat

        // const result = await model.generateContent({ // Use generateContent for single turn
        //     contents: [{ role: "user", parts: [{ text: prompt }] }],
        //     generationConfig,
        //     safetySettings,
        // });


        if (result && result.response && result.response.candidates && result.response.candidates.length > 0) {
            const candidate = result.response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                let responseText = candidate.content.parts[0].text;
                console.log("Raw Gemini response text:", responseText);
                // With responseMimeType: "application/json", it should already be clean JSON.
                // If not using responseMimeType, you might need to strip markdown:
                // if (responseText.startsWith("```json")) {
                //     responseText = responseText.substring(7, responseText.length - 3).trim();
                // } else if (responseText.startsWith("```")) {
                //      responseText = responseText.substring(3, responseText.length - 3).trim();
                // }
                return responseText; // This should be a JSON string
            }
        }
        console.error("Gemini API response format unexpected:", JSON.stringify(result, null, 2));
        throw new Error("Unexpected response format from Gemini API.");

    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? error.response.data : error.message, error.stack);
        return JSON.stringify({
            error: "Failed to get response from Gemini",
            details: error.message,
            overview: "Error occurred during AI processing.",
            analysis: "Could not analyze due to an API error with the AI service.",
            performance: "Performance evaluation unavailable due to AI error.",
            recommendations: ["There was an issue contacting the AI. Please try again later or contact support."],
            improvement: "No improvement suggestion due to AI error."
        });
    }
}

// This route prepares the data and stores it in session
router.post('/answer/:businessid', isLoggedIn, async function (req, res) {
    const { businessid } = req.params;
    try {
        const Business = await BusinessDatabase.findById(businessid);
        if (!Business) {
            req.flash('error', 'Business not found.');
            return res.redirect('back'); // Or to a relevant page
        }
        console.log("Business Data for AI:", Business);

        let electricity = 0;
        if (Business.Carbondatabase_B) {
            const footprintData = await FootPrintDb.findById(Business.Carbondatabase_B);
            if (footprintData) electricity = footprintData.electricity || 0;
        }

        let petrol = 0;
        let diesel = 0; // Initialize diesel
        if (Business.Carbondatabase_V) {
            const vehicleData = await VehicleDb.findById(Business.Carbondatabase_V);
            if (vehicleData) {
                petrol = vehicleData.petrol || 0;
                diesel = vehicleData.diesel || 0; // Assuming 'diesel' field MIGHT exist or you'll add it
            }
        }

        const carbonEmissionPerProduct = parseFloat((Business.Result / 1000).toFixed(2)); // in tonnes, ensure it's a number
        const globalAveragePerProduct = parseFloat((Business.Average / 1000).toFixed(2)); // in tonnes, ensure it's a number
        const companyDomain = Business.Industry;

        // Construct the prompt for Gemini
        const inputForGemini = `
        You are an expert environmental sustainability consultant.
        A company in the "${companyDomain}" sector has provided the following data:
        - Annual Electricity Consumption: ${electricity} kWh
        - Annual Petrol Consumption: ${petrol} litres
        - Annual Diesel Consumption: ${diesel} litres
        - Their Carbon Emission per Product: ${carbonEmissionPerProduct} tonnes
        - Global Average Carbon Emission per Product for this sector: ${globalAveragePerProduct} tonnes

        Your task is to provide a comprehensive analysis and actionable recommendations.
        The response MUST be a valid JSON object. Do not include any explanatory text, markdown, or comments outside the JSON structure.
        The JSON object should strictly follow this structure:
        {
          "overview": "string (Provide a concise, insightful summary of the company's environmental standing based on the data. Mention if they are above or below average and key areas of concern/strength.)",
          "analysis": "string (Detailed analysis of the provided data. Explain what the numbers mean in practical terms. For example, relate electricity consumption to potential sources like lighting, machinery, HVAC. Discuss implications of transport fuel usage. Critically evaluate their per-product emission against the global average.)",
          "performance": {
            "electricity_kwh": ${electricity},
            "petrol_litre": ${petrol},
            "diesel_litre": ${diesel},
            "carbon_emission_per_product_tonnes": ${carbonEmissionPerProduct},
            "global_average_per_product_tonnes": ${globalAveragePerProduct},
            "comparison_to_average": "string (e.g., 'Significantly above average', 'Slightly below average', 'On par with global average')"
          },
          "recommendations": [
            "string (Actionable recommendation 1, e.g., 'Conduct an energy audit to identify specific areas for electricity reduction in your facilities, targeting a X% reduction in the next 12 months.')",
            "string (Actionable recommendation 2, e.g., 'Evaluate the feasibility of transitioning X% of your vehicle fleet (currently using ${petrol}L petrol and ${diesel}L diesel) to electric or hybrid models within 3 years.')",
            "string (Actionable recommendation 3, e.g., 'Investigate production process optimizations to reduce carbon emissions per product from ${carbonEmissionPerProduct} tonnes, aiming to reach or surpass the global average of ${globalAveragePerProduct} tonnes.')",
            "string (Actionable recommendation 4, e.g., 'Explore sourcing renewable energy (e.g., solar PPA, green tariffs) to cover at least Y% of your ${electricity} kWh electricity demand.')",
            "string (Actionable recommendation 5, e.g., 'Implement an employee training program focused on energy conservation and sustainable practices within the workplace.')"
          ],
          "improvement_outlook": "string (A concluding statement on the potential positive impact if the company implements the recommendations, focusing on environmental benefits and potentially cost savings or improved brand image.)"
        }

        Populate the string fields with specific, insightful, and data-driven content.
        If a value (like diesel) is 0, tailor recommendations accordingly (e.g., "Continue to maintain zero diesel usage by exploring alternatives for any future heavy-duty vehicle needs.").
        Ensure recommendations are concrete and, where possible, suggest quantifiable targets or next steps.
        For the 'comparison_to_average' field in 'performance', calculate if carbon_emission_per_product_tonnes is higher, lower, or similar to global_average_per_product_tonnes and state it clearly.
        `;

        // Store necessary data in session
        req.session.aiData = {
            prompt: inputForGemini,
            companyResult: Business.Result, // Original result for display
            companyAverage: Business.Average, // Original average for display
            companyIndustry: Business.Industry,
        };

        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                req.flash('error', 'Could not prepare report due to a session error.');
                return res.redirect('back');
            }
            res.render("loader/loadingScreen", { businessid });
        });

    } catch (error) {
        console.error("Error in POST /answer/:businessid :", error);
        req.flash('error', 'An internal error occurred while preparing your report.');
        res.redirect('back'); // Or a generic error page
    }
});

// This route fetches data from session, calls AI, and renders the page
router.get("/newPage/:businessid", isLoggedIn, async (req, res) => {
    const { businessid } = req.params; // businessid is used for fetching graph data

    if (!req.session.aiData || !req.session.aiData.prompt) {
        req.flash('error', 'Report data not found or session expired. Please try generating the report again.');
        return res.redirect(`/business/${businessid}`); // Redirect to a relevant page, e.g., the business details page
    }

    const { prompt, companyResult, companyAverage, companyIndustry } = req.session.aiData;

    try {
        const BusinessForGraph = await BusinessDatabase.findById(businessid); // To ensure we have the latest for graph context if needed
        if (!BusinessForGraph) {
             req.flash('error', 'Business data for graph not found.');
             return res.redirect('back');
        }

        // Fetch data for the graph (same as your original)
        const fieldForGraph = BusinessForGraph.Industry; // Use consistent industry name
        const averageForGraph = BusinessForGraph.Average; // This is the company's specific average figure, not global
        let peerData = await BusinessDatabase.find({ Industry: fieldForGraph });
        const peerResultsArr = peerData.map(i => (i.Result) / 1000); // Assuming Result is in kg, convert to tonnes for graph
        const peerResultsArrLen = peerResultsArr.length;


        const geminiResponseString = await callGeminiAPI(prompt);
        let aiResponseJson;

        try {
            aiResponseJson = JSON.parse(geminiResponseString);
        } catch (parseError) {
            console.error("Failed to parse Gemini JSON response:", parseError);
            console.error("Raw response string that failed parsing:", geminiResponseString);
            // Provide a fallback structure if parsing fails
            aiResponseJson = {
                overview: "Error: Could not parse AI response.",
                analysis: "The AI's response was not in the expected JSON format. This might be a temporary issue with the AI service or a problem with the generated content. Please check server logs.",
                performance: {
                    electricity_kwh: "N/A", petrol_litre: "N/A", diesel_litre: "N/A",
                    carbon_emission_per_product_tonnes: "N/A", global_average_per_product_tonnes: "N/A",
                    comparison_to_average: "N/A"
                },
                recommendations: ["Could not load recommendations due to an AI response parsing error. Please try again later."],
                improvement_outlook: "Cannot determine due to parsing error."
            };
        }

        console.log("Parsed Gemini Response for rendering:", aiResponseJson);

        // Clear the session data after use
        delete req.session.aiData;
        req.session.save(err => {
            if (err) console.error("Error clearing session data:", err);
        });

        res.render('AiChatbot/recommendations', {
            // From AI response
            overview: aiResponseJson.overview || "Overview not available.",
            analysis: aiResponseJson.analysis || "Analysis not available.",
            performance: aiResponseJson.performance || { comparison_to_average: "Performance data not available." },
            recommendations: aiResponseJson.recommendations || ["Recommendations not available."],
            improvement_outlook: aiResponseJson.improvement_outlook || "Improvement outlook not available.",
            // From original business data / session
            result: companyResult, // Company's own total emission (original unit)
            // Data for the graph
            Arr: peerResultsArr,
            len: peerResultsArrLen,
            average: averageForGraph, // Company's 'Average' field (original unit)
            // You might want to pass companyIndustry to the template too for display
            companyIndustry: companyIndustry,
            businessId: businessid // For any links back or context
        });

    } catch (error) {
        console.error("Error in GET /newPage/:businessid :", error);
        req.flash('error', 'An internal error occurred while loading the recommendations.');
        res.redirect(`/business/${businessid}`); // Or a generic error page
    }
});

module.exports = router;
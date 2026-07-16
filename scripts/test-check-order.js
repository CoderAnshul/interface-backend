import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

async function testCheckOrder() {
    try {
        console.log("🧪 Testing check-order endpoint...\n");
        
        // Test data - replace with actual values from your database
        const testData = {
            coursePlanId: "your_course_plan_id_here", // Replace with actual plan ID
            guestEmail: "test@example.com",
            guestName: "Test User",
            is_verify: true
        };

        console.log("📤 Sending request:", JSON.stringify(testData, null, 2));
        
        const response = await axios.post(`${BASE_URL}/checkout/check-order`, testData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("\n✅ Success!");
        console.log("Response:", JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error("\n❌ Error occurred:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Response:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
}

testCheckOrder();

